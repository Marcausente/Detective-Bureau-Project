/**
 * Script de migración opcional: Convierte avatares de Base64 existentes en la tabla `users`
 * a URLs públicas de Supabase Storage.
 *
 * Instrucciones de uso:
 * 1. Asegúrate de que el bucket 'uploads' esté creado en Supabase Dashboard y sea PÚBLICO.
 * 2. Ejecuta este script con Node.js en tu terminal:
 *    node scripts/migrate_avatars_to_storage.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde .env manualmente
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...values] = trimmed.split('=');
                if (key && values.length > 0) {
                    process.env[key.trim()] = values.join('=').trim();
                }
            }
        });
    }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function dataURLtoBuffer(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const buffer = Buffer.from(arr[1], 'base64');
    let ext = 'jpg';
    if (mime.includes('png')) ext = 'png';
    else if (mime.includes('webp')) ext = 'webp';
    return { buffer, mime, ext };
}

async function migrateAvatars() {
    console.log('Iniciando escaneo de usuarios con imágenes Base64...');

    const { data: users, error } = await supabase
        .from('users')
        .select('id, nombre, apellido, profile_image');

    if (error) {
        console.error('Error al obtener usuarios:', error);
        return;
    }

    const base64Users = users.filter(u => u.profile_image && u.profile_image.startsWith('data:image'));
    console.log(`Encontrados ${base64Users.length} usuarios con imágenes en Base64.`);

    if (base64Users.length === 0) {
        console.log('✓ No hay usuarios pendientes con imágenes en Base64.');
        return;
    }

    for (const user of base64Users) {
        try {
            console.log(`Migrando avatar de ${user.nombre} ${user.apellido} (${user.id})...`);
            const { buffer, mime, ext } = dataURLtoBuffer(user.profile_image);
            const fileName = `avatars/migrated_${user.id}_${Date.now()}.${ext}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(fileName, buffer, {
                    contentType: mime,
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error(`  - Error al subir a Storage para ${user.nombre} ${user.apellido}:`, uploadError.message);
                if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
                    console.error('  ⚠️ RECUERDA: Debes crear el bucket llamado "uploads" en Supabase Dashboard -> Storage y marcarlo como Public.');
                }
                continue;
            }

            const { data: publicUrlData } = supabase.storage
                .from('uploads')
                .getPublicUrl(fileName);

            const publicUrl = publicUrlData.publicUrl;

            const { error: updateError } = await supabase
                .from('users')
                .update({ profile_image: publicUrl })
                .eq('id', user.id);

            if (updateError) {
                console.error(`  - Error al actualizar BD para ${user.id}:`, updateError.message);
            } else {
                console.log(`  ✓ Éxito. Nueva URL: ${publicUrl}`);
            }

        } catch (err) {
            console.error(`  - Excepción procesando usuario ${user.id}:`, err.message);
        }
    }

    console.log('\nMigración finalizada con éxito.');
}

migrateAvatars();

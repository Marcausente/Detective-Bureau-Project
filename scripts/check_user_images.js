import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUserImages() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, nombre, apellido, profile_image');

    if (error) {
        console.error("Error querying users:", error);
        return;
    }

    console.log(`Total usuarios en BBDD: ${users.length}`);
    users.forEach((u, i) => {
        let imgType = 'Vacia / null';
        if (u.profile_image) {
            if (u.profile_image.startsWith('data:image')) {
                imgType = `Base64 (pesa ${Math.round(u.profile_image.length / 1024)} KB)`;
            } else if (u.profile_image.includes('supabase.co/storage')) {
                imgType = `Supabase Storage URL (${u.profile_image.substring(0, 70)}...)`;
            } else if (u.profile_image.startsWith('http')) {
                imgType = `External URL (${u.profile_image.substring(0, 50)}...)`;
            } else {
                imgType = `Otro (${u.profile_image.substring(0, 30)})`;
            }
        }
        console.log(`[${i+1}] ${u.nombre} ${u.apellido}: ${imgType}`);
    });
}

checkUserImages();

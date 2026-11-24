import { supabase } from '../supabaseClient';

export const DEFAULT_WIPE_FOLDER = 'Actual';
const KEY_ACTIVE_WIPE = 'ballistics_active_wipe_folder';
const KEY_WIPE_FOLDERS = 'ballistics_wipe_folders';

/**
 * Obtiene la carpeta de Wipe que se muestra actualmente en la página de balística
 * (visible para todos los usuarios). Por defecto es 'Actual'.
 */
export async function getActiveBallisticsWipeFolder() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', KEY_ACTIVE_WIPE)
            .single();

        if (!error && data?.value && data.value.trim().length > 0) {
            const val = data.value.trim();
            localStorage.setItem(KEY_ACTIVE_WIPE, val);
            return val;
        }
    } catch (err) {
        console.warn('Error reading active ballistics wipe folder from app_settings:', err);
    }

    try {
        const cached = localStorage.getItem(KEY_ACTIVE_WIPE);
        if (cached && cached.trim().length > 0) {
            return cached.trim();
        }
    } catch {
        // ignore
    }

    return DEFAULT_WIPE_FOLDER;
}

/**
 * Establece la carpeta de Wipe activa que se mostrará regularmente en la página para todos los agentes.
 * Solo administradores pueden ejecutar esta acción.
 */
export async function setActiveBallisticsWipeFolder(folderName) {
    const cleanName = (folderName || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanName) return false;

    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: KEY_ACTIVE_WIPE,
                value: cleanName,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Failed to set active ballistics wipe folder in app_settings:', error);
        } else {
            localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
            return true;
        }
    } catch (err) {
        console.error('Error setting active ballistics wipe folder:', err);
    }

    localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
    return false;
}

/**
 * Obtiene la lista completa de carpetas de Wipe registradas y existentes en la base de datos para balística.
 * Siempre incluye 'Actual'.
 */
export async function getBallisticsWipeFoldersList() {
    let foldersSet = new Set([DEFAULT_WIPE_FOLDER]);

    // 1. Obtener lista guardada en app_settings
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', KEY_WIPE_FOLDERS)
            .single();

        if (data?.value) {
            try {
                const parsed = JSON.parse(data.value);
                if (Array.isArray(parsed)) {
                    parsed.forEach(f => {
                        if (f && typeof f === 'string' && f.trim().length > 0) {
                            foldersSet.add(f.trim());
                        }
                    });
                }
            } catch {
                data.value.split(',').forEach(f => {
                    if (f && f.trim().length > 0) foldersSet.add(f.trim());
                });
            }
        }
    } catch (err) {
        console.warn('Could not read ballistics wipe folders list from app_settings:', err);
    }

    // 2. Extraer carpetas que existan en ballistics_bullets y ballistics_weapons
    try {
        const [bulletsRes, weaponsRes] = await Promise.allSettled([
            supabase.from('ballistics_bullets').select('wipe_folder'),
            supabase.from('ballistics_weapons').select('wipe_folder')
        ]);

        if (bulletsRes.status === 'fulfilled' && bulletsRes.value?.data) {
            bulletsRes.value.data.forEach(b => {
                const f = (b.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
        if (weaponsRes.status === 'fulfilled' && weaponsRes.value?.data) {
            weaponsRes.value.data.forEach(w => {
                const f = (w.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from ballistics tables:', err);
    }

    // Fallback a localStorage
    try {
        const cached = localStorage.getItem(KEY_WIPE_FOLDERS);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
                parsed.forEach(f => {
                    if (f && typeof f === 'string' && f.trim().length > 0) {
                        foldersSet.add(f.trim());
                    }
                });
            }
        }
    } catch {
        // ignore
    }

    const result = Array.from(foldersSet);
    result.sort((a, b) => {
        if (a === DEFAULT_WIPE_FOLDER) return -1;
        if (b === DEFAULT_WIPE_FOLDER) return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return result;
}

/**
 * Guarda la lista de carpetas en app_settings
 */
export async function saveBallisticsWipeFoldersList(foldersArray) {
    if (!Array.isArray(foldersArray)) return false;
    const cleaned = Array.from(new Set(
        foldersArray
            .map(f => (typeof f === 'string' ? f.trim() : ''))
            .filter(Boolean)
    ));
    if (!cleaned.includes(DEFAULT_WIPE_FOLDER)) {
        cleaned.unshift(DEFAULT_WIPE_FOLDER);
    }

    try {
        const jsonStr = JSON.stringify(cleaned);
        localStorage.setItem(KEY_WIPE_FOLDERS, jsonStr);

        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: KEY_WIPE_FOLDERS,
                value: jsonStr,
                updated_at: new Date().toISOString()
            });

        return !error;
    } catch (err) {
        console.error('Error saving ballistics wipe folders list:', err);
        return false;
    }
}

/**
 * Crea una nueva carpeta de Wipe para balística si no existe
 */
export async function createBallisticsWipeFolder(newFolderName) {
    const cleanName = (newFolderName || '').trim();
    if (!cleanName) throw new Error('El nombre de la carpeta no puede estar vacío');

    const currentList = await getBallisticsWipeFoldersList();
    if (currentList.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
        return currentList; // ya existe
    }

    const updated = [...currentList, cleanName];
    await saveBallisticsWipeFoldersList(updated);
    return updated;
}

/**
 * Elimina una carpeta de Wipe.
 * Mueve los casquillos y armas que tuviera a la carpeta de rescate (por defecto 'Actual').
 * No permite eliminar la carpeta 'Actual'.
 */
export async function deleteBallisticsWipeFolder(folderName, fallbackFolder = DEFAULT_WIPE_FOLDER) {
    const cleanName = (folderName || '').trim();
    if (!cleanName || cleanName === DEFAULT_WIPE_FOLDER) {
        throw new Error('No es posible eliminar la carpeta base "Actual"');
    }

    // 1. Reasignar cualquier casquillo o arma que perteneciera a esta carpeta
    try {
        await supabase
            .from('ballistics_bullets')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning ballistics_bullets on wipe folder deletion:', err);
    }

    try {
        await supabase
            .from('ballistics_weapons')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning ballistics_weapons on wipe folder deletion:', err);
    }

    // 2. Eliminar de la lista guardada
    const currentList = await getBallisticsWipeFoldersList();
    const updated = currentList.filter(f => f.toLowerCase() !== cleanName.toLowerCase());
    await saveBallisticsWipeFoldersList(updated);

    // 3. Si era la carpeta activa, restablecer a 'Actual'
    const active = await getActiveBallisticsWipeFolder();
    if (active.toLowerCase() === cleanName.toLowerCase()) {
        await setActiveBallisticsWipeFolder(DEFAULT_WIPE_FOLDER);
    }

    return updated;
}

/**
 * Mueve casquillos y/o armas a una carpeta de Wipe destino.
 * @param {Object} options
 * @param {string[]|'all'} [options.bulletIds] - Array de UUIDs de balas o 'all'
 * @param {string[]|'all'} [options.weaponIds] - Array de UUIDs de armas o 'all'
 * @param {string} options.targetFolder - Nombre de la carpeta destino
 * @param {string} [options.sourceFolder] - Carpeta origen (si se mueven todos)
 */
export async function moveBallisticsToWipeFolder({ bulletIds = [], weaponIds = [], targetFolder, sourceFolder }) {
    const cleanTarget = (targetFolder || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanTarget) throw new Error('Debes indicar una carpeta de destino válida');

    // Asegurarse de que la carpeta de destino esté registrada en la lista
    await createBallisticsWipeFolder(cleanTarget);

    // Caso 1: Mover TODO de la carpeta origen
    if (bulletIds === 'all' && weaponIds === 'all') {
        const cleanSource = (sourceFolder || DEFAULT_WIPE_FOLDER).trim();
        let queryBullets = supabase.from('ballistics_bullets').update({ wipe_folder: cleanTarget });
        let queryWeapons = supabase.from('ballistics_weapons').update({ wipe_folder: cleanTarget });

        if (cleanSource === DEFAULT_WIPE_FOLDER) {
            queryBullets = queryBullets.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
            queryWeapons = queryWeapons.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
        } else {
            queryBullets = queryBullets.eq('wipe_folder', cleanSource);
            queryWeapons = queryWeapons.eq('wipe_folder', cleanSource);
        }

        const [resBullets, resWeapons] = await Promise.all([queryBullets, queryWeapons]);
        if (resBullets.error) throw resBullets.error;
        if (resWeapons.error) throw resWeapons.error;

        return { movedCount: 'all', targetFolder: cleanTarget };
    }

    // Caso 2: Mover balas o armas específicas
    let movedBulletsCount = 0;
    let movedWeaponsCount = 0;

    if (Array.isArray(bulletIds) && bulletIds.length > 0) {
        const { error } = await supabase
            .from('ballistics_bullets')
            .update({ wipe_folder: cleanTarget })
            .in('id', bulletIds);

        if (error) throw error;
        movedBulletsCount = bulletIds.length;
    }

    if (Array.isArray(weaponIds) && weaponIds.length > 0) {
        const { error } = await supabase
            .from('ballistics_weapons')
            .update({ wipe_folder: cleanTarget })
            .in('id', weaponIds);

        if (error) throw error;
        movedWeaponsCount = weaponIds.length;
    }

    if (movedBulletsCount === 0 && movedWeaponsCount === 0) {
        throw new Error('No se han seleccionado elementos de balística para mover');
    }

    return {
        movedCount: movedBulletsCount + movedWeaponsCount,
        bulletsCount: movedBulletsCount,
        weaponsCount: movedWeaponsCount,
        targetFolder: cleanTarget
    };
}

/**
 * Obtiene estadísticas de balística agrupadas por carpeta de Wipe
 * Retorna un mapa: { [folderName]: { total, bullets, weapons } }
 */
export async function getBallisticsWipeFoldersStats() {
    try {
        const [bulletsRes, weaponsRes] = await Promise.allSettled([
            supabase.from('ballistics_bullets').select('id, wipe_folder'),
            supabase.from('ballistics_weapons').select('id, wipe_folder')
        ]);

        const stats = {};

        if (bulletsRes.status === 'fulfilled' && bulletsRes.value?.data) {
            bulletsRes.value.data.forEach(b => {
                const folder = (b.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER;
                if (!stats[folder]) {
                    stats[folder] = { total: 0, bullets: 0, weapons: 0 };
                }
                stats[folder].total += 1;
                stats[folder].bullets += 1;
            });
        }

        if (weaponsRes.status === 'fulfilled' && weaponsRes.value?.data) {
            weaponsRes.value.data.forEach(w => {
                const folder = (w.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER;
                if (!stats[folder]) {
                    stats[folder] = { total: 0, bullets: 0, weapons: 0 };
                }
                stats[folder].total += 1;
                stats[folder].weapons += 1;
            });
        }

        return stats;
    } catch (err) {
        console.warn('Error fetching ballistics wipe stats:', err);
        return {};
    }
}

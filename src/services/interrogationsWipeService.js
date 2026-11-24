import { supabase } from '../supabaseClient';

export const DEFAULT_WIPE_FOLDER = 'Actual';
const KEY_ACTIVE_WIPE = 'interrogations_active_wipe_folder';
const KEY_WIPE_FOLDERS = 'interrogations_wipe_folders';

/**
 * Obtiene la carpeta de Wipe que se muestra actualmente en la página de interrogatorios
 * (visible para todos los usuarios). Por defecto es 'Actual'.
 */
export async function getActiveInterrogationsWipeFolder() {
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
        console.warn('Error reading active interrogations wipe folder from app_settings:', err);
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
export async function setActiveInterrogationsWipeFolder(folderName) {
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
            console.error('Failed to set active interrogations wipe folder in app_settings:', error);
        } else {
            localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
            return true;
        }
    } catch (err) {
        console.error('Error setting active interrogations wipe folder:', err);
    }

    localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
    return false;
}

/**
 * Obtiene la lista completa de carpetas de Wipe registradas y existentes en la base de datos para interrogatorios.
 * Siempre incluye 'Actual'.
 */
export async function getInterrogationsWipeFoldersList() {
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
        console.warn('Could not read interrogations wipe folders list from app_settings:', err);
    }

    // 2. Extraer carpetas que existan en la tabla interrogations
    try {
        const { data: interrogationsData } = await supabase
            .from('interrogations')
            .select('wipe_folder');

        if (interrogationsData && interrogationsData.length > 0) {
            interrogationsData.forEach(c => {
                const f = (c.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from interrogations:', err);
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
export async function saveInterrogationsWipeFoldersList(foldersArray) {
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
        console.error('Error saving interrogations wipe folders list:', err);
        return false;
    }
}

/**
 * Crea una nueva carpeta de Wipe para interrogatorios si no existe
 */
export async function createInterrogationsWipeFolder(newFolderName) {
    const cleanName = (newFolderName || '').trim();
    if (!cleanName) throw new Error('El nombre de la carpeta no puede estar vacío');

    const currentList = await getInterrogationsWipeFoldersList();
    if (currentList.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
        return currentList; // ya existe
    }

    const updated = [...currentList, cleanName];
    await saveInterrogationsWipeFoldersList(updated);
    return updated;
}

/**
 * Elimina una carpeta de Wipe.
 * Mueve los interrogatorios que tuviera a la carpeta de rescate (por defecto 'Actual').
 * No permite eliminar la carpeta 'Actual'.
 */
export async function deleteInterrogationsWipeFolder(folderName, fallbackFolder = DEFAULT_WIPE_FOLDER) {
    const cleanName = (folderName || '').trim();
    if (!cleanName || cleanName === DEFAULT_WIPE_FOLDER) {
        throw new Error('No es posible eliminar la carpeta base "Actual"');
    }

    // 1. Reasignar cualquier interrogatorio que perteneciera a esta carpeta
    try {
        await supabase
            .from('interrogations')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning interrogations on wipe folder deletion:', err);
    }

    // 2. Eliminar de la lista guardada
    const currentList = await getInterrogationsWipeFoldersList();
    const updated = currentList.filter(f => f.toLowerCase() !== cleanName.toLowerCase());
    await saveInterrogationsWipeFoldersList(updated);

    // 3. Si era la carpeta activa, restablecer a 'Actual'
    const active = await getActiveInterrogationsWipeFolder();
    if (active.toLowerCase() === cleanName.toLowerCase()) {
        await setActiveInterrogationsWipeFolder(DEFAULT_WIPE_FOLDER);
    }

    return updated;
}

/**
 * Mueve interrogatorios (seleccionados o todos) a una carpeta de Wipe destino.
 * @param {Object} options
 * @param {string[]|'all'} options.interrogationIds - Array de UUIDs de interrogatorios o 'all'
 * @param {string} options.targetFolder - Nombre de la carpeta destino
 * @param {string} [options.sourceFolder] - Carpeta origen (si se mueven todos)
 */
export async function moveInterrogationsToWipeFolder({ interrogationIds, targetFolder, sourceFolder }) {
    const cleanTarget = (targetFolder || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanTarget) throw new Error('Debes indicar una carpeta de destino válida');

    // Asegurarse de que la carpeta de destino esté registrada en la lista
    await createInterrogationsWipeFolder(cleanTarget);

    if (Array.isArray(interrogationIds) && interrogationIds.length > 0) {
        // Mover interrogatorios seleccionados específicamente
        const { error } = await supabase
            .from('interrogations')
            .update({ wipe_folder: cleanTarget })
            .in('id', interrogationIds);

        if (error) throw error;
        return { movedCount: interrogationIds.length, targetFolder: cleanTarget };
    } else if (interrogationIds === 'all') {
        // Mover todos los interrogatorios de la carpeta origen
        const cleanSource = (sourceFolder || DEFAULT_WIPE_FOLDER).trim();
        let query = supabase.from('interrogations').update({ wipe_folder: cleanTarget });

        if (cleanSource === DEFAULT_WIPE_FOLDER) {
            query = query.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
        } else {
            query = query.eq('wipe_folder', cleanSource);
        }

        const { error } = await query;
        if (error) throw error;

        return { movedCount: 'all', targetFolder: cleanTarget };
    }

    throw new Error('No se han seleccionado interrogatorios para mover');
}

/**
 * Obtiene estadísticas de interrogatorios agrupadas por carpeta de Wipe
 * Retorna un mapa: { [folderName]: { total, withMedia } }
 */
export async function getInterrogationsWipeFoldersStats() {
    try {
        const { data, error } = await supabase
            .from('interrogations')
            .select('id, media_url, wipe_folder');

        if (error || !data) return {};

        const stats = {};

        data.forEach(item => {
            const folder = (item.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER;
            if (!stats[folder]) {
                stats[folder] = { total: 0, withMedia: 0 };
            }
            stats[folder].total += 1;
            if (item.media_url && item.media_url.trim().length > 0) {
                stats[folder].withMedia += 1;
            }
        });

        return stats;
    } catch (err) {
        console.warn('Error fetching interrogations wipe stats:', err);
        return {};
    }
}

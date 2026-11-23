import { supabase } from '../supabaseClient';

export const DEFAULT_WIPE_FOLDER = 'Actual';
const KEY_ACTIVE_WIPE = 'cases_active_wipe_folder';
const KEY_WIPE_FOLDERS = 'cases_wipe_folders';

/**
 * Obtiene el nombre de la carpeta de Wipe que se muestra actualmente en la página pública
 * (visible para todos los usuarios). Por defecto es 'Actual'.
 */
export async function getActiveWipeFolder() {
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
        console.warn('Error reading active wipe folder from app_settings:', err);
    }

    try {
        const cached = localStorage.getItem(KEY_ACTIVE_WIPE);
        if (cached && cached.trim().length > 0) {
            return cached.trim();
        }
    } catch {
        // ignore localStorage error
    }

    return DEFAULT_WIPE_FOLDER;
}

/**
 * Establece la carpeta de Wipe activa que se mostrará regularmente en la página para todos los agentes.
 * Solo administradores pueden ejecutar esta acción.
 */
export async function setActiveWipeFolder(folderName) {
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
            console.error('Failed to set active wipe folder in app_settings:', error);
        } else {
            localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
            return true;
        }
    } catch (err) {
        console.error('Error setting active wipe folder:', err);
    }

    localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
    return false;
}

/**
 * Obtiene la lista completa de carpetas de Wipe registradas y existentes en la base de datos.
 * Siempre incluye 'Actual'.
 */
export async function getWipeFoldersList() {
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
                // not json, maybe comma separated
                data.value.split(',').forEach(f => {
                    if (f && f.trim().length > 0) foldersSet.add(f.trim());
                });
            }
        }
    } catch (err) {
        console.warn('Could not read wipe folders list from app_settings:', err);
    }

    // 2. Extraer carpetas que ya existan en la tabla cases
    try {
        const { data: casesData } = await supabase
            .from('cases')
            .select('wipe_folder');

        if (casesData && casesData.length > 0) {
            casesData.forEach(c => {
                const f = (c.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from cases:', err);
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
    // Ordenar con 'Actual' primero, y el resto en orden alfabético
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
export async function saveWipeFoldersList(foldersArray) {
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
        console.error('Error saving wipe folders list:', err);
        return false;
    }
}

/**
 * Crea una nueva carpeta de Wipe si no existe
 */
export async function createWipeFolder(newFolderName) {
    const cleanName = (newFolderName || '').trim();
    if (!cleanName) throw new Error('El nombre de la carpeta no puede estar vacío');

    const currentList = await getWipeFoldersList();
    if (currentList.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
        return currentList; // ya existe
    }

    const updated = [...currentList, cleanName];
    await saveWipeFoldersList(updated);
    return updated;
}

/**
 * Elimina una carpeta de Wipe.
 * Mueve los casos que tuviera a la carpeta de rescate (por defecto 'Actual').
 * No permite eliminar la carpeta 'Actual'.
 */
export async function deleteWipeFolder(folderName, fallbackFolder = DEFAULT_WIPE_FOLDER) {
    const cleanName = (folderName || '').trim();
    if (!cleanName || cleanName === DEFAULT_WIPE_FOLDER) {
        throw new Error('No es posible eliminar la carpeta base "Actual"');
    }

    // 1. Reasignar cualquier caso que perteneciera a esta carpeta
    try {
        await supabase
            .from('cases')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning cases on wipe folder deletion:', err);
    }

    // 2. Eliminar de la lista guardada
    const currentList = await getWipeFoldersList();
    const updated = currentList.filter(f => f.toLowerCase() !== cleanName.toLowerCase());
    await saveWipeFoldersList(updated);

    // 3. Si era la carpeta activa, restablecer a 'Actual'
    const active = await getActiveWipeFolder();
    if (active.toLowerCase() === cleanName.toLowerCase()) {
        await setActiveWipeFolder(DEFAULT_WIPE_FOLDER);
    }

    return updated;
}

/**
 * Mueve casos (seleccionados o todos) a una carpeta de Wipe destino.
 * @param {Object} options
 * @param {string[]|'all'} options.caseIds - Array de UUIDs o 'all'
 * @param {string} options.targetFolder - Nombre de la carpeta destino
 * @param {string} [options.sourceFolder] - Carpeta origen (si se mueven todos)
 */
export async function moveCasesToWipeFolder({ caseIds, targetFolder, sourceFolder }) {
    const cleanTarget = (targetFolder || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanTarget) throw new Error('Debes indicar una carpeta de destino válida');

    // Asegurarse de que la carpeta de destino esté registrada en la lista
    await createWipeFolder(cleanTarget);

    if (Array.isArray(caseIds) && caseIds.length > 0) {
        // Mover casos seleccionados específicamente
        const { error } = await supabase
            .from('cases')
            .update({ wipe_folder: cleanTarget })
            .in('id', caseIds);

        if (error) throw error;
        return { movedCount: caseIds.length, targetFolder: cleanTarget };
    } else if (caseIds === 'all') {
        // Mover todos los casos de la carpeta origen
        const cleanSource = (sourceFolder || DEFAULT_WIPE_FOLDER).trim();
        let query = supabase.from('cases').update({ wipe_folder: cleanTarget });

        if (cleanSource === DEFAULT_WIPE_FOLDER) {
            query = query.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
        } else {
            query = query.eq('wipe_folder', cleanSource);
        }

        const { error, count } = await query;
        if (error) throw error;
        return { movedCount: count || 'all', targetFolder: cleanTarget };
    }

    throw new Error('No se han seleccionado casos para mover');
}

/**
 * Obtiene estadísticas de casos agrupadas por carpeta de Wipe
 * Retorna un mapa: { [folderName]: { total, open, closed, archived } }
 */
export async function getWipeFoldersStats() {
    try {
        const { data, error } = await supabase
            .from('cases')
            .select('id, status, wipe_folder');

        if (error || !data) {
            return {};
        }

        const stats = {};

        data.forEach(c => {
            const folder = (c.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER;
            if (!stats[folder]) {
                stats[folder] = { total: 0, open: 0, closed: 0, archived: 0 };
            }
            stats[folder].total += 1;
            const st = (c.status || '').toLowerCase();
            if (st === 'open' || st === 'abierto') {
                stats[folder].open += 1;
            } else if (st === 'closed' || st === 'cerrado') {
                stats[folder].closed += 1;
            } else if (st === 'archived' || st === 'archivado') {
                stats[folder].archived += 1;
            }
        });

        return stats;
    } catch (err) {
        console.warn('Error fetching wipe stats:', err);
        return {};
    }
}

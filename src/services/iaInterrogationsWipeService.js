import { supabase } from '../supabaseClient';

export const DEFAULT_WIPE_FOLDER = 'Actual';
const KEY_ACTIVE_WIPE = 'ia_interrogations_active_wipe_folder';
const KEY_WIPE_FOLDERS = 'ia_interrogations_wipe_folders';

/**
 * Obtiene la carpeta de Wipe que se muestra actualmente en la página de interrogatorios de IA
 * (visible para todos los usuarios). Por defecto es 'Actual'.
 */
export async function getActiveIAInterrogationsWipeFolder() {
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
        console.warn('Error reading active IA interrogations wipe folder from app_settings:', err);
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
export async function setActiveIAInterrogationsWipeFolder(folderName) {
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
            console.error('Failed to set active IA interrogations wipe folder in app_settings:', error);
        } else {
            localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
            return true;
        }
    } catch (err) {
        console.error('Error setting active IA interrogations wipe folder:', err);
    }

    localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
    return false;
}

/**
 * Obtiene la lista completa de carpetas de Wipe registradas y existentes en la base de datos para interrogatorios de IA.
 * Siempre incluye 'Actual'.
 */
export async function getIAInterrogationsWipeFoldersList() {
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
        console.warn('Could not read IA interrogations wipe folders list from app_settings:', err);
    }

    // 2. Extraer carpetas que existan en la tabla ia_interrogations
    try {
        const { data: itemsData } = await supabase
            .from('ia_interrogations')
            .select('wipe_folder');

        if (itemsData && itemsData.length > 0) {
            itemsData.forEach(c => {
                const f = (c.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from ia_interrogations:', err);
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
export async function saveIAInterrogationsWipeFoldersList(foldersArray) {
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
        console.error('Error saving IA interrogations wipe folders list:', err);
        return false;
    }
}

/**
 * Crea una nueva carpeta de Wipe para interrogatorios de IA si no existe
 */
export async function createIAInterrogationsWipeFolder(newFolderName) {
    const cleanName = (newFolderName || '').trim();
    if (!cleanName) throw new Error('El nombre de la carpeta no puede estar vacío');

    const currentList = await getIAInterrogationsWipeFoldersList();
    if (currentList.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
        return currentList; // ya existe
    }

    const updated = [...currentList, cleanName];
    await saveIAInterrogationsWipeFoldersList(updated);
    return updated;
}

/**
 * Elimina una carpeta de Wipe.
 * Mueve los interrogatorios de IA que tuviera a la carpeta de rescate (por defecto 'Actual').
 * No permite eliminar la carpeta 'Actual'.
 */
export async function deleteIAInterrogationsWipeFolder(folderName, fallbackFolder = DEFAULT_WIPE_FOLDER) {
    const cleanName = (folderName || '').trim();
    if (!cleanName || cleanName === DEFAULT_WIPE_FOLDER) {
        throw new Error('No es posible eliminar la carpeta base "Actual"');
    }

    // 1. Reasignar cualquier interrogatorio que perteneciera a esta carpeta
    try {
        const { error: rpcError } = await supabase.rpc('move_ia_interrogations_wipe', {
            p_interrogation_ids: null,
            p_target_folder: fallbackFolder,
            p_source_folder: cleanName
        });
        if (rpcError) {
            await supabase
                .from('ia_interrogations')
                .update({ wipe_folder: fallbackFolder })
                .eq('wipe_folder', cleanName);
        }
    } catch (err) {
        console.error('Error reassigning IA interrogations on wipe folder deletion:', err);
    }

    // 2. Eliminar de la lista guardada
    const currentList = await getIAInterrogationsWipeFoldersList();
    const updated = currentList.filter(f => f.toLowerCase() !== cleanName.toLowerCase());
    await saveIAInterrogationsWipeFoldersList(updated);

    // 3. Si era la carpeta activa, restablecer a 'Actual'
    const active = await getActiveIAInterrogationsWipeFolder();
    if (active.toLowerCase() === cleanName.toLowerCase()) {
        await setActiveIAInterrogationsWipeFolder(DEFAULT_WIPE_FOLDER);
    }

    return updated;
}

/**
 * Mueve interrogatorios de IA (seleccionados o todos) a una carpeta de Wipe destino.
 * @param {Object} options
 * @param {string[]|'all'} options.interrogationIds - Array de UUIDs de interrogatorios o 'all'
 * @param {string} options.targetFolder - Nombre de la carpeta destino
 * @param {string} [options.sourceFolder] - Carpeta origen (si se mueven todos)
 */
export async function moveIAInterrogationsToWipeFolder({ interrogationIds, targetFolder, sourceFolder }) {
    const cleanTarget = (targetFolder || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanTarget) throw new Error('Debes indicar una carpeta de destino válida');

    // Asegurarse de que la carpeta de destino esté registrada en la lista
    await createIAInterrogationsWipeFolder(cleanTarget);

    const isSpecificList = Array.isArray(interrogationIds) && interrogationIds.length > 0;
    const isAll = interrogationIds === 'all';

    if (!isSpecificList && !isAll) {
        throw new Error('No se han seleccionado interrogatorios para mover');
    }

    const cleanSource = (sourceFolder || DEFAULT_WIPE_FOLDER).trim();

    // 1. Intentar mover mediante RPC con SECURITY DEFINER (para evitar bloqueos RLS)
    try {
        const { data, error } = await supabase.rpc('move_ia_interrogations_wipe', {
            p_interrogation_ids: isSpecificList ? interrogationIds : null,
            p_target_folder: cleanTarget,
            p_source_folder: isAll ? cleanSource : null
        });

        if (!error) {
            return {
                movedCount: typeof data === 'number' ? data : (isSpecificList ? interrogationIds.length : 'all'),
                targetFolder: cleanTarget
            };
        }
        console.warn('move_ia_interrogations_wipe RPC error, falling back to direct update:', error);
    } catch (rpcErr) {
        console.warn('move_ia_interrogations_wipe RPC exception, falling back:', rpcErr);
    }

    // 2. Fallback a UPDATE directo
    if (isSpecificList) {
        const { error } = await supabase
            .from('ia_interrogations')
            .update({ wipe_folder: cleanTarget })
            .in('id', interrogationIds);

        if (error) throw error;
        return { movedCount: interrogationIds.length, targetFolder: cleanTarget };
    } else {
        let query = supabase.from('ia_interrogations').update({ wipe_folder: cleanTarget });

        if (cleanSource === DEFAULT_WIPE_FOLDER) {
            query = query.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
        } else {
            query = query.eq('wipe_folder', cleanSource);
        }

        const { error } = await query;
        if (error) throw error;

        return { movedCount: 'all', targetFolder: cleanTarget };
    }
}

/**
 * Obtiene estadísticas de interrogatorios de IA agrupadas por carpeta de Wipe
 * Retorna un mapa: { [folderName]: { total, withMedia, linkedCases } }
 */
export async function getIAInterrogationsWipeFoldersStats() {
    try {
        const { data, error } = await supabase
            .from('ia_interrogations')
            .select('id, media_url, case_id, wipe_folder');

        if (error || !data) return {};

        const stats = {};

        data.forEach(item => {
            const folder = (item.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER;
            if (!stats[folder]) {
                stats[folder] = { total: 0, withMedia: 0, linkedCases: 0 };
            }
            stats[folder].total += 1;
            if (item.media_url && item.media_url.trim().length > 0) {
                stats[folder].withMedia += 1;
            }
            if (item.case_id) {
                stats[folder].linkedCases += 1;
            }
        });

        return stats;
    } catch (err) {
        console.warn('Error fetching IA interrogations wipe stats:', err);
        return {};
    }
}

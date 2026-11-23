import { supabase } from '../supabaseClient';

export const DEFAULT_WIPE_FOLDER = 'Actual';
const KEY_ACTIVE_WIPE = 'denuncias_active_wipe_folder';
const KEY_WIPE_FOLDERS = 'denuncias_wipe_folders';

/**
 * Obtiene la carpeta de Wipe que se muestra actualmente en la página de denuncias
 * (visible para todos los usuarios). Por defecto es 'Actual'.
 */
export async function getActiveDenunciasWipeFolder() {
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
        console.warn('Error reading active denuncias wipe folder from app_settings:', err);
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
export async function setActiveDenunciasWipeFolder(folderName) {
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
            console.error('Failed to set active denuncias wipe folder in app_settings:', error);
        } else {
            localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
            return true;
        }
    } catch (err) {
        console.error('Error setting active denuncias wipe folder:', err);
    }

    localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
    return false;
}

/**
 * Obtiene la lista completa de carpetas de Wipe registradas y existentes en la base de datos para denuncias.
 * Siempre incluye 'Actual'.
 */
export async function getDenunciasWipeFoldersList() {
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
        console.warn('Could not read denuncias wipe folders list from app_settings:', err);
    }

    // 2. Extraer carpetas que existan en la tabla denuncias
    try {
        const { data: denunciasData } = await supabase
            .from('denuncias')
            .select('wipe_folder');

        if (denunciasData && denunciasData.length > 0) {
            denunciasData.forEach(c => {
                const f = (c.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from denuncias:', err);
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
export async function saveDenunciasWipeFoldersList(foldersArray) {
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
        console.error('Error saving denuncias wipe folders list:', err);
        return false;
    }
}

/**
 * Crea una nueva carpeta de Wipe para denuncias si no existe
 */
export async function createDenunciasWipeFolder(newFolderName) {
    const cleanName = (newFolderName || '').trim();
    if (!cleanName) throw new Error('El nombre de la carpeta no puede estar vacío');

    const currentList = await getDenunciasWipeFoldersList();
    if (currentList.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
        return currentList; // ya existe
    }

    const updated = [...currentList, cleanName];
    await saveDenunciasWipeFoldersList(updated);
    return updated;
}

/**
 * Elimina una carpeta de Wipe.
 * Mueve las denuncias que tuviera a la carpeta de rescate (por defecto 'Actual').
 * No permite eliminar la carpeta 'Actual'.
 */
export async function deleteDenunciasWipeFolder(folderName, fallbackFolder = DEFAULT_WIPE_FOLDER) {
    const cleanName = (folderName || '').trim();
    if (!cleanName || cleanName === DEFAULT_WIPE_FOLDER) {
        throw new Error('No es posible eliminar la carpeta base "Actual"');
    }

    // 1. Reasignar cualquier denuncia que perteneciera a esta carpeta
    try {
        await supabase
            .from('denuncias')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning denuncias on wipe folder deletion:', err);
    }

    // 2. Eliminar de la lista guardada
    const currentList = await getDenunciasWipeFoldersList();
    const updated = currentList.filter(f => f.toLowerCase() !== cleanName.toLowerCase());
    await saveDenunciasWipeFoldersList(updated);

    // 3. Si era la carpeta activa, restablecer a 'Actual'
    const active = await getActiveDenunciasWipeFolder();
    if (active.toLowerCase() === cleanName.toLowerCase()) {
        await setActiveDenunciasWipeFolder(DEFAULT_WIPE_FOLDER);
    }

    return updated;
}

/**
 * Mueve denuncias (seleccionadas o todas) a una carpeta de Wipe destino.
 * @param {Object} options
 * @param {string[]|'all'} options.denunciaIds - Array de UUIDs de denuncias o 'all'
 * @param {string} options.targetFolder - Nombre de la carpeta destino
 * @param {string} [options.sourceFolder] - Carpeta origen (si se mueven todas)
 */
export async function moveDenunciasToWipeFolder({ denunciaIds, targetFolder, sourceFolder }) {
    const cleanTarget = (targetFolder || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanTarget) throw new Error('Debes indicar una carpeta de destino válida');

    // Asegurarse de que la carpeta de destino esté registrada en la lista
    await createDenunciasWipeFolder(cleanTarget);

    if (Array.isArray(denunciaIds) && denunciaIds.length > 0) {
        // Mover denuncias seleccionadas específicamente
        const { error } = await supabase
            .from('denuncias')
            .update({ wipe_folder: cleanTarget })
            .in('id', denunciaIds);

        if (error) throw error;
        return { movedCount: denunciaIds.length, targetFolder: cleanTarget };
    } else if (denunciaIds === 'all') {
        // Mover todas las denuncias de la carpeta origen
        const cleanSource = (sourceFolder || DEFAULT_WIPE_FOLDER).trim();
        let query = supabase.from('denuncias').update({ wipe_folder: cleanTarget });

        if (cleanSource === DEFAULT_WIPE_FOLDER) {
            query = query.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
        } else {
            query = query.eq('wipe_folder', cleanSource);
        }

        const { error } = await query;
        if (error) throw error;

        return { movedCount: 'all', targetFolder: cleanTarget };
    }

    throw new Error('No se han seleccionado denuncias para mover');
}

/**
 * Obtiene estadísticas de denuncias agrupadas por carpeta de Wipe
 * Retorna un mapa: { [folderName]: { total, open, withCase, closed } }
 */
export async function getDenunciasWipeFoldersStats() {
    try {
        const { data, error } = await supabase
            .from('denuncias')
            .select('id, status, case_id, wipe_folder');

        if (error || !data) return {};

        const stats = {};

        data.forEach(d => {
            const folder = (d.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER;
            if (!stats[folder]) {
                stats[folder] = { total: 0, open: 0, withCase: 0, closed: 0 };
            }
            stats[folder].total += 1;
            if (d.status === 'Closed') {
                stats[folder].closed += 1;
            } else if (d.case_id) {
                stats[folder].withCase += 1;
            } else {
                stats[folder].open += 1;
            }
        });

        return stats;
    } catch (err) {
        console.warn('Error fetching denuncias wipe stats:', err);
        return {};
    }
}

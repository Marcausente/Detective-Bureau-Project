import { supabase } from '../supabaseClient';

export const DEFAULT_WIPE_FOLDER = 'Actual';
const KEY_ACTIVE_WIPE = 'incidents_active_wipe_folder';
const KEY_WIPE_FOLDERS = 'incidents_wipe_folders';

/**
 * Obtiene la carpeta de Wipe que se muestra actualmente en la página pública de incidentes
 * (visible para todos los usuarios). Por defecto es 'Actual'.
 */
export async function getActiveIncidentsWipeFolder() {
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
        console.warn('Error reading active incidents wipe folder from app_settings:', err);
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
export async function setActiveIncidentsWipeFolder(folderName) {
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
            console.error('Failed to set active incidents wipe folder in app_settings:', error);
        } else {
            localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
            return true;
        }
    } catch (err) {
        console.error('Error setting active incidents wipe folder:', err);
    }

    localStorage.setItem(KEY_ACTIVE_WIPE, cleanName);
    return false;
}

/**
 * Obtiene la lista completa de carpetas de Wipe registradas y existentes en la base de datos para incidentes.
 * Siempre incluye 'Actual'.
 */
export async function getIncidentsWipeFoldersList() {
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
        console.warn('Could not read incidents wipe folders list from app_settings:', err);
    }

    // 2. Extraer carpetas que existan en la tabla incidents
    try {
        const { data: incData } = await supabase
            .from('incidents')
            .select('wipe_folder');

        if (incData && incData.length > 0) {
            incData.forEach(c => {
                const f = (c.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from incidents:', err);
    }

    // 3. Extraer carpetas que existan en la tabla outings
    try {
        const { data: outData } = await supabase
            .from('outings')
            .select('wipe_folder');

        if (outData && outData.length > 0) {
            outData.forEach(o => {
                const f = (o.wipe_folder || '').trim();
                if (f) foldersSet.add(f);
            });
        }
    } catch (err) {
        console.warn('Could not scan wipe_folder from outings:', err);
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
export async function saveIncidentsWipeFoldersList(foldersArray) {
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
        console.error('Error saving incidents wipe folders list:', err);
        return false;
    }
}

/**
 * Crea una nueva carpeta de Wipe para incidentes si no existe
 */
export async function createIncidentsWipeFolder(newFolderName) {
    const cleanName = (newFolderName || '').trim();
    if (!cleanName) throw new Error('El nombre de la carpeta no puede estar vacío');

    const currentList = await getIncidentsWipeFoldersList();
    if (currentList.some(f => f.toLowerCase() === cleanName.toLowerCase())) {
        return currentList; // ya existe
    }

    const updated = [...currentList, cleanName];
    await saveIncidentsWipeFoldersList(updated);
    return updated;
}

/**
 * Elimina una carpeta de Wipe.
 * Mueve los incidentes y salidas que tuviera a la carpeta de rescate (por defecto 'Actual').
 * No permite eliminar la carpeta 'Actual'.
 */
export async function deleteIncidentsWipeFolder(folderName, fallbackFolder = DEFAULT_WIPE_FOLDER) {
    const cleanName = (folderName || '').trim();
    if (!cleanName || cleanName === DEFAULT_WIPE_FOLDER) {
        throw new Error('No es posible eliminar la carpeta base "Actual"');
    }

    // 1. Reasignar cualquier incidente que perteneciera a esta carpeta
    try {
        await supabase
            .from('incidents')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning incidents on wipe folder deletion:', err);
    }

    // 2. Reasignar cualquier salida (outing)
    try {
        await supabase
            .from('outings')
            .update({ wipe_folder: fallbackFolder })
            .eq('wipe_folder', cleanName);
    } catch (err) {
        console.error('Error reassigning outings on wipe folder deletion:', err);
    }

    // 3. Eliminar de la lista guardada
    const currentList = await getIncidentsWipeFoldersList();
    const updated = currentList.filter(f => f.toLowerCase() !== cleanName.toLowerCase());
    await saveIncidentsWipeFoldersList(updated);

    // 4. Si era la carpeta activa, restablecer a 'Actual'
    const active = await getActiveIncidentsWipeFolder();
    if (active.toLowerCase() === cleanName.toLowerCase()) {
        await setActiveIncidentsWipeFolder(DEFAULT_WIPE_FOLDER);
    }

    return updated;
}

/**
 * Mueve incidentes (seleccionados o todos) a una carpeta de Wipe destino.
 * @param {Object} options
 * @param {string[]|'all'} options.incidentIds - Array de UUIDs de incidentes o 'all'
 * @param {string} options.targetFolder - Nombre de la carpeta destino
 * @param {string} [options.sourceFolder] - Carpeta origen (si se mueven todos)
 */
export async function moveIncidentsToWipeFolder({ incidentIds, targetFolder, sourceFolder }) {
    const cleanTarget = (targetFolder || DEFAULT_WIPE_FOLDER).trim();
    if (!cleanTarget) throw new Error('Debes indicar una carpeta de destino válida');

    // Asegurarse de que la carpeta de destino esté registrada en la lista
    await createIncidentsWipeFolder(cleanTarget);

    if (Array.isArray(incidentIds) && incidentIds.length > 0) {
        // Mover incidentes seleccionados específicamente
        const { error } = await supabase
            .from('incidents')
            .update({ wipe_folder: cleanTarget })
            .in('id', incidentIds);

        if (error) throw error;
        return { movedCount: incidentIds.length, targetFolder: cleanTarget };
    } else if (incidentIds === 'all') {
        // Mover todos los incidentes y salidas de la carpeta origen
        const cleanSource = (sourceFolder || DEFAULT_WIPE_FOLDER).trim();
        let queryInc = supabase.from('incidents').update({ wipe_folder: cleanTarget });
        let queryOut = supabase.from('outings').update({ wipe_folder: cleanTarget });

        if (cleanSource === DEFAULT_WIPE_FOLDER) {
            queryInc = queryInc.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
            queryOut = queryOut.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
        } else {
            queryInc = queryInc.eq('wipe_folder', cleanSource);
            queryOut = queryOut.eq('wipe_folder', cleanSource);
        }

        const [resInc, resOut] = await Promise.all([queryInc, queryOut]);
        if (resInc.error) throw resInc.error;
        if (resOut.error) console.warn('Could not move outings:', resOut.error);

        return { movedCount: 'all', targetFolder: cleanTarget };
    }

    throw new Error('No se han seleccionado incidentes para mover');
}

/**
 * Obtiene estadísticas de incidentes agrupadas por carpeta de Wipe
 * Retorna un mapa: { [folderName]: { totalIncidents, general, linked, outings, totalAll } }
 */
export async function getIncidentsWipeFoldersStats() {
    try {
        const [incRes, outRes] = await Promise.all([
            supabase.from('incidents').select('id, wipe_folder, gang_id'),
            supabase.from('outings').select('id, wipe_folder')
        ]);

        const stats = {};

        const getFolderObj = (f) => {
            const folder = (f || '').trim() || DEFAULT_WIPE_FOLDER;
            if (!stats[folder]) {
                stats[folder] = { totalIncidents: 0, general: 0, linked: 0, outings: 0, totalAll: 0 };
            }
            return stats[folder];
        };

        (incRes.data || []).forEach(inc => {
            const obj = getFolderObj(inc.wipe_folder);
            obj.totalIncidents += 1;
            obj.totalAll += 1;
            if (inc.gang_id) {
                obj.linked += 1;
            } else {
                obj.general += 1;
            }
        });

        (outRes.data || []).forEach(out => {
            const obj = getFolderObj(out.wipe_folder);
            obj.outings += 1;
            obj.totalAll += 1;
        });

        return stats;
    } catch (err) {
        console.warn('Error fetching incidents wipe stats:', err);
        return {};
    }
}

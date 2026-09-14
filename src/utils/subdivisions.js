import { supabase } from '../supabaseClient';

export const DEFAULT_SUBDIVISIONS = [
    { id: 'default-gu', name: 'Gang Unit', abbrev: 'GU', is_default: true },
    { id: 'default-ud', name: 'Undercover Division', abbrev: 'UD', is_default: true },
    { id: 'default-gc', name: 'General Crimes', abbrev: 'GC', is_default: true },
    { id: 'default-dtp', name: 'Detective Training Program', abbrev: 'DTP', is_default: true }
];

const STORAGE_KEY = 'coordination_subdivisions_list_v2';

/**
 * Get list of all department subdivisions.
 */
export async function getSubdivisions() {
    try {
        const { data, error } = await supabase
            .from('coordination_subdivisions')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data) {
            if (data.length > 0) {
                return data;
            } else {
                // If table is empty, seed defaults
                for (const def of DEFAULT_SUBDIVISIONS) {
                    await supabase.from('coordination_subdivisions').insert([def]);
                }
                const { data: seeded } = await supabase
                    .from('coordination_subdivisions')
                    .select('*')
                    .order('created_at', { ascending: true });
                return seeded || DEFAULT_SUBDIVISIONS;
            }
        }
    } catch (err) {
        console.warn('Fallback to localStorage for subdivisions:', err);
    }

    // LocalStorage Fallback
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (e) {
        console.error('LocalStorage error:', e);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SUBDIVISIONS));
    return DEFAULT_SUBDIVISIONS;
}

/**
 * Add a new department subdivision.
 */
export async function createSubdivision(name, abbrev) {
    const cleanName = name.trim();
    const cleanAbbrev = (abbrev || cleanName.substring(0, 3)).trim().toUpperCase();

    if (!cleanName) throw new Error('El nombre de la subdivisión es obligatorio.');

    // 1. Try Supabase
    try {
        const { data, error } = await supabase
            .from('coordination_subdivisions')
            .insert([{ name: cleanName, abbrev: cleanAbbrev, is_default: false }])
            .select();

        if (!error && data && data[0]) {
            return data[0];
        }
    } catch (err) {
        console.warn('Supabase insert failed for subdivision, using localStorage:', err);
    }

    // 2. LocalStorage Fallback
    const current = await getSubdivisions();
    if (current.some(s => s.name.toLowerCase().trim() === cleanName.toLowerCase())) {
        throw new Error('Esta subdivisión ya existe.');
    }

    const newSub = { id: 'sub-' + Date.now(), name: cleanName, abbrev: cleanAbbrev, is_default: false };
    const updated = [...current, newSub];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newSub;
}

/**
 * Update an existing subdivision (name & abbreviation).
 */
export async function updateSubdivision(id, oldName, newName, newAbbrev) {
    const cleanName = (newName || oldName).trim();
    const cleanAbbrev = (newAbbrev || cleanName.substring(0, 3)).trim().toUpperCase();

    if (!cleanName) throw new Error('El nombre de la subdivisión no puede estar vacío.');

    // 1. Try Supabase
    try {
        let query = supabase.from('coordination_subdivisions').update({
            name: cleanName,
            abbrev: cleanAbbrev
        });

        if (id && !String(id).startsWith('default-') && !String(id).startsWith('sub-')) {
            query = query.eq('id', id);
        } else {
            query = query.eq('name', oldName);
        }

        const { data, error } = await query.select();
        if (!error && data) {
            return data[0] || { id, name: cleanName, abbrev: cleanAbbrev };
        }
    } catch (err) {
        console.warn('Supabase update failed for subdivision, using localStorage:', err);
    }

    // 2. LocalStorage Fallback
    const current = await getSubdivisions();
    const updated = current.map(s => {
        if (s.id === id || s.name === oldName) {
            return { ...s, name: cleanName, abbrev: cleanAbbrev };
        }
        return s;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { id, name: cleanName, abbrev: cleanAbbrev };
}

/**
 * Delete a subdivision (including default subdivisions).
 */
export async function deleteSubdivision(id, name) {
    // 1. Try Supabase
    try {
        let query = supabase.from('coordination_subdivisions').delete();
        if (id && !String(id).startsWith('default-') && !String(id).startsWith('sub-')) {
            query = query.eq('id', id);
        } else {
            query = query.eq('name', name);
        }

        const { error } = await query;
        if (!error) return true;
    } catch (err) {
        console.warn('Supabase delete failed for subdivision, using localStorage:', err);
    }

    // 2. LocalStorage Fallback
    const current = await getSubdivisions();
    const updated = current.filter(s => s.id !== id && s.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
}

/**
 * Helper to get subdivision abbreviation.
 */
export const getSubdivisionAbbrev = (subName, customList = []) => {
    if (!subName) return '';
    const match = customList.find(s => s.name.toLowerCase().trim() === subName.toLowerCase().trim());
    if (match && match.abbrev) return match.abbrev;

    switch (subName) {
        case 'Gang Unit': return 'GU';
        case 'Undercover Division': return 'UD';
        case 'General Crimes': return 'GC';
        case 'Detective Training Program': return 'DTP';
        default:
            return subName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 4);
    }
};

/**
 * Helper to get CSS class / styling key for subdivision tags.
 */
export const getSubdivisionClass = (subName) => {
    if (!subName) return 'custom';
    switch (subName) {
        case 'Gang Unit': return 'gu';
        case 'Undercover Division': return 'ud';
        case 'General Crimes': return 'gc';
        case 'Detective Training Program': return 'dtp';
        default: return 'custom';
    }
};

import { supabase } from '../supabaseClient';

export const DEFAULT_SUBDIVISIONS = [
    { id: 'default-gu', name: 'Gang Unit', abbrev: 'GU', is_default: true },
    { id: 'default-ud', name: 'Undercover Division', abbrev: 'UD', is_default: true },
    { id: 'default-gc', name: 'General Crimes', abbrev: 'GC', is_default: true },
    { id: 'default-dtp', name: 'Detective Training Program', abbrev: 'DTP', is_default: true }
];

const STORAGE_KEY = 'coordination_subdivisions_list';

/**
 * Get list of all department subdivisions.
 * Guarantees default ones are always included.
 */
export async function getSubdivisions() {
    try {
        const { data, error } = await supabase
            .from('coordination_subdivisions')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
            // Ensure defaults are present
            let result = [...data];
            DEFAULT_SUBDIVISIONS.forEach(def => {
                if (!result.some(s => s.name.toLowerCase().trim() === def.name.toLowerCase().trim())) {
                    result.push(def);
                }
            });
            return result;
        }
    } catch (err) {
        console.warn('Fallback to localStorage for subdivisions:', err);
    }

    // LocalStorage Fallback
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                let result = [...parsed];
                DEFAULT_SUBDIVISIONS.forEach(def => {
                    if (!result.some(s => s.name.toLowerCase().trim() === def.name.toLowerCase().trim())) {
                        result.push(def);
                    }
                });
                return result;
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
 * Delete a custom subdivision. Default subdivisions cannot be deleted.
 */
export async function deleteSubdivision(id, name) {
    const isDefault = DEFAULT_SUBDIVISIONS.some(d => d.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (isDefault) {
        throw new Error(`No se puede eliminar la subdivisión predeterminada '${name}'.`);
    }

    // 1. Try Supabase
    try {
        const { error } = await supabase
            .from('coordination_subdivisions')
            .delete()
            .eq('id', id);

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
            // Auto generate acronym
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

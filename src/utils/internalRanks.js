import { supabase } from '../supabaseClient';

const DEFAULT_RANK = 'Auxiliar de Investigación';
const STORAGE_KEY = 'seb_internal_ranks_list';

/**
 * Get list of internal division ranks.
 * Always guarantees 'Auxiliar de Investigación' is present as default.
 */
export async function getInternalRanks() {
    try {
        const { data, error } = await supabase
            .from('coordination_internal_ranks')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
            // Ensure default rank is present in the list
            const hasDefault = data.some(r => r.name.toLowerCase().trim() === DEFAULT_RANK.toLowerCase());
            let result = [...data];
            if (!hasDefault) {
                result.unshift({ id: 'default-1', name: DEFAULT_RANK, is_default: true });
            }
            return result;
        }
    } catch (err) {
        console.warn('Fallback to local storage for internal ranks:', err);
    }

    // Local Storage Fallback
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const hasDefault = parsed.some(r => (r.name || r).toLowerCase().trim() === DEFAULT_RANK.toLowerCase());
                if (!hasDefault) {
                    parsed.unshift({ id: 'default-1', name: DEFAULT_RANK, is_default: true });
                }
                return parsed;
            }
        }
    } catch (e) {
        console.error('LocalStorage error:', e);
    }

    // Default Initial Ranks
    const initial = [
        { id: 'default-1', name: DEFAULT_RANK, is_default: true }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
}

/**
 * Add a new internal division rank.
 */
export async function createInternalRank(rankName) {
    const cleanName = rankName.trim();
    if (!cleanName) return null;

    // 1. Try Supabase
    try {
        const { data, error } = await supabase
            .from('coordination_internal_ranks')
            .insert([{ name: cleanName }])
            .select();

        if (!error && data && data[0]) {
            return data[0];
        }
    } catch (err) {
        console.warn('Supabase insert failed, using localStorage:', err);
    }

    // 2. LocalStorage Fallback
    const current = await getInternalRanks();
    if (current.some(r => (r.name || r).toLowerCase().trim() === cleanName.toLowerCase())) {
        throw new Error('Este rango interno ya existe.');
    }

    const newRank = { id: 'rank-' + Date.now(), name: cleanName, is_default: false };
    const updated = [...current, newRank];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newRank;
}

/**
 * Delete an internal division rank.
 * Note: 'Auxiliar de Investigación' cannot be deleted.
 */
export async function deleteInternalRank(rankId, rankName) {
    if (rankName.toLowerCase().trim() === DEFAULT_RANK.toLowerCase()) {
        throw new Error("No se puede eliminar el rango predeterminado 'Auxiliar de Investigación'.");
    }

    // 1. Try Supabase
    try {
        const { error } = await supabase
            .from('coordination_internal_ranks')
            .delete()
            .eq('id', rankId);

        if (!error) return true;
    } catch (err) {
        console.warn('Supabase delete failed, using localStorage:', err);
    }

    // 2. LocalStorage Fallback
    const current = await getInternalRanks();
    const updated = current.filter(r => r.id !== rankId && r.name !== rankName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
}

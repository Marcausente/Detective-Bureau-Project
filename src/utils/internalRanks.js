import { supabase } from '../supabaseClient';

const DEFAULT_RANK = 'Auxiliar de Investigación';
const STORAGE_KEY = 'seb_internal_ranks_list';
const USER_RANKS_PREFIX = 'seb_user_rango_interno_';

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

/**
 * Get assigned internal rank for a specific user.
 * Prioritizes custom database value from Supabase, but falls back to local storage
 * if the database value is default or missing.
 */
export function getUserInternalRank(user) {
    if (!user) return DEFAULT_RANK;
    const userId = typeof user === 'object' ? user.id : user;

    // Priority 1: Non-default database property from Supabase
    if (user && typeof user === 'object' && user.rango_interno && user.rango_interno !== DEFAULT_RANK) {
        return user.rango_interno;
    }

    // Priority 2: Check localStorage for locally configured custom rank
    if (userId) {
        try {
            const saved = localStorage.getItem(USER_RANKS_PREFIX + userId);
            if (saved && saved !== DEFAULT_RANK) return saved;
        } catch (e) {
            console.error('LocalStorage read error:', e);
        }
    }

    // Priority 3: Fallback to database property (even if default) or DEFAULT_RANK
    if (user && typeof user === 'object' && user.rango_interno) {
        return user.rango_interno;
    }

    return DEFAULT_RANK;
}

/**
 * Save internal rank for a user (Supabase + LocalStorage sync).
 * Uses SECURITY DEFINER RPC to ensure Supabase database updates succeed regardless of client RLS policies.
 */
export async function setUserInternalRank(userId, rankName) {
    if (!userId) return;
    const cleanRank = rankName || DEFAULT_RANK;

    // 1. LocalStorage Sync (Instant Local Cache)
    try {
        localStorage.setItem(USER_RANKS_PREFIX + userId, cleanRank);
    } catch (e) {
        console.error('LocalStorage write error:', e);
    }

    // 2. Supabase Sync (Database persistence using RPC set_user_internal_rank)
    try {
        const { error } = await supabase.rpc('set_user_internal_rank', {
            p_user_id: userId,
            p_rango_interno: cleanRank
        });

        if (error) {
            console.warn('RPC set_user_internal_rank notice, attempting direct update:', error.message);
            await supabase
                .from('users')
                .update({ rango_interno: cleanRank })
                .eq('id', userId);
        }
    } catch (err) {
        console.warn('Supabase update for rango_interno failed:', err);
    }
}

/**
 * Auto-syncs any ranks stored in local storage to Supabase database.
 * This automatically pushes custom ranks saved locally by an admin into the Supabase users table.
 */
export async function syncLocalRanksToSupabase(users) {
    if (!Array.isArray(users) || users.length === 0) return;

    for (const u of users) {
        if (!u || !u.id) continue;
        try {
            const savedLocal = localStorage.getItem(USER_RANKS_PREFIX + u.id);
            // If local storage has a custom rank that is different from Supabase database
            if (savedLocal && savedLocal !== u.rango_interno) {
                console.log(`Auto-syncing internal rank to Supabase for user ${u.id}: ${savedLocal}`);
                await setUserInternalRank(u.id, savedLocal);
            }
        } catch (err) {
            console.warn(`Error auto-syncing rank for user ${u.id}:`, err);
        }
    }
}



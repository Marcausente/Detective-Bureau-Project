import { supabase } from '../supabaseClient';
import { fetchSanctionDurations, calculateSubjectStatus, DEFAULT_SANCTION_DURATIONS } from '../utils/sanctionConfig';

export const DEFAULT_RANKS = [
    { id: 'rank-1', name: '14. Sheriff', category: 'JEFATURA SHERIFF', order_index: 1, color: '#eab308', badge_image_url: '' },
    { id: 'rank-2', name: '13. Sheriff Adjunto', category: 'JEFATURA SHERIFF', order_index: 2, color: '#eab308', badge_image_url: '' },
    { id: 'rank-3', name: '12. Sheriff Asistente', category: 'JEFATURA SHERIFF', order_index: 3, color: '#ca8a04', badge_image_url: '' },
    { id: 'rank-4', name: '11. Division Chief', category: 'JEFATURA SHERIFF', order_index: 4, color: '#ca8a04', badge_image_url: '' },
    { id: 'rank-5', name: '10. Comandante', category: 'JEFATURA SHERIFF', order_index: 5, color: '#a16207', badge_image_url: '' },
    { id: 'rank-6', name: '09. Capitán', category: 'COMMAND', order_index: 6, color: '#3b82f6', badge_image_url: '' },
    { id: 'rank-7', name: '08. Teniente', category: 'COMMAND', order_index: 7, color: '#60a5fa', badge_image_url: '' },
    { id: 'rank-8', name: '09. Sargento II', category: 'SARGEANTS', order_index: 8, color: '#10b981', badge_image_url: '' },
    { id: 'rank-9', name: '07. Sargento', category: 'SARGEANTS', order_index: 9, color: '#34d399', badge_image_url: '' },
    { id: 'rank-10', name: '10. Detective III', category: 'DETECTIVES', order_index: 10, color: '#8b5cf6', badge_image_url: '' },
    { id: 'rank-11', name: '09. Detective II', category: 'DETECTIVES', order_index: 11, color: '#a78bfa', badge_image_url: '' },
    { id: 'rank-12', name: '08. Detective I', category: 'DETECTIVES', order_index: 12, color: '#c4b5fd', badge_image_url: '' },
    { id: 'rank-13', name: 'Oficial Master FTO', category: 'ESCALA BÁSICA', order_index: 13, color: '#06b6d4', badge_image_url: '' },
    { id: 'rank-14', name: 'Deputy Sheriff Bonus II', category: 'ESCALA BÁSICA', order_index: 14, color: '#0ea5e9', badge_image_url: '' },
    { id: 'rank-15', name: 'Deputy Sheriff Bonus I', category: 'ESCALA BÁSICA', order_index: 15, color: '#38bdf8', badge_image_url: '' },
    { id: 'rank-16', name: 'Deputy Sheriff', category: 'ESCALA BÁSICA', order_index: 16, color: '#93c5fd', badge_image_url: '' },
    { id: 'rank-17', name: 'DS Trainee', category: 'ESCALA BÁSICA', order_index: 17, color: '#94a3b8', badge_image_url: '' }
];

export const DEFAULT_DIVISIONS = [
    { id: 'div-1', name: 'TRT / SEB', short_name: 'TRT', order_index: 1, color: '#15803d', badge_image_url: '' },
    { id: 'div-2', name: 'SCUB', short_name: 'SCUB', order_index: 2, color: '#0284c7', badge_image_url: '' },
    { id: 'div-3', name: 'IAB', short_name: 'IAB', order_index: 3, color: '#b91c1c', badge_image_url: '' },
    { id: 'div-4', name: 'ASD', short_name: 'ASD', order_index: 4, color: '#4338ca', badge_image_url: '' },
    { id: 'div-5', name: 'RTB', short_name: 'RTB', order_index: 5, color: '#d97706', badge_image_url: '' },
    { id: 'div-6', name: 'SAHP', short_name: 'SAHP', order_index: 6, color: '#ea580c', badge_image_url: '' },
    { id: 'div-7', name: 'SIB', short_name: 'SIB', order_index: 7, color: '#7c3aed', badge_image_url: '' },
    { id: 'div-8', name: 'USMS', short_name: 'USMS', order_index: 8, color: '#0369a1', badge_image_url: '' },
    { id: 'div-9', name: 'DOJ', short_name: 'DOJ', order_index: 9, color: '#475569', badge_image_url: '' },
    { id: 'div-10', name: 'K9', short_name: 'K9', order_index: 10, color: '#047857', badge_image_url: '' },
    { id: 'div-11', name: 'RANGER', short_name: 'RANGER', order_index: 11, color: '#166534', badge_image_url: '' },
    { id: 'div-12', name: 'PIA', short_name: 'PIA', order_index: 12, color: '#9333ea', badge_image_url: '' },
    { id: 'div-13', name: 'SMD', short_name: 'SMD', order_index: 13, color: '#be123c', badge_image_url: '' }
];

export const INITIAL_SAMPLE_AGENTS = [];

export const DEFAULT_VALORACIONES = [
    { id: 'val-1', name: 'Ascenso', color: '#10b981', description: 'Listo para ascenso', order_index: 1 },
    { id: 'val-2', name: 'Val. Ascenso', color: '#3b82f6', description: 'En periodo de valoración', order_index: 2 },
    { id: 'val-3', name: 'Observación', color: '#f59e0b', description: 'Bajo seguimiento u observación', order_index: 3 },
    { id: 'val-4', name: 'Degrado / Falta de actividad', color: '#ef4444', description: 'Posible degradación o falta de actividad', order_index: 4 }
];

/**
 * Converts Hex color string to RGBA string with alpha transparency
 */
export function hexToRgba(hex, alpha = 0.2) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    let clean = String(hex).replace('#', '').trim();
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Helper to safely parse JSON arrays from app_settings (handles both string and native array)
 */
function parseSettingsArray(val) {
    if (!val) return null;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            console.warn('Failed to parse settings JSON string:', e);
        }
    }
    return null;
}

/**
 * Helper to test if a string is a valid UUID
 */
function isUUID(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Calculates days without promotion and assigns color indicator
 * 15 - 29 days: Green
 * 30 - 49 days: Yellow
 * 50+ days: Red
 * < 15 days: Neutral/Gray
 */
export function calculatePromotionDays(lastPromotionDate) {
    if (!lastPromotionDate) {
        return {
            days: 0,
            hasDate: false,
            colorCategory: 'none',
            bg: 'rgba(255, 255, 255, 0.04)',
            color: '#94a3b8',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            text: 'Sin fecha'
        };
    }

    let promoDate;
    if (typeof lastPromotionDate === 'string') {
        const parts = lastPromotionDate.split('T')[0].split('-');
        if (parts.length === 3) {
            promoDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            promoDate = new Date(lastPromotionDate);
        }
    } else {
        promoDate = new Date(lastPromotionDate);
    }

    if (isNaN(promoDate.getTime())) {
        return {
            days: 0,
            hasDate: false,
            colorCategory: 'none',
            bg: 'rgba(255, 255, 255, 0.04)',
            color: '#94a3b8',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            text: 'Fecha inválida'
        };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const promoDay = new Date(promoDate.getFullYear(), promoDate.getMonth(), promoDate.getDate());

    const diffMs = today.getTime() - promoDay.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    if (days >= 50) {
        return {
            days,
            hasDate: true,
            colorCategory: 'red',
            bg: 'rgba(239, 68, 68, 0.22)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            text: `${days} días (50+)`
        };
    }
    if (days >= 30) {
        return {
            days,
            hasDate: true,
            colorCategory: 'yellow',
            bg: 'rgba(245, 158, 11, 0.22)',
            color: '#fbbf24',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            text: `${days} días (30 - 49)`
        };
    }
    if (days >= 15) {
        return {
            days,
            hasDate: true,
            colorCategory: 'green',
            bg: 'rgba(16, 185, 129, 0.22)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            text: `${days} días (15 - 29)`
        };
    }

    return {
        days,
        hasDate: true,
        colorCategory: 'neutral',
        bg: 'rgba(255, 255, 255, 0.05)',
        color: '#e2e8f0',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        text: `${days} días (< 15)`
    };
}

/**
 * Fetches all Ranks (prioritizes app_settings for full custom order and reliable editing)
 */
export async function fetchPlantillaRanks() {
    try {
        // 1. Check app_settings FIRST as primary source of truth
        const { data: appData, error: appError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'plantilla_ranks')
            .maybeSingle();

        if (!appError && appData) {
            const parsed = parseSettingsArray(appData.value);
            if (parsed !== null && parsed.length > 0) {
                return parsed.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
        }

        // 2. Fallback to plantilla_ranks table
        const { data, error } = await supabase
            .from('plantilla_ranks')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            return data;
        }

        return DEFAULT_RANKS;
    } catch (err) {
        console.warn('fetchPlantillaRanks fallback:', err);
        return DEFAULT_RANKS;
    }
}

/**
 * Saves (Insert or Update) a Rank
 */
export async function savePlantillaRank(rankData) {
    try {
        const rankId = rankData.id && isUUID(rankData.id) ? rankData.id : (rankData.id || crypto.randomUUID());
        const payload = {
            id: rankId,
            name: rankData.name.trim(),
            category: rankData.category?.trim() || 'General',
            badge_image_url: rankData.badge_image_url || '',
            color: rankData.color || '#3b82f6',
            order_index: Number(rankData.order_index) || 1,
            updated_at: new Date().toISOString()
        };

        const finalRank = { ...rankData, ...payload };

        // 1. Save directly into app_settings as primary store
        try {
            const currentRanks = await fetchPlantillaRanks();
            const existingIndex = currentRanks.findIndex(r => r.id === finalRank.id || (r.name && r.name.trim().toLowerCase() === finalRank.name.toLowerCase()));
            let updatedList;
            if (existingIndex >= 0) {
                updatedList = [...currentRanks];
                updatedList[existingIndex] = { ...updatedList[existingIndex], ...finalRank };
            } else {
                updatedList = [...currentRanks, finalRank];
            }

            updatedList = updatedList
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((r, i) => ({ ...r, order_index: i + 1 }));

            const { error: appErr } = await supabase.from('app_settings').upsert({
                key: 'plantilla_ranks',
                value: JSON.stringify(updatedList),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

            if (appErr) {
                console.error('Error saving ranks to app_settings:', appErr);
                throw appErr;
            }
        } catch (e) {
            console.error('app_settings ranks save error:', e);
            throw e;
        }

        // 2. Safe background attempt to mirror to Postgres plantilla_ranks table
        if (isUUID(finalRank.id)) {
            supabase
                .from('plantilla_ranks')
                .upsert({
                    id: finalRank.id,
                    name: finalRank.name,
                    category: finalRank.category,
                    badge_image_url: finalRank.badge_image_url,
                    color: finalRank.color,
                    order_index: finalRank.order_index,
                    updated_at: finalRank.updated_at
                })
                .then(() => {})
                .catch(e => console.warn('DB rank mirror warning:', e));
        }

        return finalRank;
    } catch (err) {
        console.error('Error in savePlantillaRank:', err);
        throw err;
    }
}

/**
 * Deletes a Rank
 */
export async function deletePlantillaRank(rankId) {
    try {
        const currentRanks = await fetchPlantillaRanks();
        const updated = currentRanks
            .filter(r => r.id !== rankId)
            .map((r, i) => ({ ...r, order_index: i + 1 }));

        const { error: appErr } = await supabase.from('app_settings').upsert({
            key: 'plantilla_ranks',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (appErr) {
            console.error('Error deleting rank from app_settings:', appErr);
            throw appErr;
        }

        if (isUUID(rankId)) {
            supabase
                .from('plantilla_ranks')
                .delete()
                .eq('id', rankId)
                .then(() => {})
                .catch(e => console.warn('DB delete rank warning:', e));
        }

        return true;
    } catch (err) {
        console.error('Error in deletePlantillaRank:', err);
        throw err;
    }
}

/**
 * Reorders Ranks
 */
export async function updateRanksOrder(reorderedRanks) {
    try {
        const updates = reorderedRanks.map((r, index) => ({
            ...r,
            order_index: index + 1
        }));

        const { error: appErr } = await supabase.from('app_settings').upsert({
            key: 'plantilla_ranks',
            value: JSON.stringify(updates),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (appErr) {
            console.error('Error updating ranks order in app_settings:', appErr);
            throw appErr;
        }

        // Background update Postgres for rows with UUIDs
        for (const item of updates) {
            if (isUUID(item.id)) {
                supabase
                    .from('plantilla_ranks')
                    .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
                    .eq('id', item.id)
                    .then(() => {})
                    .catch(() => {});
            }
        }

        return updates;
    } catch (err) {
        console.error('Error in updateRanksOrder:', err);
        throw err;
    }
}

/**
 * Fetches all Divisions (prioritizes app_settings for custom divisions)
 */
export async function fetchPlantillaDivisions() {
    try {
        // 1. Check app_settings FIRST as primary source of truth
        const { data: appData, error: appError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'plantilla_divisions')
            .maybeSingle();

        if (!appError && appData) {
            const parsed = parseSettingsArray(appData.value);
            if (parsed !== null && parsed.length > 0) {
                return parsed.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
        }

        // 2. Fallback to plantilla_divisions table
        const { data, error } = await supabase
            .from('plantilla_divisions')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            return data;
        }

        return DEFAULT_DIVISIONS;
    } catch (err) {
        console.warn('fetchPlantillaDivisions fallback:', err);
        return DEFAULT_DIVISIONS;
    }
}

/**
 * Saves (Insert or Update) a Division
 */
export async function savePlantillaDivision(divData) {
    try {
        const divId = divData.id && isUUID(divData.id) ? divData.id : (divData.id || crypto.randomUUID());
        const payload = {
            id: divId,
            name: divData.name.trim(),
            short_name: divData.short_name?.trim() || divData.name.trim().substring(0, 5),
            badge_image_url: divData.badge_image_url || '',
            color: divData.color || '#10b981',
            order_index: Number(divData.order_index) || 1,
            updated_at: new Date().toISOString()
        };

        const finalDiv = { ...divData, ...payload };

        // 1. Update app_settings first as primary store
        try {
            const currentDivisions = await fetchPlantillaDivisions();
            const existingIndex = currentDivisions.findIndex(d => d.id === finalDiv.id || (d.name && d.name.trim().toLowerCase() === finalDiv.name.toLowerCase()));
            let updatedList;
            if (existingIndex >= 0) {
                updatedList = [...currentDivisions];
                updatedList[existingIndex] = { ...updatedList[existingIndex], ...finalDiv };
            } else {
                updatedList = [...currentDivisions, finalDiv];
            }

            updatedList = updatedList
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((d, i) => ({ ...d, order_index: i + 1 }));

            const { error: appErr } = await supabase.from('app_settings').upsert({
                key: 'plantilla_divisions',
                value: JSON.stringify(updatedList),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

            if (appErr) {
                console.error('Error saving division to app_settings:', appErr);
                throw appErr;
            }
        } catch (e) {
            console.error('app_settings divisions save error:', e);
            throw e;
        }

        // 2. Background mirror to Postgres
        if (isUUID(finalDiv.id)) {
            supabase
                .from('plantilla_divisions')
                .upsert({
                    id: finalDiv.id,
                    name: finalDiv.name,
                    short_name: finalDiv.short_name,
                    badge_image_url: finalDiv.badge_image_url,
                    color: finalDiv.color,
                    order_index: finalDiv.order_index,
                    updated_at: finalDiv.updated_at
                })
                .then(() => {})
                .catch(e => console.warn('DB division mirror warning:', e));
        }

        return finalDiv;
    } catch (err) {
        console.error('Error in savePlantillaDivision:', err);
        throw err;
    }
}

/**
 * Deletes a Division
 */
export async function deletePlantillaDivision(divisionId) {
    try {
        const currentDivisions = await fetchPlantillaDivisions();
        const updated = currentDivisions
            .filter(d => d.id !== divisionId)
            .map((d, i) => ({ ...d, order_index: i + 1 }));

        const { error: appErr } = await supabase.from('app_settings').upsert({
            key: 'plantilla_divisions',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (appErr) throw appErr;

        if (isUUID(divisionId)) {
            supabase
                .from('plantilla_divisions')
                .delete()
                .eq('id', divisionId)
                .then(() => {})
                .catch(e => console.warn('DB delete division warning:', e));
        }
        return true;
    } catch (err) {
        console.error('Error in deletePlantillaDivision:', err);
        throw err;
    }
}

/**
 * Reorders Divisions
 */
export async function updateDivisionsOrder(reorderedDivisions) {
    try {
        const updates = reorderedDivisions.map((d, index) => ({
            ...d,
            order_index: index + 1
        }));

        const { error: appErr } = await supabase.from('app_settings').upsert({
            key: 'plantilla_divisions',
            value: JSON.stringify(updates),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (appErr) throw appErr;

        for (const item of updates) {
            if (isUUID(item.id)) {
                supabase
                    .from('plantilla_divisions')
                    .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
                    .eq('id', item.id)
                    .then(() => {})
                    .catch(() => {});
            }
        }

        return updates;
    } catch (err) {
        console.error('Error in updateDivisionsOrder:', err);
        throw err;
    }
}

/**
 * Fetches all Agents in the Plantilla (prioritizes app_settings for full divider and custom order support)
 */
export async function fetchPlantillaAgents() {
    try {
        // 1. Check app_settings FIRST as primary source of truth for full roster with dividers
        const { data: appData, error: appError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'plantilla_agents')
            .maybeSingle();

        if (!appError && appData) {
            const parsed = parseSettingsArray(appData.value);
            if (parsed !== null && parsed.length > 0) {
                return parsed.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
        }

        // 2. Fallback to plantilla_agents table if app_settings is empty
        const { data, error } = await supabase
            .from('plantilla_agents')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            return data.map(item => {
                if (item.is_divider) {
                    return {
                        ...item,
                        is_divider: true,
                        title: item.divider_title || item.title || item.nombre,
                        color: item.divider_color || item.color || '#3b82f6',
                        icon: item.divider_icon || item.icon || '📁'
                    };
                }
                if (item.notes && typeof item.notes === 'string' && item.notes.startsWith('{"is_divider":true')) {
                    try {
                        const meta = JSON.parse(item.notes);
                        return {
                            ...item,
                            is_divider: true,
                            title: meta.title || item.nombre,
                            color: meta.color || '#3b82f6',
                            icon: meta.icon || '📁'
                        };
                    } catch (e) { /* ignore */ }
                }
                return item;
            });
        }

        return [];
    } catch (err) {
        console.warn('fetchPlantillaAgents fallback:', err);
        return [];
    }
}

/**
 * Saves (Insert or Update) an Agent or Divider in Plantilla
 */
export async function savePlantillaAgent(agentData) {
    try {
        const agentId = agentData.id && isUUID(agentData.id) ? agentData.id : (agentData.id || crypto.randomUUID());
        const isDivider = Boolean(agentData.is_divider);
        const dividerTitle = (agentData.title || agentData.divider_title || agentData.nombre || '').trim().toUpperCase();
        const dividerColor = agentData.color || agentData.divider_color || '#3b82f6';
        const dividerIcon = agentData.icon || agentData.divider_icon || '📁';

        const finalAgent = {
            ...agentData,
            id: agentId,
            username: isDivider ? '' : (agentData.username || '').trim(),
            email: isDivider ? '' : (agentData.email || '').trim(),
            nombre: isDivider ? dividerTitle : (agentData.nombre || '').trim(),
            apellido: isDivider ? '' : (agentData.apellido || '').trim(),
            no_placa: isDivider ? '' : (agentData.no_placa || '').trim(),
            rank_id: isDivider ? null : (agentData.rank_id || null),
            rank_name: isDivider ? '' : (agentData.rank_name || '').trim(),
            divisions: isDivider ? [] : (Array.isArray(agentData.divisions) ? agentData.divisions : []),
            activity_status: isDivider ? 'Activo' : (agentData.activity_status || 'Activo'),
            valoracion: isDivider ? '' : (agentData.valoracion || '').trim(),
            last_promotion_date: isDivider ? null : (agentData.last_promotion_date || null),
            notes: isDivider ? JSON.stringify({ is_divider: true, title: dividerTitle, color: dividerColor, icon: dividerIcon }) : (agentData.notes || '').trim(),
            avatar_url: isDivider ? '' : (agentData.avatar_url || ''),
            order_index: Number(agentData.order_index) || 0,
            is_placeholder: isDivider ? true : Boolean(agentData.is_placeholder),
            is_divider: isDivider,
            title: isDivider ? dividerTitle : undefined,
            color: isDivider ? dividerColor : undefined,
            icon: isDivider ? dividerIcon : undefined,
            updated_at: new Date().toISOString()
        };

        // 1. Save directly into app_settings as primary robust store
        try {
            const allAgents = await fetchPlantillaAgents();
            const existingIndex = allAgents.findIndex(a => a.id === finalAgent.id);
            let updatedList;
            if (existingIndex >= 0) {
                updatedList = [...allAgents];
                updatedList[existingIndex] = finalAgent;
            } else {
                updatedList = [...allAgents, finalAgent];
            }
            await supabase.from('app_settings').upsert({
                key: 'plantilla_agents',
                value: JSON.stringify(updatedList),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (e) {
            console.warn('app_settings agents mirror warning:', e);
        }

        // 2. Safe background attempt to mirror into Postgres plantilla_agents table (without invalid columns)
        if (isUUID(agentId)) {
            const dbPayload = {
                id: finalAgent.id,
                username: finalAgent.username,
                email: finalAgent.email,
                nombre: finalAgent.nombre,
                apellido: finalAgent.apellido,
                no_placa: finalAgent.no_placa,
                rank_id: finalAgent.rank_id,
                rank_name: finalAgent.rank_name,
                divisions: finalAgent.divisions,
                activity_status: finalAgent.activity_status,
                last_promotion_date: finalAgent.last_promotion_date,
                notes: finalAgent.notes,
                avatar_url: finalAgent.avatar_url,
                order_index: finalAgent.order_index,
                is_placeholder: finalAgent.is_placeholder,
                updated_at: finalAgent.updated_at
            };
            try {
                await supabase.from('plantilla_agents').upsert(dbPayload);
            } catch (e) {
                console.warn('DB upsert agent mirror warning:', e);
            }
        }

        return finalAgent;
    } catch (err) {
        console.error('Error in savePlantillaAgent:', err);
        throw err;
    }
}

/**
 * Saves a Divider row in Plantilla
 */
export async function savePlantillaDivider(dividerData) {
    return savePlantillaAgent({
        ...dividerData,
        is_divider: true,
        title: (dividerData.title || dividerData.nombre || 'SECCIÓN').trim().toUpperCase(),
        color: dividerData.color || '#3b82f6',
        icon: dividerData.icon || '📁'
    });
}

/**
 * Deletes an Agent or Divider from Plantilla
 */
export async function deletePlantillaAgent(agentId) {
    try {
        if (isUUID(agentId)) {
            try {
                await supabase.from('plantilla_agents').delete().eq('id', agentId);
            } catch (e) {
                console.warn('DB delete agent warning:', e);
            }
        }
        const agents = await fetchPlantillaAgents();
        const updated = agents.filter(a => a.id !== agentId);
        await supabase.from('app_settings').upsert({
            key: 'plantilla_agents',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        return true;
    } catch (err) {
        console.error('Error in deletePlantillaAgent:', err);
        throw err;
    }
}

export const deletePlantillaDivider = deletePlantillaAgent;

/**
 * Updates agents order
 */
export async function updateAgentsOrder(reorderedAgents) {
    try {
        const updates = reorderedAgents.map((agent, index) => ({
            ...agent,
            order_index: index + 1
        }));

        // Always save to app_settings as primary store
        const { error: appErr } = await supabase.from('app_settings').upsert({
            key: 'plantilla_agents',
            value: JSON.stringify(updates),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        if (appErr) {
            console.warn('app_settings updateAgentsOrder warning:', appErr);
        }

        // Background sync to Postgres table if rows have UUIDs
        for (const item of updates) {
            if (isUUID(item.id)) {
                supabase
                    .from('plantilla_agents')
                    .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
                    .eq('id', item.id)
                    .then(() => {})
                    .catch(() => {});
            }
        }

        return updates;
    } catch (err) {
        console.error('Error in updateAgentsOrder:', err);
        throw err;
    }
}

/**
 * Fetches all Valoraciones / Acotaciones
 */
export async function fetchPlantillaValoraciones() {
    try {
        const { data: appData, error: appError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'plantilla_valoraciones')
            .maybeSingle();

        if (!appError && appData) {
            const parsed = parseSettingsArray(appData.value);
            if (parsed !== null && parsed.length > 0) {
                return parsed.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
        }

        return DEFAULT_VALORACIONES;
    } catch (err) {
        console.warn('fetchPlantillaValoraciones fallback:', err);
        return DEFAULT_VALORACIONES;
    }
}

/**
 * Saves (Insert or Update) a Valoracion / Acotacion
 */
export async function savePlantillaValoracion(valData) {
    try {
        const valId = valData.id || crypto.randomUUID();
        const payload = {
            id: valId,
            name: valData.name.trim(),
            color: valData.color || '#10b981',
            description: (valData.description || '').trim(),
            order_index: Number(valData.order_index) || 1,
            updated_at: new Date().toISOString()
        };

        const list = await fetchPlantillaValoraciones();
        const existingIndex = list.findIndex(v => v.id === payload.id);
        let updatedList;
        if (existingIndex >= 0) {
            updatedList = [...list];
            updatedList[existingIndex] = payload;
        } else {
            updatedList = [...list, payload];
        }

        await supabase.from('app_settings').upsert({
            key: 'plantilla_valoraciones',
            value: JSON.stringify(updatedList),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        return payload;
    } catch (err) {
        console.error('Error in savePlantillaValoracion:', err);
        throw err;
    }
}

/**
 * Deletes a Valoracion / Acotacion
 */
export async function deletePlantillaValoracion(valId) {
    try {
        const list = await fetchPlantillaValoraciones();
        const updated = list.filter(v => v.id !== valId);
        await supabase.from('app_settings').upsert({
            key: 'plantilla_valoraciones',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        return true;
    } catch (err) {
        console.error('Error in deletePlantillaValoracion:', err);
        throw err;
    }
}

/**
 * Updates order of Valoraciones / Acotaciones
 */
export async function updateValoracionesOrder(reordered) {
    try {
        const updates = reordered.map((item, index) => ({
            ...item,
            order_index: index + 1
        }));

        await supabase.from('app_settings').upsert({
            key: 'plantilla_valoraciones',
            value: JSON.stringify(updates),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        return updates;
    } catch (err) {
        console.error('Error in updateValoracionesOrder:', err);
        throw err;
    }
}

/**
 * Sorts agents hierarchically based on ranks order_index
 */
export function sortAgentsByRankHierarchy(agents, ranks) {
    const rankOrderMap = {};
    ranks.forEach(r => {
        rankOrderMap[r.name.trim().toLowerCase()] = r.order_index;
    });

    const sortSubgroup = (group) => {
        return [...group].sort((a, b) => {
            const rankA = (a.rank_name || '').trim().toLowerCase();
            const rankB = (b.rank_name || '').trim().toLowerCase();
            const orderA = rankOrderMap[rankA] !== undefined ? rankOrderMap[rankA] : 999;
            const orderB = rankOrderMap[rankB] !== undefined ? rankOrderMap[rankB] : 999;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            // Secondary sort: Placa numerical ascending
            const placaA = parseInt(a.no_placa, 10);
            const placaB = parseInt(b.no_placa, 10);
            if (!isNaN(placaA) && !isNaN(placaB)) {
                return placaA - placaB;
            }

            // Fallback: Apellido, Nombre
            const nameA = `${a.apellido || ''} ${a.nombre || ''}`.trim().toLowerCase();
            const nameB = `${b.apellido || ''} ${b.nombre || ''}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });
    };

    // If there are dividers, sort agents within their respective sections
    const hasDividers = agents.some(a => a.is_divider);
    if (!hasDividers) {
        return sortSubgroup(agents).map((a, index) => ({ ...a, order_index: index + 1 }));
    }

    const result = [];
    let currentSection = [];

    agents.forEach(item => {
        if (item.is_divider) {
            if (currentSection.length > 0) {
                result.push(...sortSubgroup(currentSection));
                currentSection = [];
            }
            result.push(item);
        } else {
            currentSection.push(item);
        }
    });

    if (currentSection.length > 0) {
        result.push(...sortSubgroup(currentSection));
    }

    return result.map((a, index) => ({ ...a, order_index: index + 1 }));
}

/**
 * Fetches all IA Subject Profiles and active sanctions map
 * Returns maps to look up active sanction info by:
 * 1) plantilla_agent_id
 * 2) no_placa
 * 3) fullName (lowercase)
 */
export async function fetchActiveIASanctionsMap() {
    try {
        const durations = await fetchSanctionDurations();
        let profiles = [];

        // Try getting full profiles with sanctions
        const { data: directData, error: directError } = await supabase
            .from('ia_subject_profiles')
            .select(`
                id,
                nombre,
                apellido,
                no_placa,
                plantilla_agent_id,
                ia_sanctions (
                    id,
                    sanction_type,
                    sanction_date,
                    description,
                    created_at,
                    is_sargentos
                )
            `);

        if (!directError && directData) {
            profiles = directData.map(p => ({
                ...p,
                sanctions: p.ia_sanctions || []
            }));
        }

        const byAgentId = {};
        const byPlaca = {};
        const byFullName = {};

        profiles.forEach(p => {
            const status = calculateSubjectStatus(p, durations);
            const entry = {
                profileId: p.id,
                nombre: p.nombre,
                apellido: p.apellido,
                no_placa: p.no_placa,
                status,
                hasActive: status.hasActive,
                activeCount: status.activeCount,
                latestExpiryDateFormatted: status.latestExpiryDateFormatted,
                maxDaysRemaining: status.maxDaysRemaining,
                mostSevereActive: status.mostSevereActive,
                activeSanctions: status.activeSanctions || []
            };

            if (p.plantilla_agent_id) {
                byAgentId[p.plantilla_agent_id] = entry;
            }

            if (p.no_placa && p.no_placa.trim()) {
                byPlaca[p.no_placa.trim().toLowerCase()] = entry;
            }

            const fullName = `${p.nombre || ''} ${p.apellido || ''}`.trim().toLowerCase();
            if (fullName) {
                byFullName[fullName] = entry;
            }
        });

        return {
            byAgentId,
            byPlaca,
            byFullName,
            durations,
            getAgentStatus: (agent) => {
                if (!agent) return { hasActive: false, activeCount: 0 };
                // 1. Check by plantilla_agent_id
                if (agent.id && byAgentId[agent.id]) {
                    return byAgentId[agent.id];
                }
                // 2. Check by no_placa
                if (agent.no_placa && byPlaca[agent.no_placa.trim().toLowerCase()]) {
                    return byPlaca[agent.no_placa.trim().toLowerCase()];
                }
                // 3. Check by Name + Surname
                const agentFull = `${agent.nombre || ''} ${agent.apellido || ''}`.trim().toLowerCase();
                if (agentFull && byFullName[agentFull]) {
                    return byFullName[agentFull];
                }
                // Also check surname + name inverted
                const inverted = `${agent.apellido || ''} ${agent.nombre || ''}`.trim().toLowerCase();
                if (inverted && byFullName[inverted]) {
                    return byFullName[inverted];
                }
                return { hasActive: false, activeCount: 0 };
            }
        };
    } catch (err) {
        console.warn('fetchActiveIASanctionsMap warning:', err);
        return {
            byAgentId: {},
            byPlaca: {},
            byFullName: {},
            durations: DEFAULT_SANCTION_DURATIONS,
            getAgentStatus: () => ({ hasActive: false, activeCount: 0 })
        };
    }
}


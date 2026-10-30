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
 * Fetches all Ranks
 */
export async function fetchPlantillaRanks() {
    try {
        const { data, error } = await supabase
            .from('plantilla_ranks')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            return data;
        }

        // Fallback to app_settings
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
        let savedRank = null;
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

        if (isUUID(rankData.id)) {
            try {
                const { data, error } = await supabase
                    .from('plantilla_ranks')
                    .update(payload)
                    .eq('id', rankData.id)
                    .select()
                    .maybeSingle();
                if (!error && data) savedRank = data;
            } catch (e) {
                console.warn('DB update rank warning:', e);
            }
        }

        if (!savedRank && isUUID(rankId)) {
            try {
                const { data, error } = await supabase
                    .from('plantilla_ranks')
                    .insert([payload])
                    .select()
                    .maybeSingle();
                if (!error && data) savedRank = data;
            } catch (e) {
                console.warn('DB insert rank warning:', e);
            }
        }

        const finalRank = savedRank || { ...rankData, ...payload };

        // Also update in app_settings fallback
        try {
            const ranks = await fetchPlantillaRanks();
            const existingIndex = ranks.findIndex(r => r.id === finalRank.id);
            let updatedList;
            if (existingIndex >= 0) {
                updatedList = [...ranks];
                updatedList[existingIndex] = finalRank;
            } else {
                updatedList = [...ranks, finalRank];
            }
            await supabase.from('app_settings').upsert({
                key: 'plantilla_ranks',
                value: JSON.stringify(updatedList),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (e) {
            console.warn('app_settings ranks mirror warning:', e);
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
        if (isUUID(rankId)) {
            try {
                await supabase.from('plantilla_ranks').delete().eq('id', rankId);
            } catch (e) {
                console.warn('DB delete rank warning:', e);
            }
        }
        // Update app_settings
        const ranks = await fetchPlantillaRanks();
        const updated = ranks.filter(r => r.id !== rankId);
        await supabase.from('app_settings').upsert({
            key: 'plantilla_ranks',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
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

        for (const item of updates) {
            if (isUUID(item.id)) {
                try {
                    await supabase
                        .from('plantilla_ranks')
                        .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
                        .eq('id', item.id);
                } catch (e) {
                    console.warn('DB update order rank warning:', e);
                }
            }
        }

        await supabase.from('app_settings').upsert({
            key: 'plantilla_ranks',
            value: JSON.stringify(updates),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        return updates;
    } catch (err) {
        console.error('Error in updateRanksOrder:', err);
        throw err;
    }
}

/**
 * Fetches all Divisions
 */
export async function fetchPlantillaDivisions() {
    try {
        const { data, error } = await supabase
            .from('plantilla_divisions')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            return data;
        }

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
        let saved = null;
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

        if (isUUID(divData.id)) {
            try {
                const { data, error } = await supabase
                    .from('plantilla_divisions')
                    .update(payload)
                    .eq('id', divData.id)
                    .select()
                    .maybeSingle();
                if (!error && data) saved = data;
            } catch (e) {
                console.warn('DB update division warning:', e);
            }
        }

        if (!saved && isUUID(divId)) {
            try {
                const { data, error } = await supabase
                    .from('plantilla_divisions')
                    .insert([payload])
                    .select()
                    .maybeSingle();
                if (!error && data) saved = data;
            } catch (e) {
                console.warn('DB insert division warning:', e);
            }
        }

        const finalDiv = saved || { ...divData, ...payload };

        // Update app_settings
        try {
            const divisions = await fetchPlantillaDivisions();
            const existingIndex = divisions.findIndex(d => d.id === finalDiv.id);
            let updatedList;
            if (existingIndex >= 0) {
                updatedList = [...divisions];
                updatedList[existingIndex] = finalDiv;
            } else {
                updatedList = [...divisions, finalDiv];
            }
            await supabase.from('app_settings').upsert({
                key: 'plantilla_divisions',
                value: JSON.stringify(updatedList),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (e) {
            console.warn('app_settings divisions mirror warning:', e);
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
        if (isUUID(divisionId)) {
            try {
                await supabase.from('plantilla_divisions').delete().eq('id', divisionId);
            } catch (e) {
                console.warn('DB delete division warning:', e);
            }
        }
        const divisions = await fetchPlantillaDivisions();
        const updated = divisions.filter(d => d.id !== divisionId);
        await supabase.from('app_settings').upsert({
            key: 'plantilla_divisions',
            value: JSON.stringify(updated),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        return true;
    } catch (err) {
        console.error('Error in deletePlantillaDivision:', err);
        throw err;
    }
}

/**
 * Fetches all Agents in the Plantilla
 */
export async function fetchPlantillaAgents() {
    try {
        const { data, error } = await supabase
            .from('plantilla_agents')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data && data.length > 0) {
            return data;
        }

        const { data: appData, error: appError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'plantilla_agents')
            .maybeSingle();

        if (!appError && appData) {
            const parsed = parseSettingsArray(appData.value);
            if (parsed !== null) {
                return parsed.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
        }

        return [];
    } catch (err) {
        console.warn('fetchPlantillaAgents fallback:', err);
        return [];
    }
}

/**
 * Saves (Insert or Update) an Agent in Plantilla
 */
export async function savePlantillaAgent(agentData) {
    try {
        let saved = null;
        const agentId = agentData.id && isUUID(agentData.id) ? agentData.id : (agentData.id || crypto.randomUUID());
        const payload = {
            id: agentId,
            username: (agentData.username || '').trim(),
            email: (agentData.email || '').trim(),
            nombre: (agentData.nombre || '').trim(),
            apellido: (agentData.apellido || '').trim(),
            no_placa: (agentData.no_placa || '').trim(),
            rank_id: agentData.rank_id || null,
            rank_name: (agentData.rank_name || '').trim(),
            divisions: Array.isArray(agentData.divisions) ? agentData.divisions : [],
            activity_status: agentData.activity_status || 'Activo',
            last_promotion_date: agentData.last_promotion_date || null,
            notes: (agentData.notes || '').trim(),
            avatar_url: agentData.avatar_url || '',
            order_index: Number(agentData.order_index) || 0,
            is_placeholder: Boolean(agentData.is_placeholder),
            updated_at: new Date().toISOString()
        };

        if (isUUID(agentData.id)) {
            try {
                const { data, error } = await supabase
                    .from('plantilla_agents')
                    .update(payload)
                    .eq('id', agentData.id)
                    .select()
                    .maybeSingle();
                if (!error && data) saved = data;
            } catch (e) {
                console.warn('DB update agent warning:', e);
            }
        }

        if (!saved && isUUID(agentId)) {
            try {
                const { data, error } = await supabase
                    .from('plantilla_agents')
                    .insert([payload])
                    .select()
                    .maybeSingle();
                if (!error && data) saved = data;
            } catch (e) {
                console.warn('DB insert agent warning:', e);
            }
        }

        const finalAgent = saved || { ...agentData, ...payload };

        // Mirror in app_settings
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

        return finalAgent;
    } catch (err) {
        console.error('Error in savePlantillaAgent:', err);
        throw err;
    }
}

/**
 * Deletes an Agent from Plantilla
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

/**
 * Updates agents order
 */
export async function updateAgentsOrder(reorderedAgents) {
    try {
        const updates = reorderedAgents.map((agent, index) => ({
            ...agent,
            order_index: index + 1
        }));

        for (const item of updates) {
            if (isUUID(item.id)) {
                try {
                    await supabase
                        .from('plantilla_agents')
                        .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
                        .eq('id', item.id);
                } catch (e) {
                    console.warn('DB update agent order warning:', e);
                }
            }
        }

        await supabase.from('app_settings').upsert({
            key: 'plantilla_agents',
            value: JSON.stringify(updates),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

        return updates;
    } catch (err) {
        console.error('Error in updateAgentsOrder:', err);
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

    const sorted = [...agents].sort((a, b) => {
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

    return sorted.map((a, index) => ({ ...a, order_index: index + 1 }));
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


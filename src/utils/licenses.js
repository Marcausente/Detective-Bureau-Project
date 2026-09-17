import { supabase } from '../supabaseClient';

export const DEFAULT_LICENSES = [
    {
        id: 'default-lic-fx',
        name: 'Licencia de Foxtrot',
        code: 'FX',
        description: 'Habilitación para conducción y maniobras de persecución avanzada en unidad Foxtrot.',
        color: '#10b981',
        icon: '🚗',
        is_default: true
    },
    {
        id: 'default-lic-mk',
        name: 'Licencia de Mike',
        code: 'MK',
        description: 'Habilitación para patrullaje, persecución e intervención en unidad motocicleta (Mike).',
        color: '#f59e0b',
        icon: '🏍️',
        is_default: true
    },
    {
        id: 'default-lic-air',
        name: 'Licencia de Aire / Piloto',
        code: 'AIR',
        description: 'Habilitación de vuelo y operaciones tácticas en unidades aéreas del Departamento.',
        color: '#06b6d4',
        icon: '🚁',
        is_default: false
    },
    {
        id: 'default-lic-k9',
        name: 'Licencia K-9 (Canina)',
        code: 'K9',
        description: 'Habilitación y acreditación para el adiestramiento y despliegue de unidad canina K-9.',
        color: '#a855f7',
        icon: '🐕',
        is_default: false
    },
    {
        id: 'default-lic-tac',
        name: 'Licencia Táctica Especial',
        code: 'TAC',
        description: 'Habilitación para porte de armamento especial y tácticas de asalto.',
        color: '#ef4444',
        icon: '🎯',
        is_default: false
    }
];

const STORAGE_KEY = 'coordination_licenses_list_v1';
const USER_LICENSES_PREFIX = 'user_licenses_';

/**
 * Get list of all department licenses.
 */
export async function getLicenses() {
    try {
        const { data, error } = await supabase
            .from('coordination_licenses')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data) {
            if (data.length > 0) {
                return data;
            } else {
                // If table is empty, seed defaults
                for (const def of DEFAULT_LICENSES) {
                    await supabase.from('coordination_licenses').insert([{
                        name: def.name,
                        code: def.code,
                        description: def.description,
                        color: def.color,
                        icon: def.icon,
                        is_default: def.is_default
                    }]);
                }
                const { data: seeded } = await supabase
                    .from('coordination_licenses')
                    .select('*')
                    .order('created_at', { ascending: true });
                return seeded || DEFAULT_LICENSES;
            }
        }
    } catch (err) {
        console.warn('Fallback to localStorage for licenses:', err);
    }

    // LocalStorage Fallback
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error('LocalStorage error for licenses:', e);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LICENSES));
    return DEFAULT_LICENSES;
}

/**
 * Add a new department license.
 */
export async function createLicense({ name, code, description, color, icon }) {
    const cleanName = name?.trim();
    const cleanCode = (code || cleanName?.substring(0, 3) || 'LIC').trim().toUpperCase();
    const cleanDesc = description?.trim() || '';
    const cleanColor = color || '#10b981';
    const cleanIcon = icon || '🪪';

    if (!cleanName) throw new Error('El nombre de la licencia es obligatorio.');

    // 1. Try Supabase
    try {
        const { data, error } = await supabase
            .from('coordination_licenses')
            .insert([{
                name: cleanName,
                code: cleanCode,
                description: cleanDesc,
                color: cleanColor,
                icon: cleanIcon,
                is_default: false
            }])
            .select();

        if (!error && data && data[0]) {
            return data[0];
        }
    } catch (err) {
        console.warn('Supabase insert failed for license, using localStorage fallback:', err);
    }

    // 2. Fallback to localStorage
    const current = await getLicenses();
    if (current.some(l => l.name.toLowerCase().trim() === cleanName.toLowerCase())) {
        throw new Error('Ya existe una licencia con este nombre.');
    }

    const newLicense = {
        id: `lic-custom-${Date.now()}`,
        name: cleanName,
        code: cleanCode,
        description: cleanDesc,
        color: cleanColor,
        icon: cleanIcon,
        is_default: false,
        created_at: new Date().toISOString()
    };

    const updated = [...current, newLicense];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newLicense;
}

/**
 * Update an existing license.
 */
export async function updateLicense(id, oldName, { name, code, description, color, icon }) {
    const cleanName = name?.trim();
    const cleanCode = (code || cleanName?.substring(0, 3) || 'LIC').trim().toUpperCase();
    const cleanDesc = description?.trim() || '';
    const cleanColor = color || '#10b981';
    const cleanIcon = icon || '🪪';

    if (!cleanName) throw new Error('El nombre de la licencia es obligatorio.');

    // 1. Try Supabase update
    try {
        let query = supabase.from('coordination_licenses').update({
            name: cleanName,
            code: cleanCode,
            description: cleanDesc,
            color: cleanColor,
            icon: cleanIcon
        });

        if (id && !id.startsWith('default-') && !id.startsWith('lic-custom-')) {
            query = query.eq('id', id);
        } else {
            query = query.eq('name', oldName);
        }

        const { error } = await query;
        if (error) console.warn('Supabase license update error:', error);
    } catch (err) {
        console.warn('Supabase update failed for license:', err);
    }

    // 2. Update localStorage
    const current = await getLicenses();
    const updated = current.map(lic => {
        if (lic.id === id || lic.name === oldName) {
            return {
                ...lic,
                name: cleanName,
                code: cleanCode,
                description: cleanDesc,
                color: cleanColor,
                icon: cleanIcon
            };
        }
        return lic;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // 3. Update user references if name changed
    if (oldName && oldName !== cleanName) {
        try {
            // Update in Supabase users table
            const { data: usersWithOldLic } = await supabase
                .from('users')
                .select('id, licenses')
                .contains('licenses', [oldName]);

            if (usersWithOldLic && usersWithOldLic.length > 0) {
                for (const u of usersWithOldLic) {
                    const newLics = (u.licenses || []).map(l => l === oldName ? cleanName : l);
                    await supabase.from('users').update({ licenses: newLics }).eq('id', u.id);
                }
            }
        } catch (e) {
            console.warn('Failed to update users with renamed license in Supabase:', e);
        }
    }

    return true;
}

/**
 * Delete a license.
 */
export async function deleteLicense(id, name) {
    // 1. Try Supabase delete
    try {
        let query = supabase.from('coordination_licenses').delete();
        if (id && !id.startsWith('default-') && !id.startsWith('lic-custom-')) {
            query = query.eq('id', id);
        } else {
            query = query.eq('name', name);
        }
        const { error } = await query;
        if (error) console.warn('Supabase license delete error:', error);
    } catch (err) {
        console.warn('Supabase delete failed for license:', err);
    }

    // 2. Update localStorage
    const current = await getLicenses();
    const updated = current.filter(lic => lic.id !== id && lic.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // 3. Remove license from any users who had it
    try {
        const { data: usersWithLic } = await supabase
            .from('users')
            .select('id, licenses')
            .contains('licenses', [name]);

        if (usersWithLic && usersWithLic.length > 0) {
            for (const u of usersWithLic) {
                const newLics = (u.licenses || []).filter(l => l !== name);
                await supabase.from('users').update({ licenses: newLics }).eq('id', u.id);
            }
        }
    } catch (e) {
        console.warn('Failed to cleanup deleted license from users in Supabase:', e);
    }

    return true;
}

/**
 * Helper to get details for a license by name or code.
 */
export function getLicenseDetails(nameOrCode, allLicenses = []) {
    if (!nameOrCode) return null;
    const match = allLicenses.find(l => 
        l.name.toLowerCase() === nameOrCode.toLowerCase() || 
        l.code?.toLowerCase() === nameOrCode.toLowerCase()
    );

    if (match) return match;

    // Fallback default info
    return {
        name: nameOrCode,
        code: nameOrCode.substring(0, 3).toUpperCase(),
        description: '',
        color: '#10b981',
        icon: '🪪'
    };
}

/**
 * Get user licenses safely (from DB user object or fallback).
 */
export function getUserLicenses(user) {
    if (!user) return [];
    if (Array.isArray(user.licenses)) return user.licenses;
    if (user.id) {
        try {
            const saved = localStorage.getItem(`${USER_LICENSES_PREFIX}${user.id}`);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error reading user licenses from localStorage:', e);
        }
    }
    return [];
}

/**
 * Update user licenses in DB & localStorage.
 */
export async function updateUserLicenses(userId, licensesArray) {
    const cleanList = Array.from(new Set(licensesArray || []));

    // 1. Try Supabase RPC
    try {
        const { error } = await supabase.rpc('update_user_licenses', {
            p_target_user_id: userId,
            p_licenses: cleanList
        });

        if (!error) {
            localStorage.setItem(`${USER_LICENSES_PREFIX}${userId}`, JSON.stringify(cleanList));
            return cleanList;
        } else {
            console.warn('RPC update_user_licenses error, trying direct update:', error.message);
        }
    } catch (e) {
        console.warn('Supabase RPC call failed:', e);
    }

    // 2. Direct update fallback
    try {
        const { error: directErr } = await supabase
            .from('users')
            .update({ licenses: cleanList })
            .eq('id', userId);

        if (!directErr) {
            localStorage.setItem(`${USER_LICENSES_PREFIX}${userId}`, JSON.stringify(cleanList));
            return cleanList;
        }
    } catch (e) {
        console.warn('Direct Supabase update failed:', e);
    }

    // 3. LocalStorage fallback
    localStorage.setItem(`${USER_LICENSES_PREFIX}${userId}`, JSON.stringify(cleanList));
    return cleanList;
}

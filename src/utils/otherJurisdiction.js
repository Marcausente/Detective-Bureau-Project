import { supabase } from '../supabaseClient';

export const DEFAULT_OTHER_JURISDICTION_RAW = `Alana Knox [L175B97K]
Andrew Klark [G4Q1ZZ20]
Ashley Knox [Y3FB448U]
Cedric West [FB2GV372]
Daquavious McQuoid [HZ6423AB]
Destiny Knox [Z4G331MA]
Kim Knox [P1MB5U5T]
Kofi Opoke [F236YCB7]
Magnus Evans [FP096TLR]
Malik Elanga [YQ4IE9VG]
Malik Brut [BV0P11P4]
Michael Opoke [TADOI7K8]
Owen Johnson [AK8AJT6E]
Payne King [S93453GY]
Sekou Elanga [ZQ609DA9]`;

const STORAGE_KEY_SUBJECTS = 'other_jurisdiction_subjects_v1';
const STORAGE_KEY_TRANSFERRED = 'incidents_transferred_jurisdiction_v1';
const SETTING_KEY_SUBJECTS = 'other_jurisdiction_subjects';
const SETTING_KEY_TRANSFERRED = 'incidents_transferred_jurisdiction';

/**
 * Robust line parser that recognizes multiple formats:
 * - "Name [CODE]" -> name: "Name", code: "CODE"
 * - "[CODE] Name" -> name: "Name", code: "CODE"
 * - "Name - CODE" -> name: "Name", code: "CODE"
 * - "Name (CODE)" -> name: "Name", code: "CODE"
 * - "Name Surname CODE" -> name: "Name Surname", code: "CODE" (e.g. "Andre Coleman B8255GVK")
 * - "Name"        -> name: "Name", code: ""
 */
export function parseOtherJurisdictionEntry(rawLine) {
    if (!rawLine || typeof rawLine !== 'string') return null;
    const trimmed = rawLine.trim().replace(/[.,;:]+$/, '').trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;

    let name = '';
    let code = '';

    // 1. Bracket format: "Name [CODE]" or "[CODE] Name"
    const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/) || trimmed.match(/^(.*?)\s*\[([^\]]+)\]$/);
    if (bracketMatch) {
        if (trimmed.startsWith('[')) {
            code = bracketMatch[1].trim();
            name = bracketMatch[2].trim();
        } else {
            name = bracketMatch[1].trim();
            code = bracketMatch[2].trim();
        }
    } else {
        // 2. Dash/Hyphen format: "Name - CODE" or "CODE - Name"
        const dashMatch = trimmed.match(/^(.*?)\s*[-–—]\s*(.*?)$/);
        if (dashMatch) {
            const p1 = dashMatch[1].trim();
            const p2 = dashMatch[2].trim();
            // Check if p2 looks like an ID/badge (alphanumeric, no spaces, 3-20 chars)
            if (/^[A-Za-z0-9#_]{3,20}$/.test(p2)) {
                name = p1;
                code = p2;
            } else if (/^[A-Za-z0-9#_]{3,20}$/.test(p1)) {
                code = p1;
                name = p2;
            } else {
                name = p1;
                code = p2;
            }
        } else {
            // 3. Parentheses format: "Name (CODE)" or "(CODE) Name"
            const parenMatch = trimmed.match(/^\(([^)]+)\)\s*(.*)$/) || trimmed.match(/^(.*?)\s*\(([^)]+)\)$/);
            if (parenMatch) {
                if (trimmed.startsWith('(')) {
                    code = parenMatch[1].trim();
                    name = parenMatch[2].trim();
                } else {
                    name = parenMatch[1].trim();
                    code = parenMatch[2].trim();
                }
            } else {
                // 4. Space-separated format: "Nombre Apellido ID" (e.g. "Andre Coleman B8255GVK")
                const tokens = trimmed.split(/\s+/);
                if (tokens.length >= 2) {
                    const lastToken = tokens[tokens.length - 1].replace(/[.,;:()[\]-]+$/, '').trim();
                    const firstToken = tokens[0].replace(/[.,;:()[\]-]+$/, '').trim();

                    const isIdLike = (str) => {
                        if (!str || str.length < 3 || str.length > 25) return false;
                        // Has digits (e.g. B8255GVK, HZ6423AB, 12345)
                        if (/\d/.test(str)) return true;
                        // Starts with '#' (e.g. #719)
                        if (str.startsWith('#')) return true;
                        // All uppercase letters/digits with length >= 4 (e.g. DNI, PASS, CODE)
                        if (str.length >= 4 && str === str.toUpperCase() && /^[A-Z0-9_-]+$/.test(str)) return true;
                        return false;
                    };

                    if (isIdLike(lastToken)) {
                        code = lastToken;
                        name = tokens.slice(0, -1).join(' ').trim();
                    } else if (isIdLike(firstToken)) {
                        code = firstToken;
                        name = tokens.slice(1).join(' ').trim();
                    } else if (tokens.length >= 3 && /^[A-Za-z0-9#_-]{3,20}$/.test(lastToken)) {
                        // 3+ tokens, e.g. "Nombre Apellido ID"
                        code = lastToken;
                        name = tokens.slice(0, -1).join(' ').trim();
                    } else {
                        name = trimmed;
                        code = '';
                    }
                } else {
                    name = trimmed;
                    code = '';
                }
            }
        }
    }

    const cleanName = (name || trimmed).trim().replace(/[.,;:]+$/, '').trim();
    const cleanCode = (code || '').trim().replace(/^#/, '').replace(/[.,;:]+$/, '').trim();

    const terms = new Set();
    if (cleanName.length >= 2) terms.add(cleanName.toLowerCase());
    if (cleanCode.length >= 2) {
        terms.add(cleanCode.toLowerCase());
        terms.add(`[${cleanCode.toLowerCase()}]`);
    }
    if (trimmed.length >= 3) terms.add(trimmed.toLowerCase());

    return {
        id: `oj-${cleanName}-${cleanCode}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        raw: trimmed,
        name: cleanName,
        code: cleanCode,
        searchTerms: Array.from(terms)
    };
}

/**
 * Parse multiline raw text into subject objects.
 */
export function parseOtherJurisdictionText(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const lines = rawText.split(/\r?\n/);
    const seen = new Set();
    const subjects = [];

    for (const line of lines) {
        const parsed = parseOtherJurisdictionEntry(line);
        if (parsed && !seen.has(parsed.id)) {
            seen.add(parsed.id);
            subjects.push(parsed);
        }
    }

    return subjects;
}

/**
 * Check if an incident matches any subject from other jurisdiction.
 */
export function matchesOtherJurisdiction(incident, parsedSubjects = []) {
    if (!incident || !parsedSubjects || parsedSubjects.length === 0) {
        return { matches: false, matchedSubject: null };
    }

    const titleLower = (incident.title || '').toLowerCase();
    const descLower = (incident.description || '').toLowerCase();
    const locLower = (incident.location || '').toLowerCase();
    const tabletLower = (incident.tablet_incident_number || '').toString().toLowerCase();
    const authorLower = (incident.author_name || '').toLowerCase();
    const gangsText = Array.isArray(incident.gang_names) ? incident.gang_names.join(' ').toLowerCase() : '';

    const fullBlob = `${titleLower} ${descLower} ${locLower} ${tabletLower} ${authorLower} ${gangsText}`;

    for (const subj of parsedSubjects) {
        // 1. Direct code check (highest specificity)
        if (subj.code && subj.code.length >= 3) {
            const codeLower = subj.code.toLowerCase();
            if (fullBlob.includes(codeLower)) {
                return { matches: true, matchedSubject: subj };
            }
        }

        // 2. Full name check
        if (subj.name && subj.name.length >= 3) {
            const nameLower = subj.name.toLowerCase();
            if (fullBlob.includes(nameLower)) {
                return { matches: true, matchedSubject: subj };
            }

            // Check reversed name e.g. "Coleman, Andre" or "Coleman Andre"
            const nParts = nameLower.split(/\s+/);
            if (nParts.length === 2 && nParts[0].length >= 2 && nParts[1].length >= 2) {
                const rev = `${nParts[1]} ${nParts[0]}`;
                const revComma = `${nParts[1]}, ${nParts[0]}`;
                if (fullBlob.includes(rev) || fullBlob.includes(revComma)) {
                    return { matches: true, matchedSubject: subj };
                }
            }
        }

        // 3. Raw line check
        if (subj.raw && subj.raw.length >= 4) {
            if (fullBlob.includes(subj.raw.toLowerCase())) {
                return { matches: true, matchedSubject: subj };
            }
        }
    }

    return { matches: false, matchedSubject: null };
}

/**
 * Get raw subjects text from Supabase or localStorage.
 */
export async function getOtherJurisdictionSubjects() {
    // 1. Try Supabase app_settings
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SETTING_KEY_SUBJECTS)
            .maybeSingle();

        if (!error && data && data.value !== null && data.value !== undefined) {
            localStorage.setItem(STORAGE_KEY_SUBJECTS, data.value);
            return data.value;
        }
    } catch (e) {
        console.warn('Error reading other_jurisdiction_subjects from app_settings:', e);
    }

    // 2. Fallback to localStorage
    try {
        const cached = localStorage.getItem(STORAGE_KEY_SUBJECTS);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
    } catch (e) {
        console.error('Error reading localStorage for other jurisdiction:', e);
    }

    // 3. Default seed
    localStorage.setItem(STORAGE_KEY_SUBJECTS, DEFAULT_OTHER_JURISDICTION_RAW);
    return DEFAULT_OTHER_JURISDICTION_RAW;
}

/**
 * Save raw subjects text to Supabase & localStorage.
 */
export async function saveOtherJurisdictionSubjects(rawText) {
    const cleanText = (rawText || '').trim();

    // 1. LocalStorage
    localStorage.setItem(STORAGE_KEY_SUBJECTS, cleanText);

    // 2. Try RPC with SECURITY DEFINER first to avoid RLS permission blocks
    let savedToDb = false;
    try {
        const { error: rpcErr } = await supabase.rpc('save_other_jurisdiction_subjects', {
            p_text: cleanText
        });
        if (!rpcErr) {
            savedToDb = true;
        } else {
            console.warn('RPC save_other_jurisdiction_subjects error, trying direct upsert:', rpcErr);
        }
    } catch (rpcEx) {
        console.warn('RPC save_other_jurisdiction_subjects exception:', rpcEx);
    }

    // 3. Fallback to direct upsert on app_settings if RPC was not available
    if (!savedToDb) {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: SETTING_KEY_SUBJECTS,
                value: cleanText,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            console.error('Failed to save other_jurisdiction_subjects to app_settings:', error);
            throw new Error(error.message || 'Error de permisos al guardar en la base de datos');
        }
    }

    return cleanText;
}

/**
 * Get the list of transferred incident IDs.
 */
export async function getTransferredIncidentIds() {
    let ids = [];

    // 1. Try Supabase app_settings
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SETTING_KEY_TRANSFERRED)
            .maybeSingle();

        if (!error && data && data.value) {
            try {
                const parsed = JSON.parse(data.value);
                if (Array.isArray(parsed)) {
                    ids = parsed;
                    localStorage.setItem(STORAGE_KEY_TRANSFERRED, JSON.stringify(ids));
                    return ids;
                }
            } catch (jsonErr) {
                console.error('Error parsing transferred incidents JSON:', jsonErr);
            }
        }
    } catch (e) {
        console.warn('Error reading transferred incidents from app_settings:', e);
    }

    // 2. LocalStorage fallback
    try {
        const local = localStorage.getItem(STORAGE_KEY_TRANSFERRED);
        if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.error('Error reading transferred incidents from localStorage:', e);
    }

    return ids;
}

/**
 * Mark or unmark an incident as transferred to another jurisdiction.
 */
export async function setIncidentTransferred(incidentId, isTransferred) {
    if (!incidentId) return false;

    try {
        const currentIds = await getTransferredIncidentIds();
        const idSet = new Set(currentIds);

        if (isTransferred) {
            idSet.add(incidentId);
        } else {
            idSet.delete(incidentId);
        }

        const updatedArray = Array.from(idSet);
        const jsonArray = JSON.stringify(updatedArray);

        // 1. Update localStorage
        localStorage.setItem(STORAGE_KEY_TRANSFERRED, jsonArray);

        // 2. Update app_settings via RPC with fallback to direct upsert
        let savedToDb = false;
        try {
            const { error: rpcErr } = await supabase.rpc('save_transferred_incidents', {
                p_json_array: jsonArray
            });
            if (!rpcErr) {
                savedToDb = true;
            }
        } catch {
            // fallback
        }

        if (!savedToDb) {
            try {
                await supabase
                    .from('app_settings')
                    .upsert({
                        key: SETTING_KEY_TRANSFERRED,
                        value: jsonArray,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
            } catch (dbErr) {
                console.warn('Failed to upsert transferred incidents to app_settings:', dbErr);
            }
        }

        // 3. Optional direct table update if column exists
        try {
            await supabase
                .from('incidents')
                .update({ transferred_to_other_jurisdiction: isTransferred })
                .eq('id', incidentId);
        } catch (colErr) {
            // Ignore column error if migration hasn't been run
        }

        return true;
    } catch (err) {
        console.error('Error in setIncidentTransferred:', err);
        return false;
    }
}


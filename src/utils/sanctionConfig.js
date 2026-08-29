import { supabase } from '../supabaseClient';

export const DEFAULT_SANCTION_DURATIONS = {
    Leve: 7,
    Media: 14,
    Grave: 20
};

/**
 * Fetches the custom sanction durations from app_settings with fallback to defaults.
 */
export async function fetchSanctionDurations() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['sanction_days_leve', 'sanction_days_media', 'sanction_days_grave']);

        if (error || !data) {
            return { ...DEFAULT_SANCTION_DURATIONS };
        }

        const map = { ...DEFAULT_SANCTION_DURATIONS };
        data.forEach(item => {
            const num = parseInt(item.value, 10);
            if (!isNaN(num) && num > 0) {
                if (item.key === 'sanction_days_leve') map.Leve = num;
                if (item.key === 'sanction_days_media') map.Media = num;
                if (item.key === 'sanction_days_grave') map.Grave = num;
            }
        });

        return map;
    } catch (err) {
        console.error('Error fetching sanction durations:', err);
        return { ...DEFAULT_SANCTION_DURATIONS };
    }
}

/**
 * Formats a Date object to DD/MM/YYYY
 */
export function formatDateDMY(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Calculates expiration details for an individual sanction.
 */
export function calculateSanctionExpiry(sanction, durations = DEFAULT_SANCTION_DURATIONS) {
    const rawType = sanction.type || sanction.sanction_type || 'Media';
    const typeKey = rawType.includes('Grave') ? 'Grave' : rawType.includes('Leve') ? 'Leve' : 'Media';
    const durationDays = durations[typeKey] || DEFAULT_SANCTION_DURATIONS[typeKey] || 14;

    const rawDateStr = sanction.date || sanction.sanction_date || sanction.created_at;
    let startDate;
    if (rawDateStr) {
        // Handle YYYY-MM-DD cleanly without timezone offset
        const parts = String(rawDateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            startDate = new Date(rawDateStr);
        }
    } else {
        startDate = new Date();
    }

    // Expiry Date = startDate + durationDays
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

    const diffTime = expiryMidnight.getTime() - todayMidnight.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isActive = daysRemaining >= 0;

    return {
        type: typeKey,
        durationDays,
        startDate,
        startDateFormatted: formatDateDMY(startDate),
        expiryDate,
        expiryDateFormatted: formatDateDMY(expiryDate),
        daysRemaining,
        isActive,
        isExpired: !isActive
    };
}

/**
 * Calculates overall active/expired sanction status for a subject officer.
 */
export function calculateSubjectStatus(subject, durations = DEFAULT_SANCTION_DURATIONS) {
    const rawSanctions = subject.sanctions || [];
    
    const enrichedSanctions = rawSanctions.map(s => ({
        ...s,
        expiry: calculateSanctionExpiry(s, durations)
    }));

    const activeSanctions = enrichedSanctions.filter(s => s.expiry.isActive);
    const expiredSanctions = enrichedSanctions.filter(s => s.expiry.isExpired);

    const hasActive = activeSanctions.length > 0;

    let latestExpiryDate = null;
    let maxDaysRemaining = 0;
    let mostSevereActive = null;

    if (hasActive) {
        // Sort active by expiry date descending to get the furthest expiration
        activeSanctions.sort((a, b) => b.expiry.expiryDate.getTime() - a.expiry.expiryDate.getTime());
        latestExpiryDate = activeSanctions[0].expiry.expiryDate;
        maxDaysRemaining = activeSanctions[0].expiry.daysRemaining;

        // Check if any Grave, then Media, then Leve
        if (activeSanctions.some(s => s.expiry.type === 'Grave')) {
            mostSevereActive = 'Grave';
        } else if (activeSanctions.some(s => s.expiry.type === 'Media')) {
            mostSevereActive = 'Media';
        } else {
            mostSevereActive = 'Leve';
        }
    }

    return {
        totalCount: rawSanctions.length,
        activeCount: activeSanctions.length,
        expiredCount: expiredSanctions.length,
        hasActive,
        activeSanctions,
        expiredSanctions,
        latestExpiryDate,
        latestExpiryDateFormatted: latestExpiryDate ? formatDateDMY(latestExpiryDate) : null,
        maxDaysRemaining,
        mostSevereActive
    };
}

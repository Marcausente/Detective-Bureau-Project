/**
 * Utility functions to calculate weekly incident activity and day-of-week distribution for gangs
 */

export const DAYS_OF_WEEK = [
    { key: 'monday', index: 1, label: 'Lunes', labelEn: 'Monday', short: 'Lun', shortEn: 'Mon', order: 1 },
    { key: 'tuesday', index: 2, label: 'Martes', labelEn: 'Tuesday', short: 'Mar', shortEn: 'Tue', order: 2 },
    { key: 'wednesday', index: 3, label: 'Miércoles', labelEn: 'Wednesday', short: 'Mié', shortEn: 'Wed', order: 3 },
    { key: 'thursday', index: 4, label: 'Jueves', labelEn: 'Thursday', short: 'Jue', shortEn: 'Thu', order: 4 },
    { key: 'friday', index: 5, label: 'Viernes', labelEn: 'Friday', short: 'Vie', shortEn: 'Fri', order: 5 },
    { key: 'saturday', index: 6, label: 'Sábado', labelEn: 'Saturday', short: 'Sáb', shortEn: 'Sat', order: 6 },
    { key: 'sunday', index: 0, label: 'Domingo', labelEn: 'Sunday', short: 'Dom', shortEn: 'Sun', order: 7 }
];

/**
 * Calculates the incident distribution across days of the week, ranked from most active to least active.
 * 
 * @param {Array} incidents - List of incident objects linked to the gang
 * @returns {Object} Calculated stats including sorted days, peak day, lowest day, and percentages.
 */
export function calculateGangWeeklyActivity(incidents = []) {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let validCount = 0;

    if (Array.isArray(incidents)) {
        incidents.forEach(inc => {
            if (!inc) return;
            const rawDate = inc.occurred_at || inc.created_at || inc.incident_date;
            if (!rawDate) return;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return;

            const day = d.getDay(); // 0 is Sunday, 1 is Monday, ... 6 is Saturday
            counts[day] = (counts[day] || 0) + 1;
            validCount++;
        });
    }

    const dayStats = DAYS_OF_WEEK.map(day => {
        const count = counts[day.index] || 0;
        const percentage = validCount > 0 ? (count / validCount) * 100 : 0;
        return {
            ...day,
            count,
            percentage,
            formattedPercentage: percentage.toFixed(1)
        };
    });

    // Sort from MOST active (highest incident count) to LEAST active (lowest count)
    const sortedDays = [...dayStats].sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count; // Higher count first
        }
        return a.order - b.order; // Natural week order (Mon-Sun) if counts are tied
    });

    const peakDay = validCount > 0 && sortedDays[0].count > 0 ? sortedDays[0] : null;
    const lowestDay = validCount > 0 ? sortedDays[sortedDays.length - 1] : null;
    const maxDayCount = sortedDays[0]?.count || 0;

    return {
        totalIncidents: validCount,
        dayStats,
        sortedDays,
        peakDay,
        lowestDay,
        maxDayCount
    };
}

/**
 * Utility to parse formatted ballistic reports from GTA RP / Police scripts.
 * 
 * Example Format:
 * [INFORME BALÍSTICO]
 * Arma: Endurance
 * Serie: 466080ECB348251
 * Calibre: Balas 9mm
 * Fecha: 2026-09-01 22:53
 */

function cleanFieldValue(val) {
    if (!val) return '';
    return val.replace(/^["'`]|["'`]$/g, '').trim();
}

export function parseSingleBallisticReport(text) {
    if (!text || typeof text !== 'string') return null;

    const lines = text.split(/\r?\n/);
    let modelo_arma = '';
    let num_serie = '';
    let calibre = '';
    let incidente = '';
    let propietario = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Skip headers or delimiters
        if (/^\[.*BAL[IÍ]STIC.*\]$/i.test(line) || /^\[.*BALLISTIC.*\]$/i.test(line) || /^---+$/i.test(line) || /^===+$/i.test(line)) {
            continue;
        }

        // Weapon model
        const armaMatch = line.match(/^(?:Arma|Modelo(?:\s+de\s+arma)?|Weapon|Model|Gun)\s*[:=]\s*(.+)$/i);
        if (armaMatch) {
            modelo_arma = cleanFieldValue(armaMatch[1]);
            continue;
        }

        // Serial number
        const serieMatch = line.match(/^(?:Serie|N[úu]mero\s+de\s+serie|N[ºo]\.?\s*(?:de\s*)?Serie|N\/S|S\/N|Serial(?:\s+Number)?|SN)\s*[:=]\s*(.+)$/i);
        if (serieMatch) {
            num_serie = cleanFieldValue(serieMatch[1]);
            continue;
        }

        // Caliber
        const calibreMatch = line.match(/^(?:Calibre|Caliber|Munici[oó]n|Ammo)\s*[:=]\s*(.+)$/i);
        if (calibreMatch) {
            calibre = cleanFieldValue(calibreMatch[1]);
            continue;
        }

        // Owner / Propietario (if present)
        const propMatch = line.match(/^(?:Propietario|Due[ñn]o|Owner|Sujeto|Portador)\s*[:=]\s*(.+)$/i);
        if (propMatch) {
            propietario = cleanFieldValue(propMatch[1]);
            continue;
        }

        // Incident (if present)
        const incMatch = line.match(/^(?:Incidente|Caso|Incident|Case|Suceso)\s*[:=]\s*(.+)$/i);
        if (incMatch) {
            incidente = cleanFieldValue(incMatch[1]);
            continue;
        }

        // Ignore date/time or other non-essential tags
    }

    if (!num_serie && !modelo_arma && !calibre && !propietario) {
        return null;
    }

    return {
        modelo_arma,
        num_serie,
        calibre,
        incidente,
        propietario
    };
}

export function parseMultipleBallisticReports(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return [];

    const text = rawText.trim();
    const lines = text.split(/\r?\n/);
    const results = [];

    let current = {
        modelo_arma: '',
        num_serie: '',
        calibre: '',
        incidente: '',
        propietario: ''
    };

    const hasAnyField = (obj) => Boolean(obj.num_serie || obj.modelo_arma || obj.calibre || obj.propietario);

    const pushCurrent = () => {
        if (hasAnyField(current)) {
            results.push({ ...current });
            current = {
                modelo_arma: '',
                num_serie: '',
                calibre: '',
                incidente: '',
                propietario: ''
            };
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        // Delimiter or header lines indicating a new report
        if (!line || /^\[.*(?:BAL[IÍ]STIC|ARMAS?|WEAPON).*\]$/i.test(line) || /^---+$/i.test(line) || /^===+$/i.test(line) || /^\*\*\*+$/i.test(line)) {
            // If we already collected some data in current object, this boundary concludes it
            if (hasAnyField(current)) {
                pushCurrent();
            }
            continue;
        }

        // Weapon model
        const armaMatch = line.match(/^(?:Arma|Modelo(?:\s+de\s+arma)?|Weapon|Model|Gun)\s*[:=]\s*(.+)$/i);
        if (armaMatch) {
            const val = cleanFieldValue(armaMatch[1]);
            // If current already has modelo_arma, this is the start of another report
            if (current.modelo_arma && (current.num_serie || current.calibre)) {
                pushCurrent();
            }
            current.modelo_arma = val;
            continue;
        }

        // Serial number
        const serieMatch = line.match(/^(?:Serie|N[úu]mero\s+de\s+serie|N[ºo]\.?\s*(?:de\s*)?Serie|N\/S|S\/N|Serial(?:\s+Number)?|SN)\s*[:=]\s*(.+)$/i);
        if (serieMatch) {
            const val = cleanFieldValue(serieMatch[1]);
            // If current already has a serial number, push and start next report
            if (current.num_serie && (current.modelo_arma || current.calibre)) {
                pushCurrent();
            }
            current.num_serie = val;
            continue;
        }

        // Caliber
        const calibreMatch = line.match(/^(?:Calibre|Caliber|Munici[oó]n|Ammo)\s*[:=]\s*(.+)$/i);
        if (calibreMatch) {
            const val = cleanFieldValue(calibreMatch[1]);
            if (current.calibre && (current.num_serie || current.modelo_arma)) {
                pushCurrent();
            }
            current.calibre = val;
            continue;
        }

        // Owner / Propietario
        const propMatch = line.match(/^(?:Propietario|Due[ñn]o|Owner|Sujeto|Portador)\s*[:=]\s*(.+)$/i);
        if (propMatch) {
            const val = cleanFieldValue(propMatch[1]);
            if (current.propietario && (current.num_serie || current.modelo_arma)) {
                pushCurrent();
            }
            current.propietario = val;
            continue;
        }

        // Incident
        const incMatch = line.match(/^(?:Incidente|Caso|Incident|Case|Suceso)\s*[:=]\s*(.+)$/i);
        if (incMatch) {
            current.incidente = cleanFieldValue(incMatch[1]);
            continue;
        }
    }

    // Push the final object
    pushCurrent();

    // If stream parser found nothing (e.g. single line without standard keys), fallback to parseSingleBallisticReport
    if (results.length === 0) {
        const single = parseSingleBallisticReport(text);
        if (single) results.push(single);
    }

    return results;
}

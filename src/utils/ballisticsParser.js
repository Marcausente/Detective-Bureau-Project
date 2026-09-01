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

export function parseSingleBallisticReport(text) {
    if (!text || typeof text !== 'string') return null;

    const lines = text.split(/\r?\n/);
    let modelo_arma = '';
    let num_serie = '';
    let calibre = '';
    let incidente = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Skip headers or delimiters
        if (/^\[.*BAL[IÍ]STIC.*\]$/i.test(line) || /^---+$/i.test(line) || /^===+$/i.test(line)) {
            continue;
        }

        // Weapon model
        const armaMatch = line.match(/^(?:Arma|Modelo(?:\s+de\s+arma)?|Weapon)\s*[:=]\s*(.+)$/i);
        if (armaMatch) {
            modelo_arma = armaMatch[1].trim();
            continue;
        }

        // Serial number
        const serieMatch = line.match(/^(?:Serie|N[úu]mero\s+de\s+serie|N[ºo]\.?\s*Serie|N\/S|Serial|SN)\s*[:=]\s*(.+)$/i);
        if (serieMatch) {
            num_serie = serieMatch[1].trim();
            continue;
        }

        // Caliber
        const calibreMatch = line.match(/^(?:Calibre|Caliber|Munici[oó]n)\s*[:=]\s*(.+)$/i);
        if (calibreMatch) {
            calibre = calibreMatch[1].trim();
            continue;
        }

        // Incident (if present)
        const incMatch = line.match(/^(?:Incidente|Caso|Incident)\s*[:=]\s*(.+)$/i);
        if (incMatch) {
            incidente = incMatch[1].trim();
            continue;
        }

        // If line is just "Fecha: ...", it is safely ignored
    }

    if (!num_serie && !modelo_arma && !calibre) {
        return null;
    }

    return {
        modelo_arma,
        num_serie,
        calibre,
        incidente
    };
}

export function parseMultipleBallisticReports(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return [];

    const text = rawText.trim();
    const results = [];

    // Split by block header tags like [INFORME BALÍSTICO]
    const headerRegex = /\[(?:INFORME\s+)?BAL[IÍ]STICO?\]|\[BAL[IÍ]STICA\]/gi;
    const parts = text.split(headerRegex);

    if (parts.length > 1) {
        for (const part of parts) {
            if (!part.trim()) continue;
            const parsed = parseSingleBallisticReport(part);
            if (parsed && (parsed.num_serie || parsed.modelo_arma || parsed.calibre)) {
                results.push(parsed);
            }
        }
    } else {
        // Check if there are multiple reports separated by double linebreaks or dividers
        const chunks = text.split(/\n\s*\n|---+|===+/);
        if (chunks.length > 1) {
            for (const chunk of chunks) {
                if (!chunk.trim()) continue;
                const parsed = parseSingleBallisticReport(chunk);
                if (parsed && (parsed.num_serie || parsed.modelo_arma || parsed.calibre)) {
                    results.push(parsed);
                }
            }
        } else {
            // Single chunk
            const parsed = parseSingleBallisticReport(text);
            if (parsed) {
                results.push(parsed);
            }
        }
    }

    return results;
}

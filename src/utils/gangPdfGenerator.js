import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { signatureFontBase64 } from './signatureFont';

// Helper to sanitize text and remove emojis or unprintable Unicode surrogate pairs
const cleanPDFText = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F\uDE80-\uDEF8]|\uD83E[\uDD00-\uDDFF])/g, '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{2934}-\u{2935}\u{25AA}-\u{25AB}\u{25FB}-\u{25FE}\u{25B6}\u{25C0}\u{1F1E6}-\u{1F1FF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// Helper to convert transparent images (like WebP or PNG) to PNG DataURL for jsPDF
const loadImgAsPngDataUrl = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = src;
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        } catch (e) {
            resolve(null);
        }
    };
    img.onerror = () => resolve(null);
});

/**
 * Generates an official Intelligence Summary PDF for a Criminal Organization.
 * @param {Object} gang - Gang object from state/DB
 * @param {Object} extraData - { incidents: [], outings: [], patrolLogs: [], isLSSD: boolean, authorName: string }
 */
export const generateGangSummaryPDF = async (gang, extraData = {}) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Register signature font if needed
    try {
        doc.addFileToVFS('AlexBrush-Regular.ttf', signatureFontBase64);
        doc.addFont('AlexBrush-Regular.ttf', 'AlexBrush', 'normal');
    } catch (e) {
        console.warn('Font registration fallback:', e);
    }

    const {
        incidents = [],
        outings = [],
        patrolLogs = [],
        isLSSD = false,
        authorName = 'Agente Investigador'
    } = extraData;

    // Theme color palettes
    const primaryColor = isLSSD ? [6, 78, 59] : [30, 58, 138];       // #064e3b (LSSD) or #1e3a8a (LSPD)
    const accentGold = [212, 175, 55];                             // Gold #d4af37
    const textDark = [15, 23, 42];                                 // Slate #0f172a
    const textMuted = [100, 116, 139];                             // Slate #64748b
    const bgLight = [248, 250, 252];                               // Slate #f8fafc

    // Transparent logos
    const dojLogoDataUrl = await loadImgAsPngDataUrl('/logowebp/dojlogo.webp');
    const saLogoDataUrl = await loadImgAsPngDataUrl('/logowebp/sanandreas.webp');

    // Decorative Outer Border Frame function
    const drawPageBorder = () => {
        doc.setLineWidth(0.5);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

        doc.setLineWidth(0.2);
        doc.setDrawColor(accentGold[0], accentGold[1], accentGold[2]);
        doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);
    };

    // Draw initial page border
    drawPageBorder();

    // --- HEADER BANNER ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(10, 10, pageWidth - 20, 4, 'F');
    doc.setFillColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.rect(10, 14, pageWidth - 20, 1, 'F');

    // Logos placement
    if (dojLogoDataUrl) doc.addImage(dojLogoDataUrl, 'PNG', 14, 17, 24, 24);
    if (saLogoDataUrl) doc.addImage(saLogoDataUrl, 'PNG', pageWidth - 38, 17, 24, 24);

    // Title Text - Bureau Dynamic Name
    const bureauName = isLSSD ? "SHERIFF CRIMINAL UNIT BUREAU" : "DETECTIVE BUREAU";
    const bureauSubtitle = "DIVISIÓN DE INTELIGENCIA CRIMINAL Y ANÁLISIS DE BANDAS";

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(bureauName, pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.text(bureauSubtitle, pageWidth / 2, 27, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text("DEPARTMENT OF JUSTICE • ESTADO DE SAN ANDREAS • DOSSIER CONFIDENCIAL", pageWidth / 2, 32, { align: 'center' });

    // Decorative Line Divider
    doc.setLineWidth(0.4);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(14, 43, pageWidth - 14, 43);

    // --- DOCUMENT MAIN TITLE ---
    let y = 52;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("RESUMEN GENERAL DE ORGANIZACIÓN CRIMINAL", pageWidth / 2, y, { align: 'center' });

    y += 7;
    doc.setFontSize(12);
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    const gangCleanName = cleanPDFText(gang.name || 'ORGANIZACIÓN SIN NOMBRE').toUpperCase();
    doc.text(`[ ${gangCleanName} ]`, pageWidth / 2, y, { align: 'center' });

    // --- METADATA BOX CARD ---
    y += 7;
    const boxX = 14;
    const boxWidth = pageWidth - 28;
    const boxHeight = 28;

    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.roundedRect(boxX, y, boxWidth, boxHeight, 3, 3, 'F');
    doc.setLineWidth(0.3);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, y, boxWidth, boxHeight, 3, 3, 'D');

    // Left accent bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(boxX, y, 2.5, boxHeight, 1, 1, 'F');

    // Grid Contents inside metadata box
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

    // Row 1
    doc.text("FOLIO REGISTRO:", boxX + 6, y + 7);
    doc.text("FECHA EMISIÓN:", boxX + 105, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`INTEL-${(gang.gang_id || '000000').slice(0, 8).toUpperCase()}`, boxX + 36, y + 7);
    doc.text(new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), boxX + 132, y + 7);

    // Row 2
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("DETECTIVES A CARGO:", boxX + 6, y + 15);
    doc.text("ESTADO OPERATIVO:", boxX + 105, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const detectivesList = [gang.detective_in_charge_1_name, gang.detective_in_charge_2_name].filter(Boolean).map(cleanPDFText).join(' / ') || 'SIN ASIGNAR';
    doc.text(detectivesList.toUpperCase(), boxX + 41, y + 15);

    // Status Badge
    const statusText = gang.is_archived ? 'ARCHIVADO' : 'OPERATIVO / ACTIVO';
    const statusBg = gang.is_archived ? [100, 116, 139] : [16, 185, 129];
    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(boxX + 137, y + 11.5, 33, 5, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, boxX + 153.5, y + 15, { align: 'center' });

    // Row 3
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("UNIDAD DE ANÁLISIS:", boxX + 6, y + 23);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(bureauName, boxX + 41, y + 23);

    y += boxHeight + 8;

    // --- DASHBOARD / STATS SUMMARY BOXES ---
    const membersCount = (gang.members || []).length;
    const incidentCount = incidents.length || (gang.incident_count || 0);
    const patrolCount = patrolLogs.length || 0;
    const vehicleCount = (gang.vehicles || []).length;
    const propertyCount = (gang.homes || []).length;

    const stats = [
        { label: 'MIEMBROS', val: membersCount },
        { label: 'INCIDENTES', val: incidentCount },
        { label: 'PATRULLAS', val: patrolCount },
        { label: 'VEHÍCULOS', val: vehicleCount },
        { label: 'PROPIEDADES', val: propertyCount }
    ];

    const statBoxWidth = (pageWidth - 28 - (stats.length - 1) * 2) / stats.length;
    stats.forEach((st, idx) => {
        const sx = 14 + idx * (statBoxWidth + 2);
        doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
        doc.roundedRect(sx, y, statBoxWidth, 14, 2, 2, 'F');
        doc.setLineWidth(0.2);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(sx, y, statBoxWidth, 14, 2, 2, 'D');

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(st.label, sx + statBoxWidth / 2, y + 5, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(String(st.val), sx + statBoxWidth / 2, y + 11.5, { align: 'center' });
    });

    y += 20;

    // Helper for adding Section Titles
    const addSectionTitle = (title) => {
        const cleanTitle = cleanPDFText(title).toUpperCase();
        if (y > pageHeight - 35) {
            doc.addPage();
            drawPageBorder();
            y = 20;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(cleanTitle, 14, y);

        doc.setLineWidth(0.3);
        doc.setDrawColor(accentGold[0], accentGold[1], accentGold[2]);
        doc.line(14, y + 1.5, pageWidth - 14, y + 1.5);
        y += 6;
    };

    // --- SECTION 1: ROSTER / MEMBERS ---
    addSectionTitle(`1. MIEMBROS Y AFILIADOS IDENTIFICADOS (${membersCount})`);

    const sortedMembers = [...(gang.members || [])].sort((a, b) => {
        const rolesOrder = { 'Lider': 1, 'Sublider': 2, 'Miembro': 3, 'Sospechoso': 4, 'Inactivo': 5 };
        const orderA = rolesOrder[a.role] || 9;
        const orderB = rolesOrder[b.role] || 9;
        return orderA - orderB;
    });

    if (sortedMembers.length > 0) {
        const membersTableHead = [['Nombre / Alias', 'ID Sujeto', 'Rol / Jerarquía', 'Estado']];
        const membersTableBody = sortedMembers.map(m => {
            const rawName = m.name || '';
            const idMatch = rawName.match(/\[([^\]]+)\]/);
            const idText = idMatch ? idMatch[1] : '-';
            const cleanNameOnly = rawName.replace(/\[[^\]]+\]/g, '').trim();

            return [
                cleanPDFText(cleanNameOnly || rawName),
                cleanPDFText(idText),
                cleanPDFText(m.role || 'Sospechoso'),
                cleanPDFText(m.status || (m.role === 'Inactivo' ? 'Inactivo' : 'Activo'))
            ];
        });

        autoTable(doc, {
            startY: y,
            head: membersTableHead,
            body: membersTableBody,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 2.5,
                textColor: textDark,
                lineColor: [226, 232, 240],
                lineWidth: 0.2
            },
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                alignment: 'left'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { fontStyle: 'bold', cellWidth: 35 },
                2: { cellWidth: 45 },
                3: { cellWidth: 'auto' }
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { left: 14, right: 14 }
        });

        y = doc.lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text("No existen miembros afiliados registrados formalmente en la ficha.", 14, y);
        y += 8;
    }

    // --- SECTION 2: RELATED INCIDENTS ---
    addSectionTitle(`2. INFORMES DE INCIDENCIA VINCULADOS (${incidents.length})`);

    if (incidents.length > 0) {
        const incidentsHead = [['Nº / Folio', 'Título de la Incidencia', 'Fecha / Hora', 'Ubicación', 'Redactor']];
        const incidentsBody = incidents.map(inc => [
            cleanPDFText(inc.tablet_incident_number || (inc.record_id ? inc.record_id.slice(0, 8).toUpperCase() : 'INC-00')),
            cleanPDFText(inc.title || 'Incidente sin título'),
            inc.occurred_at ? new Date(inc.occurred_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            cleanPDFText(inc.location || 'No especificada'),
            cleanPDFText(`${inc.author_rank || ''} ${inc.author_name || ''}`).trim() || 'Agente'
        ]);

        autoTable(doc, {
            startY: y,
            head: incidentsHead,
            body: incidentsBody,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 2.5,
                textColor: textDark,
                lineColor: [226, 232, 240],
                lineWidth: 0.2
            },
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                alignment: 'left'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 28 },
                1: { fontStyle: 'bold', cellWidth: 55 },
                2: { cellWidth: 32 },
                3: { cellWidth: 35 },
                4: { cellWidth: 'auto' }
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { left: 14, right: 14 }
        });

        y = doc.lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text("No se registran informes de incidencia vinculados directamente a este grupo.", 14, y);
        y += 8;
    }

    // --- SECTION 3: PATROL LOGS CONTROL ---
    if (patrolLogs.length > 0) {
        addSectionTitle(`3. REGISTRO DE CONTROL DE PATRULLAS EN ZONA (${patrolLogs.length})`);

        const patrolHead = [['Fecha y Hora Patrulla', 'Sujetos Visibles', 'Agente Registrador', 'Observaciones de Zona']];
        const patrolBody = patrolLogs.map(pl => [
            pl.patrol_time ? new Date(pl.patrol_time).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            `${pl.people_count || 0} personas`,
            cleanPDFText(`${pl.detective_rank || ''} ${pl.detective_name || ''}`).trim() || 'Agente',
            cleanPDFText(pl.notes || '-')
        ]);

        autoTable(doc, {
            startY: y,
            head: patrolHead,
            body: patrolBody,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 2.5,
                textColor: textDark,
                lineColor: [226, 232, 240],
                lineWidth: 0.2
            },
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                alignment: 'left'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 38 },
                1: { cellWidth: 28 },
                2: { cellWidth: 42 },
                3: { cellWidth: 'auto' }
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { left: 14, right: 14 }
        });

        y = doc.lastAutoTable.finalY + 8;
    }

    // --- SECTION 4: FLEET & PROPERTIES ---
    const vehicles = gang.vehicles || [];
    const homes = gang.homes || [];

    if (vehicles.length > 0 || homes.length > 0) {
        addSectionTitle(`4. VEHÍCULOS E INMUEBLES IDENTIFICADOS`);

        if (vehicles.length > 0) {
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text("VEHÍCULOS ASOCIADOS:", 14, y);
            y += 4;

            const vehHead = [['Modelo Vehículo', 'Matrícula', 'Propietario Registrado', 'Notas']];
            const vehBody = vehicles.map(v => [
                cleanPDFText(v.model || 'Modelo desconocido'),
                cleanPDFText(v.plate || 'S/N'),
                cleanPDFText(v.owner || 'Desconocido'),
                cleanPDFText(v.notes || '-')
            ]);

            autoTable(doc, {
                startY: y,
                head: vehHead,
                body: vehBody,
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: textDark, lineColor: [226, 232, 240], lineWidth: 0.2 },
                headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { fontStyle: 'bold', cellWidth: 28 }, 2: { cellWidth: 40 }, 3: { cellWidth: 'auto' } },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 }
            });

            y = doc.lastAutoTable.finalY + 6;
        }

        if (homes.length > 0) {
            if (y > pageHeight - 35) {
                doc.addPage();
                drawPageBorder();
                y = 20;
            }

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text("INMUEBLES / PROPIEDADES VINCULADAS:", 14, y);
            y += 4;

            const homeHead = [['Propietario / Residente', 'Notas y Ubicación']];
            const homeBody = homes.map(h => [
                cleanPDFText(h.owner || 'Propietario desconocido'),
                cleanPDFText(h.notes || '-')
            ]);

            autoTable(doc, {
                startY: y,
                head: homeHead,
                body: homeBody,
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: textDark, lineColor: [226, 232, 240], lineWidth: 0.2 },
                headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 }
            });

            y = doc.lastAutoTable.finalY + 8;
        }
    }

    // --- FOOTER AND SIGNATURE AT END OF DOCUMENT ---
    if (y > pageHeight - 45) {
        doc.addPage();
        drawPageBorder();
        y = 25;
    } else {
        y = Math.max(y + 12, pageHeight - 45);
    }

    // Divider line
    doc.setLineWidth(0.4);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(14, y, pageWidth - 14, y);

    y += 5;

    // Left Official Seal & Confidentiality text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("DOSSIER DE INTELIGENCIA DE BANDAS - REGISTRO OFICIAL", 14, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text("DOCUMENTO INTERNO POLICIAL / JUDICIAL • CORTE SUPERIOR DE JUSTICIA", 14, y + 8);
    doc.text(`CÓDIGO VERIFICACIÓN: SA-GANG-${Math.floor(100000 + Math.random() * 900000)}`, 14, y + 12);

    // Right Digital Cursive Signature
    const signatureName = cleanPDFText(authorName || 'Agente Investigador');

    try {
        doc.setFont('AlexBrush', 'normal');
        doc.setFontSize(20);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(signatureName, pageWidth - 14, y + 5, { align: 'right' });
    } catch (e) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(signatureName, pageWidth - 14, y + 5, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(signatureName.toUpperCase(), pageWidth - 14, y + 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const signatureSubline = isLSSD ? 'Sheriff Criminal Unit Bureau, LSSD' : 'Detective Bureau, LSPD';
    doc.text(signatureSubline, pageWidth - 14, y + 14, { align: 'right' });

    // --- APPLY UNIFORM PAGE BORDER & PAGE NUMBERS TO ALL PAGES ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawPageBorder();

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 11, { align: 'right' });
        doc.text(`DOSSIER DE INTELIGENCIA DE BANDA: ${gangCleanName}`, 14, pageHeight - 11);
    }

    // Save File
    const sanitizedGangName = gangCleanName.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Resumen_Organizacion_${sanitizedGangName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

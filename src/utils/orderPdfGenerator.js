import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { signatureFontBase64 } from './signatureFont';

// Helper to sanitize text and remove emojis or unprintable Unicode surrogate pairs that cause corrupt PDF rendering (e.g., Ø=ßä)
const cleanPDFText = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F\uDE80-\uDEF8]|\uD83E[\uDD00-\uDDFF])/g, '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{2934}-\u{2935}\u{25AA}-\u{25AB}\u{25FB}-\u{25FE}\u{25B6}\u{25C0}\u{1F1E6}-\u{1F1FF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// Helper to convert transparent images (like WebP or PNG) to PNG DataURL via HTML5 Canvas to prevent jsPDF solid black background bugs
const loadImgAsPngDataUrl = (src) => new Promise((resolve) => {
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
 * Generates official Judicial Order PDFs.
 * @param {Object} order - Order database record
 * @param {Object} config - Order type field configurations
 * @param {Boolean} isLSSDOverride - Override for LSSD department mode
 * @param {String} pdfType - 'solicitud' (Internal investigation full record) or 'orden' (Public Warrant Mandate to deliver to citizen)
 */
export const generateOrderPDF = async (order, config, isLSSDOverride, pdfType = 'solicitud') => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Register custom signature font
    try {
        doc.addFileToVFS('AlexBrush-Regular.ttf', signatureFontBase64);
        doc.addFont('AlexBrush-Regular.ttf', 'AlexBrush', 'normal');
    } catch (e) {
        console.warn('Font registration fallback:', e);
    }
    
    // Robust detection of LSSD department theme mode
    const isLSSD = typeof isLSSDOverride === 'boolean'
        ? isLSSDOverride
        : (document.body.getAttribute('data-is-lssd') === 'true' ||
           document.body.getAttribute('data-dept-theme') === 'LSSD' ||
           document.body.classList.contains('theme-lssd') ||
           document.body.classList.contains('theme-verde') ||
           localStorage.getItem('user_selected_theme') === 'verde');

    const isPublicExecutionOrder = pdfType === 'orden';

    const primaryColor = isLSSD ? [6, 78, 59] : [30, 58, 138];       // #064e3b (LSSD) or #1e3a8a (LSPD)
    const accentGold = [212, 175, 55];                             // Gold #d4af37
    const textDark = [15, 23, 42];                                 // Slate #0f172a
    const textMuted = [100, 116, 139];                             // Slate #64748b
    const bgLight = [248, 250, 252];                               // Slate #f8fafc

    // Mandatory transparent logos: dojlogo.webp and sanandreas.webp
    const dojLogoDataUrl = await loadImgAsPngDataUrl('/logowebp/dojlogo.webp');
    const saLogoDataUrl = await loadImgAsPngDataUrl('/logowebp/sanandreas.webp');

    // Decorative Outer Border Frame
    const drawPageBorder = () => {
        doc.setLineWidth(0.5);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
        
        doc.setLineWidth(0.2);
        doc.setDrawColor(accentGold[0], accentGold[1], accentGold[2]);
        doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);
    };

    drawPageBorder();

    // --- HEADER BANNER ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(10, 10, pageWidth - 20, 4, 'F');
    doc.setFillColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.rect(10, 14, pageWidth - 20, 1, 'F');

    // Logos placement with PNG transparency
    if (dojLogoDataUrl) doc.addImage(dojLogoDataUrl, 'PNG', 14, 17, 25, 25);
    if (saLogoDataUrl) doc.addImage(saLogoDataUrl, 'PNG', pageWidth - 39, 17, 25, 25);

    // Title Text - Bureau Dynamic Name according to LSSD / LSPD mode
    const bureauName = isLSSD ? "SHERIFF CRIMINAL UNIT BUREAU" : "DETECTIVE BUREAU";
    const bureauSubtitle = isPublicExecutionOrder
        ? (isLSSD ? "SHERIFF CRIMINAL UNIT BUREAU • MANDAMIENTO DE EJECUCIÓN" : "DETECTIVE BUREAU • MANDAMIENTO DE EJECUCIÓN PÚBLICA")
        : (isLSSD ? "SHERIFF CRIMINAL UNIT BUREAU • SOLICITUD Y EXPEDIENTE" : "DETECTIVE BUREAU • DIVISION DE ORDENES JUDICIALES");
    const bureauUnit = isLSSD ? "Sheriff Criminal Unit Bureau" : "Detective Bureau";

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(bureauName, pageWidth / 2, 23, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.text(bureauSubtitle, pageWidth / 2, 29, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text("DEPARTMENT OF JUSTICE • ESTADO DE SAN ANDREAS", pageWidth / 2, 34, { align: 'center' });

    // Decorative Line Divider
    doc.setLineWidth(0.4);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(14, 45, pageWidth - 14, 45);

    // --- DOCUMENT MAIN TITLE ---
    let y = 54;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    
    const docMainHeading = isPublicExecutionOrder ? "MANDAMIENTO JUDICIAL DE EJECUCIÓN" : "SOLICITUD DE ORDEN JUDICIAL";
    doc.text(docMainHeading, pageWidth / 2, y, { align: 'center' });
    
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.text(cleanPDFText(order.order_type).toUpperCase(), pageWidth / 2, y, { align: 'center' });

    // --- METADATA BOX CARD ---
    y += 8;
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
    const prefix = isPublicExecutionOrder ? 'MAND' : 'WARR';
    doc.text("FOLIO / REGISTRO:", boxX + 6, y + 7);
    doc.text("FECHA DE EMISIÓN:", boxX + 100, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`${prefix}-${(order.id || '000000').slice(0, 8).toUpperCase()}`, boxX + 38, y + 7);
    doc.text(new Date(order.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), boxX + 132, y + 7);

    // Row 2
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(isPublicExecutionOrder ? "AUTORIDAD JUDICIAL:" : "AGENTE SOLICITANTE:", boxX + 6, y + 15);
    doc.text("ESTADO JUDICIAL:", boxX + 100, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const authorityText = isPublicExecutionOrder
        ? "FISCAL JOHN ROXTON"
        : cleanPDFText(`${order.author_rank || 'Agente'} ${order.author_name || 'Desconocido'}`).toUpperCase();
    doc.text(authorityText, boxX + 41, y + 15);

    // Status Badge inside PDF
    const status = cleanPDFText(order.status || 'Pendiente');
    let statusBg = [245, 158, 11]; // Amber
    if (status === 'Aprobada') statusBg = [16, 185, 129];
    else if (status === 'Rechazada') statusBg = [239, 68, 68];

    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(boxX + 132, y + 11.5, 24, 5, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(status.toUpperCase(), boxX + 144, y + 15, { align: 'center' });

    // Row 3
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("UNIDAD EXPEDIDORA:", boxX + 6, y + 23);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(bureauUnit, boxX + 41, y + 23);

    y += boxHeight + 8;

    // --- OFFICIAL LEGAL EXECUTION CLAUSE FOR PUBLIC ORDER ---
    if (isPublicExecutionOrder) {
        doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
        doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'F');
        doc.setLineWidth(0.8);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.line(14, y, 14, y + 22);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("NOTIFICACIÓN Y DISPOSICIÓN LEGAL DE EJECUCIÓN", 18, y + 5);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        const executionClauseText = "EN NOMBRE DEL ESTADO DE SAN ANDREAS Y LA CORTE SUPERIOR DE JUSTICIA, SE NOTIFICA A LA PERSONA, PROPIETARIO O ENTIDAD AFECTADA QUE LA PRESENTE ORDEN HA SIDO AUTORIZADA DE CONFORMIDAD CON LA LEY. SE FACULTA A LOS AGENTES DE LA FUERZA PÚBLICA PARA SU CUMPLIMIENTO E INMEDIATA EJECUCIÓN DE LAS MEDIDAS DETALLADAS A CONTINUACIÓN.";
        const splitClause = doc.splitTextToSize(executionClauseText, pageWidth - 38);
        doc.text(splitClause, 18, y + 9.5);

        y += 28;
    }

    // --- CONTENT FIELDS & TABLES ---
    const addSectionHeader = (title) => {
        const cleanTitle = cleanPDFText(title).toUpperCase();
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(cleanTitle, 14, y);
        
        doc.setLineWidth(0.3);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.line(14, y + 1.5, 14 + doc.getTextWidth(cleanTitle), y + 1.5);
        y += 6;
    };

    const addTextCallout = (label, text) => {
        const cleanedVal = cleanPDFText(text);
        if (!cleanedVal) return;
        addSectionHeader(label);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        
        const splitText = doc.splitTextToSize(cleanedVal, pageWidth - 36);
        const calloutHeight = (splitText.length * 4.5) + 6;
        
        // Page break check
        if (y + calloutHeight > pageHeight - 30) {
            doc.addPage();
            drawPageBorder();
            y = 20;
        }

        doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
        doc.roundedRect(14, y, pageWidth - 28, calloutHeight, 2, 2, 'F');
        
        doc.setLineWidth(0.8);
        doc.setDrawColor(accentGold[0], accentGold[1], accentGold[2]);
        doc.line(14, y, 14, y + calloutHeight);

        doc.text(splitText, 18, y + 5);
        y += calloutHeight + 6;
    };

    // Private internal case fields & motives to exclude when generating public execution orders for citizen delivery
    const privateInternalKeys = [
        'linked_case_id',
        'linked_case',
        'caso_vinculado',
        'linked_gang_id',
        'linked_gang',
        'banda_vinculada',
        'internal_notes',
        'private_notes',
        'probable_cause',
        'warrant_reason',
        'motivo',
        'motivo_orden',
        'motivo_registro',
        'motivo_del_registro',
        'reason',
        'justification',
        'request_date',
        'execution_details' // Handled separately for execution order
    ];

    // Iterate through content
    Object.entries(order.content || {}).forEach(([key, val]) => {
        if (!val) return;
        
        // Exclude private internal case data & motives when generating public execution order
        if (isPublicExecutionOrder && privateInternalKeys.includes(key)) {
            return;
        }

        const field = config?.fields?.find(f => f.name === key);
        const label = field ? (field.documentLabel || field.label) : key.replace(/_/g, ' ').toUpperCase();

        if (Array.isArray(val) && val.length > 0) {
            // Table rendering
            const firstItem = val[0];
            const isVehicle = firstItem.owner && firstItem.plate && firstItem.model;
            const isProperty = firstItem.owner && firstItem.address;
            const isPerson = firstItem.name && firstItem.id;
            const isPhone = firstItem.number && !firstItem.social_network;
            const isSocialMedia = firstItem.username && firstItem.social_network;
            const isSeizureVehicle = firstItem.owner_name && firstItem.vehicle && firstItem.plate;

            addSectionHeader(label);

            let head = [];
            let body = [];

            if (isVehicle) {
                head = [['Propietario', 'ID Persona', 'Modelo Vehículo', 'Matrícula']];
                body = val.map(v => [cleanPDFText(v.owner), cleanPDFText(v.id), cleanPDFText(v.model), cleanPDFText(v.plate)]);
            } else if (isProperty) {
                head = [['Propietario Inmueble', 'ID Persona', 'Dirección Ubicación']];
                body = val.map(p => [cleanPDFText(p.owner), cleanPDFText(p.id), cleanPDFText(p.address)]);
            } else if (isPerson) {
                head = [['Nombre Persona Sujeto', 'ID / DNI']];
                body = val.map(p => [cleanPDFText(p.name), cleanPDFText(p.id)]);
            } else if (isPhone) {
                head = [['Número de Teléfono Móvil']];
                body = val.map(p => [cleanPDFText(p.number)]);
            } else if (isSocialMedia) {
                head = [['Cuenta de Usuario', 'Plataforma / Red Social']];
                body = val.map(a => [cleanPDFText(a.username), cleanPDFText(a.social_network)]);
            } else if (isSeizureVehicle) {
                head = [['Propietario', 'ID', 'Vehículo a Decomisar', 'Matrícula']];
                body = val.map(s => [cleanPDFText(s.owner_name), cleanPDFText(s.owner_id), cleanPDFText(s.vehicle), cleanPDFText(s.plate)]);
            } else {
                head = [['Elemento', 'Detalle']];
                body = val.map(item => [cleanPDFText(typeof item === 'object' ? JSON.stringify(item) : String(item)), '-']);
            }

            autoTable(doc, {
                startY: y,
                head: head,
                body: body,
                theme: 'grid',
                styles: {
                    font: 'helvetica',
                    fontSize: 8.5,
                    cellPadding: 3,
                    textColor: [15, 23, 42],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.2
                },
                headStyles: {
                    fillColor: primaryColor,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    alignment: 'left'
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                },
                margin: { left: 14, right: 14 }
            });

            y = doc.lastAutoTable.finalY + 8;
        } else if (typeof val === 'string' && val.length > 50) {
            addTextCallout(label, val);
        } else {
            const cleanedVal = cleanPDFText(val);
            if (!cleanedVal) return;

            // Single regular key-value row
            if (y > pageHeight - 35) {
                doc.addPage();
                drawPageBorder();
                y = 20;
            }

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text(`${cleanPDFText(label).toUpperCase()}:`, 14, y);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(textDark[0], textDark[1], textDark[2]);
            doc.text(cleanedVal, 65, y);

            doc.setLineWidth(0.2);
            doc.setDrawColor(241, 245, 249);
            doc.line(14, y + 2, pageWidth - 14, y + 2);

            y += 7;
        }
    });

    // --- RENDER ADDITIONAL SAVED EXECUTION DETAILS ON PUBLIC ORDER ---
    if (isPublicExecutionOrder && order.content?.execution_details) {
        const execDetails = order.content.execution_details;
        
        if (execDetails.notes || execDetails.instructions || execDetails.validity) {
            addSectionHeader("DISPOSICIONES Y TÉRMINOS ADICIONALES DE EJECUCIÓN");

            if (execDetails.notes) {
                addTextCallout("Cláusulas Especiales de Ejecución", execDetails.notes);
            }
            if (execDetails.instructions) {
                addTextCallout("Instrucciones de Actuación", execDetails.instructions);
            }
            if (execDetails.validity) {
                if (y > pageHeight - 35) {
                    doc.addPage();
                    drawPageBorder();
                    y = 20;
                }
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
                doc.text("PLAZO DE VIGENCIA DE LA ORDEN:", 14, y);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(textDark[0], textDark[1], textDark[2]);
                doc.text(cleanPDFText(execDetails.validity), 68, y);
                y += 7;
            }
        }
    }

    // --- FOOTER & SIGNATURE ---
    if (y > pageHeight - 45) {
        doc.addPage();
        drawPageBorder();
        y = 25;
    } else {
        y = Math.max(y + 12, pageHeight - 45);
    }

    // Footer divider line
    doc.setLineWidth(0.4);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(14, y, pageWidth - 14, y);

    y += 5;

    // Left Official Seal Text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(isPublicExecutionOrder ? "MANDAMIENTO JUDICIAL ENTREGADO AL INTERESADO" : "EXPEDIENTE INTERNO - REGISTRO JUDICIAL", 14, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text("VALIDADO POR LA CORTE SUPERIOR Y DEPARTAMENTO DE JUSTICIA", 14, y + 8);
    doc.text(`VERIFICACIÓN OFICIAL: SA-JUD-${Math.floor(100000 + Math.random() * 900000)}`, 14, y + 12);

    // Right Digital Cursive Signature
    const signatureName = isPublicExecutionOrder
        ? 'John Roxton'
        : cleanPDFText(order.content.author_agent || order.author_name || 'Agente Judicial');

    try {
        doc.setFont('AlexBrush', 'normal');
        doc.setFontSize(20);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(signatureName, pageWidth - 14, y + 5, { align: 'right' });
    } catch (e) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(signatureName, pageWidth - 14, y + 5, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const signatureTitleLine = isPublicExecutionOrder
        ? "FISCAL JOHN ROXTON"
        : cleanPDFText(`${order.author_rank || 'Agente'} ${signatureName}`).toUpperCase();
    doc.text(signatureTitleLine, pageWidth - 14, y + 10, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const signatureSubline = isPublicExecutionOrder
        ? "Fiscalía General • Corte Superior de Justicia"
        : (isLSSD ? 'Sheriff Criminal Unit Bureau, LSSD' : 'Detective Bureau, LSPD');
    doc.text(signatureSubline, pageWidth - 14, y + 14, { align: 'right' });

    // Save document with distinct filename
    const filePrefix = isPublicExecutionOrder ? 'Orden_Ejecucion' : 'Solicitud_Judicial';
    const sanitizeFileName = cleanPDFText(order.order_type || 'Orden').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${filePrefix}_${sanitizeFileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

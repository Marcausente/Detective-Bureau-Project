import jsPDF from 'jspdf';
// eslint-disable-next-line no-unused-vars
import autoTable from 'jspdf-autotable'; // Extends jsPDF with autoTable method

export const generateOrderPDF = async (order, config) => {
    const doc = new jsPDF();
    
    // --- ASSETS ---
    const loadImg = (src) => new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
    });

    const dbLogo = await loadImg('/dblogo.png');
    const sapdLogo = await loadImg('/LOGO_SAPD.png');

    // --- HEADER ---
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Logos
    if (dbLogo) doc.addImage(dbLogo, 'PNG', 20, 10, 25, 25);
    if (sapdLogo) doc.addImage(sapdLogo, 'PNG', pageWidth - 45, 10, 25, 25);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('LOS SANTOS POLICE DEPARTMENT', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('DETECTIVE BUREAU', pageWidth / 2, 28, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(20, 38, pageWidth - 20, 38);

    // --- DOCUMENT TITLE ---
    doc.setFontSize(22);
    doc.text('SOLICITUD DE ORDEN JUDICIAL', pageWidth / 2, 55, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(order.order_type.toUpperCase(), pageWidth / 2, 63, { align: 'center' });
    doc.setTextColor(0);

    // --- METADATA ---
    let y = 80;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const addRow = (label, value) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 20, y);
        doc.setFont('helvetica', 'normal');
        
        const splitVal = doc.splitTextToSize(String(value || '-'), 130);
        doc.text(splitVal, 70, y); // Adjusted X offset for alignment
        y += (splitVal.length * 6) + 6; // Extra breathing room
    };

    // Standard Header Info
    addRow('FECHA SOLICITUD', new Date(order.created_at).toLocaleDateString() + ' ' + new Date(order.created_at).toLocaleTimeString());
    addRow('SOLICITANTE', `${order.author_rank} ${order.author_name}`);
    y += 5;

    // --- CONTENT FIELDS ---
    Object.entries(order.content).forEach(([key, val]) => {
        // Find field config to get nice label
        const field = config?.fields?.find(f => f.name === key);
        const label = field ? (field.documentLabel || field.label) : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        // Handle vehicle, property, person, phone, social media, and seizure vehicle arrays
        if (Array.isArray(val) && val.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, 20, y);
            y += 8;
            
            // Detect type based on fields
            const firstItem = val[0];
            const isVehicle = firstItem.owner && firstItem.plate && firstItem.model;
            const isProperty = firstItem.owner && firstItem.address;
            const isPerson = firstItem.name && firstItem.id;
            const isPhone = firstItem.number && !firstItem.social_network;
            const isSocialMedia = firstItem.username && firstItem.social_network;
            const isSeizureVehicle = firstItem.owner_name && firstItem.vehicle && firstItem.plate;
            
            if (isVehicle) {
                // Vehicle table
                autoTable(doc, {
                    startY: y,
                    head: [['Propietario', 'ID', 'Modelo', 'Matrícula']],
                    body: val.map(v => [v.owner, v.id || '-', v.model, v.plate]),
                    theme: 'grid',
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [100, 100, 100] },
                    margin: { left: 20, right: 20 }
                });
            } else if (isProperty) {
                // Property table
                autoTable(doc, {
                    startY: y,
                    head: [['Propietario', 'ID', 'Dirección']],
                    body: val.map(p => [p.owner, p.id || '-', p.address]),
                    theme: 'grid',
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [100, 100, 100] },
                    margin: { left: 20, right: 20 }
                });
            } else if (isPerson) {
                // Person table
                autoTable(doc, {
                    startY: y,
                    head: [['Nombre', 'ID']],
                    body: val.map(p => [p.name, p.id]),
                    theme: 'grid',
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [100, 100, 100] },
                    margin: { left: 20, right: 20 }
                });
            } else if (isPhone) {
                // Phone table
                autoTable(doc, {
                    startY: y,
                    head: [['Número de Teléfono']],
                    body: val.map(p => [p.number]),
                    theme: 'grid',
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [100, 100, 100] },
                    margin: { left: 20, right: 20 }
                });
            } else if (isSocialMedia) {
                // Social Media table
                autoTable(doc, {
                    startY: y,
                    head: [['Usuario', 'Red Social']],
                    body: val.map(a => [a.username, a.social_network]),
                    theme: 'grid',
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [100, 100, 100] },
                    margin: { left: 20, right: 20 }
                });
            } else if (isSeizureVehicle) {
                // Seizure Vehicle table
                autoTable(doc, {
                    startY: y,
                    head: [['Propietario', 'ID', 'Vehículo', 'Patente']],
                    body: val.map(s => [s.owner_name, s.owner_id, s.vehicle, s.plate]),
                    theme: 'grid',
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [100, 100, 100] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            y = doc.lastAutoTable.finalY + 10;
        } else {
            // Regular field
            addRow(label, val);
        }
    });

    // --- FOOTER / SIGNATURE ---
    y += 40;
    if (y > 270) {
        doc.addPage();
        y = 40;
    }

    const signatureName = order.content.author_agent || order.author_name;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(signatureName.toUpperCase(), pageWidth - 20, y, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Detective Bureau, LSPD', pageWidth - 20, y + 6, { align: 'right' });

    doc.save(`Orden_${order.order_type.replace(/ /g, '_')}_${new Date().getTime()}.pdf`);
};

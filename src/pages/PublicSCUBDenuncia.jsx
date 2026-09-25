import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import { sendSCUBComplaintNotificationToDiscord } from '../utils/discordWebhook';
import '../index.css';

const CRIME_TYPES = [
    'Robo con Violencia / Atraco',
    'Agresión Física / Lesiones',
    'Amenazas y Coacciones',
    'Intento de Homicidio / Disparos',
    'Hurto / Robo de Vehículo',
    'Tráfico de Drogas / Sustancias',
    'Estafa / Fraude Económico',
    'Secuestro / Retención Ilegal',
    'Extorsión / Chantaje',
    'Daños a la Propiedad Pública / Privada',
    'Porte Ilegal de Armas',
    'Allanamiento de Morada',
    'Otro Delito Penal'
];

export default function PublicSCUBDenuncia() {
    const navigate = useNavigate();
    const { isLSSD, branding } = useTheme();

    // Ensure scrolling works
    useEffect(() => {
        const prevOverflowY = document.body.style.overflowY;
        const prevHeight = document.body.style.height;
        document.body.style.overflowY = 'auto';
        document.body.style.height = 'auto';
        return () => {
            document.body.style.overflowY = prevOverflowY;
            document.body.style.height = prevHeight;
        };
    }, []);

    // Form states
    const [complainants, setComplainants] = useState([{ nombre_apellido: '', telefono: '', id_documento: '' }]);
    const [accusedList, setAccusedList] = useState([{ nombre_apellido: '', rasgos_fisicos: '', telefono: '', id_documento: '', instapic: '' }]);
    
    const [titulo, setTitulo] = useState('');
    const [motivoSelect, setMotivoSelect] = useState('Robo con Violencia / Atraco');
    const [motivoOtro, setMotivoOtro] = useState('');
    const [acontecimientos, setAcontecimientos] = useState('');
    const [solicitud, setSolicitud] = useState('');
    const [enlacePrueba, setEnlacePrueba] = useState('');
    const [imagenBase64, setImagenBase64] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedId, setSubmittedId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Complainants Handlers
    const handleAddComplainant = () => {
        setComplainants(prev => [...prev, { nombre_apellido: '', telefono: '', id_documento: '' }]);
    };

    const handleRemoveComplainant = (index) => {
        if (complainants.length > 1) {
            setComplainants(prev => prev.filter((_, idx) => idx !== index));
        }
    };

    const handleComplainantChange = (index, field, value) => {
        setComplainants(prev => prev.map((c, idx) => idx === index ? { ...c, [field]: value } : c));
    };

    // Accused Handlers
    const handleAddAccused = () => {
        setAccusedList(prev => [...prev, { nombre_apellido: '', rasgos_fisicos: '', telefono: '', id_documento: '', instapic: '' }]);
    };

    const handleRemoveAccused = (index) => {
        if (accusedList.length > 1) {
            setAccusedList(prev => prev.filter((_, idx) => idx !== index));
        }
    };

    const handleAccusedChange = (index, field, value) => {
        setAccusedList(prev => prev.map((a, idx) => idx === index ? { ...a, [field]: value } : a));
    };

    // Image Upload
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setImagenBase64(dataUrl);
            };
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg('');

        try {
            const primaryComplainant = complainants[0];
            if (!primaryComplainant.nombre_apellido.trim()) {
                throw new Error('Por favor, introduce el nombre completo del denunciante principal.');
            }
            if (!primaryComplainant.telefono.trim()) {
                throw new Error('Por favor, proporciona un teléfono de contacto.');
            }
            if (!titulo.trim()) {
                throw new Error('Por favor, indica un asunto o título para la denuncia.');
            }
            if (!acontecimientos.trim()) {
                throw new Error('Por favor, describe los hechos ocurridos con el mayor detalle posible.');
            }

            const finalMotivo = motivoSelect === 'Otro Delito Penal' ? (motivoOtro.trim() || 'Otro Delito Penal') : motivoSelect;

            let uploadedImageUrl = '';
            if (imagenBase64 && imagenBase64.startsWith('data:')) {
                uploadedImageUrl = await uploadImageToStorage(imagenBase64, 'complaints');
            } else if (imagenBase64) {
                uploadedImageUrl = imagenBase64;
            }

            // Clean accused entries (fill empty with N/A)
            const cleanedAccused = accusedList.map(a => ({
                nombre_apellido: a.nombre_apellido.trim() || 'N/A',
                rasgos_fisicos: a.rasgos_fisicos.trim() || 'N/A',
                telefono: a.telefono.trim() || 'N/A',
                id_documento: a.id_documento.trim() || 'N/A',
                instapic: a.instapic.trim() || 'N/A'
            }));

            // Format final text with external link if provided
            let finalAcontecimientosText = acontecimientos.trim();
            if (enlacePrueba && enlacePrueba.trim()) {
                finalAcontecimientosText += `\n\n**Enlaces / Pruebas Externas:**\n${enlacePrueba.trim()}`;
            }

            // Insert using public RPC
            let createdId = null;
            const { data: rpcData, error: rpcError } = await supabase.rpc('create_public_denuncia', {
                p_complainants: complainants,
                p_accused: cleanedAccused,
                p_motivo: finalMotivo,
                p_acontecimientos: finalAcontecimientosText,
                p_solicitud: solicitud.trim() || null,
                p_notas: 'Registrada vía Formulario Público Web',
                p_image_url: uploadedImageUrl || null,
                p_titulo: titulo.trim()
            });

            if (rpcError) {
                // Direct fallback insert to denuncias table
                const { data: directData, error: directError } = await supabase
                    .from('denuncias')
                    .insert({
                        status: 'Open',
                        complainants: complainants,
                        accused: cleanedAccused,
                        motivo: finalMotivo,
                        acontecimientos: finalAcontecimientosText,
                        solicitud: solicitud.trim() || null,
                        notas: 'Registrada vía Formulario Público Web',
                        image_url: uploadedImageUrl || null,
                        titulo: titulo.trim()
                    })
                    .select('id')
                    .single();

                if (directError) throw directError;
                createdId = directData?.id;
            } else {
                createdId = rpcData;
            }

            setSubmittedId(createdId);

            // Dispatch Discord Webhook Notification asynchronously
            sendSCUBComplaintNotificationToDiscord({
                id: createdId,
                titulo: titulo.trim(),
                motivo: finalMotivo,
                complainants: complainants,
                accused: cleanedAccused,
                acontecimientos: finalAcontecimientosText,
                solicitud: solicitud.trim() || null,
                image_url: uploadedImageUrl || null
            }).catch(err => console.error("Error enviando alerta Discord SCUB:", err));

            setSubmitted(true);
            const container = document.getElementById('public-scub-denuncia-container');
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('Error al registrar denuncia SCUB:', err);
            setErrorMsg(err.message || 'Ocurrió un error al enviar el formulario.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setComplainants([{ nombre_apellido: '', telefono: '', id_documento: '' }]);
        setAccusedList([{ nombre_apellido: '', rasgos_fisicos: '', telefono: '', id_documento: '', instapic: '' }]);
        setTitulo('');
        setMotivoSelect('Robo con Violencia / Atraco');
        setMotivoOtro('');
        setAcontecimientos('');
        setSolicitud('');
        setEnlacePrueba('');
        setImagenBase64('');
        setSubmitted(false);
        setSubmittedId(null);
        setErrorMsg('');
        const container = document.getElementById('public-scub-denuncia-container');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const brandColor = isLSSD ? '#10b981' : '#f59e0b';
    const brandColorDark = isLSSD ? '#059669' : '#d97706';
    const brandBadgeBg = isLSSD ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
    const brandBadgeBorder = isLSSD ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)';

    return (
        <div
            id="public-scub-denuncia-container"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                backgroundColor: '#0b0f17',
                color: '#f1f5f9',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                zIndex: 10
            }}
        >
            {/* Top Navigation Bar */}
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                backgroundColor: '#101622',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0.85rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <img
                        src={branding?.complaints_logo || branding?.topbar_logo || (isLSSD ? "/logowebp/SCUB.webp" : "/logowebp/Generalcrimes.webp")}
                        alt="Logo"
                        style={{ width: '38px', height: '38px', objectFit: 'contain' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/logowebp/SCUB.webp";
                        }}
                    />
                    <div>
                        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {branding?.dashboard_title || (isLSSD ? "LOS SANTOS COUNTY SHERIFF" : "DETECTIVE BUREAU")}
                            <span style={{
                                fontSize: '0.65rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: brandBadgeBg,
                                color: brandColor,
                                border: `1px solid ${brandBadgeBorder}`,
                                fontWeight: 700,
                                letterSpacing: '0.04em'
                            }}>
                                FORMULARIO OFICIAL
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {branding?.complaints_title || "Registro General de Denuncias Ciudadanas"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/')}
                    style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                >
                    Portal de Acceso
                </button>
            </header>

            {/* Main Content Area */}
            <main style={{
                maxWidth: '900px',
                margin: '0 auto',
                padding: '2rem 1.25rem 4rem 1.25rem'
            }}>
                {submitted ? (
                    /* SUCCESS SCREEN */
                    <div style={{
                        background: '#131926',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        textAlign: 'center',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid #10b981',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>

                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                            ¡Denuncia Registrada Correctamente!
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '540px', margin: '0 auto 1.5rem auto', lineHeight: '1.5' }}>
                            Su reporte ha sido recibido e ingresado de forma segura en la Base de Datos. El equipo de detectives de la división revisará la información y se pondrá en contacto si es necesario ampliar las diligencias.
                        </p>

                        {submittedId && (
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '1rem',
                                maxWidth: '420px',
                                margin: '0 auto 2rem auto',
                                fontSize: '0.85rem'
                            }}>
                                <span style={{ color: '#94a3b8' }}>Código de Referencia:</span>
                                <div style={{ color: brandColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem', marginTop: '4px' }}>
                                    {submittedId}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleReset}
                                style={{
                                    padding: '0.65rem 1.25rem',
                                    borderRadius: '8px',
                                    background: brandColor,
                                    border: 'none',
                                    color: '#ffffff',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Registrar Otra Denuncia
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                style={{
                                    padding: '0.65rem 1.25rem',
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#cbd5e1',
                                    fontSize: '0.88rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                Volver al Inicio
                            </button>
                        </div>
                    </div>
                ) : (
                    /* MAIN FORM */
                    <div style={{
                        background: '#131926',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '2rem'
                    }}>
                        {/* Header description */}
                        <div style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: brandColor, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <span>{branding?.complaints_title || "Registro General de Denuncias Penales"}</span>
                            </div>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                                Presentación Telemática de Denuncia
                            </h1>
                            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, lineHeight: '1.5' }}>
                                Por favor, complete los campos con la información más precisa y detallada posible. Toda la información enviada será tratada de acuerdo con las normativas procesales y de protección de datos vigentes.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            
                            {/* SECCIÓN 1: DATOS DEL DENUNCIANTE / VÍCTIMA */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>1</span>
                                        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Datos del Denunciante / Víctima</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddComplainant}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            color: '#38bdf8',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + Añadir Víctima / Denunciante
                                    </button>
                                </div>

                                {complainants.map((comp, idx) => (
                                    <div key={idx} style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '1rem',
                                        marginBottom: idx < complainants.length - 1 ? '1rem' : 0,
                                        paddingBottom: idx < complainants.length - 1 ? '1rem' : 0,
                                        borderBottom: idx < complainants.length - 1 ? '1px dashed rgba(255,255,255,0.06)' : 'none',
                                        position: 'relative'
                                    }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Nombre y Apellidos <span style={{ color: '#f87171' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={comp.nombre_apellido}
                                                onChange={(e) => handleComplainantChange(idx, 'nombre_apellido', e.target.value)}
                                                placeholder="Ej: John Doe"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.75rem',
                                                    background: '#131926',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: '#ffffff',
                                                    fontSize: '0.85rem'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Teléfono de Contacto <span style={{ color: '#f87171' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={comp.telefono}
                                                onChange={(e) => handleComplainantChange(idx, 'telefono', e.target.value)}
                                                placeholder="Ej: 555-0143"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.75rem',
                                                    background: '#131926',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: '#ffffff',
                                                    fontSize: '0.85rem'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Documento de Identidad / DNI (Opcional)
                                            </label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <input
                                                    type="text"
                                                    value={comp.id_documento}
                                                    onChange={(e) => handleComplainantChange(idx, 'id_documento', e.target.value)}
                                                    placeholder="Ej: 89431A"
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.6rem 0.75rem',
                                                        background: '#131926',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '8px',
                                                        color: '#ffffff',
                                                        fontSize: '0.85rem'
                                                    }}
                                                />
                                                {complainants.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveComplainant(idx)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            color: '#f87171',
                                                            padding: '0 8px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Eliminar denunciante"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* SECCIÓN 2: DATOS DEL ACUSADO / SOSPECHOSO */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>2</span>
                                        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Datos del Denunciado / Sospechoso</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddAccused}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            color: '#f59e0b',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + Añadir Sospechoso
                                    </button>
                                </div>

                                {accusedList.map((acc, idx) => (
                                    <div key={idx} style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '1rem',
                                        marginBottom: idx < accusedList.length - 1 ? '1rem' : 0,
                                        paddingBottom: idx < accusedList.length - 1 ? '1rem' : 0,
                                        borderBottom: idx < accusedList.length - 1 ? '1px dashed rgba(255,255,255,0.06)' : 'none'
                                    }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Nombre / Alias (si se conoce)
                                            </label>
                                            <input
                                                type="text"
                                                value={acc.nombre_apellido}
                                                onChange={(e) => handleAccusedChange(idx, 'nombre_apellido', e.target.value)}
                                                placeholder="Ej: 'El Flaco' / Desconocido"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.75rem',
                                                    background: '#131926',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: '#ffffff',
                                                    fontSize: '0.85rem'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Rasgos Físicos / Vestimenta
                                            </label>
                                            <input
                                                type="text"
                                                value={acc.rasgos_fisicos}
                                                onChange={(e) => handleAccusedChange(idx, 'rasgos_fisicos', e.target.value)}
                                                placeholder="Ej: Alto, sudadera negra, tatuaje en cuello..."
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.75rem',
                                                    background: '#131926',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: '#ffffff',
                                                    fontSize: '0.85rem'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Vehículo / Matrícula / Redes
                                            </label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <input
                                                    type="text"
                                                    value={acc.instapic}
                                                    onChange={(e) => handleAccusedChange(idx, 'instapic', e.target.value)}
                                                    placeholder="Ej: Karin Sultan Negro / @usuario"
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.6rem 0.75rem',
                                                        background: '#131926',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '8px',
                                                        color: '#ffffff',
                                                        fontSize: '0.85rem'
                                                    }}
                                                />
                                                {accusedList.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAccused(idx)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            color: '#f87171',
                                                            padding: '0 8px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Eliminar sospechoso"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* SECCIÓN 3: DETALLES DE LA DENUNCIA */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>3</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Detalles de la Denuncia</h2>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* Titulo */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                            Asunto / Título de la Denuncia <span style={{ color: '#f87171' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={titulo}
                                            onChange={(e) => setTitulo(e.target.value)}
                                            placeholder="Ej: Robo con violencia en gasolinera de Strawberry"
                                            style={{
                                                width: '100%',
                                                padding: '0.65rem 0.8rem',
                                                background: '#131926',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem'
                                            }}
                                        />
                                    </div>

                                    {/* Motivo */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                Tipo de Delito / Motivo Principal <span style={{ color: '#f87171' }}>*</span>
                                            </label>
                                            <select
                                                value={motivoSelect}
                                                onChange={(e) => setMotivoSelect(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.65rem 0.8rem',
                                                    background: '#131926',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: '#ffffff',
                                                    fontSize: '0.88rem'
                                                }}
                                            >
                                                {CRIME_TYPES.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {motivoSelect === 'Otro Delito Penal' && (
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                                    Especificar Tipo de Delito <span style={{ color: '#f87171' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={motivoOtro}
                                                    onChange={(e) => setMotivoOtro(e.target.value)}
                                                    placeholder="Ej: Falsificación de documentos"
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.65rem 0.8rem',
                                                        background: '#131926',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '8px',
                                                        color: '#ffffff',
                                                        fontSize: '0.88rem'
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Acontecimientos */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                            Relato Detallado de los Hechos (Fecha, Lugar y Qué Ocurrió) <span style={{ color: '#f87171' }}>*</span>
                                        </label>
                                        <textarea
                                            rows={5}
                                            required
                                            value={acontecimientos}
                                            onChange={(e) => setAcontecimientos(e.target.value)}
                                            placeholder="Describa de forma cronológica cómo ocurrieron los hechos, lugar exacto, fecha y hora aproximada, número de personas implicadas, armas utilizadas o cualquier detalle relevante..."
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                background: '#131926',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.85rem',
                                                resize: 'vertical',
                                                lineHeight: '1.5'
                                            }}
                                        />
                                    </div>

                                    {/* Solicitud */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                            Solicitud de la Víctima / Medidas Reclamadas (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={solicitud}
                                            onChange={(e) => setSolicitud(e.target.value)}
                                            placeholder="Ej: Orden de alejamiento, recuperación de objetos robados, compensación de daños..."
                                            style={{
                                                width: '100%',
                                                padding: '0.65rem 0.8rem',
                                                background: '#131926',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN 4: PRUEBAS Y ARCHIVOS */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>4</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Pruebas y Documentación Adjunta</h2>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                            Adjuntar Fotografía / Captura (Imagen)
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            style={{
                                                width: '100%',
                                                padding: '0.55rem',
                                                background: '#131926',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#94a3b8',
                                                fontSize: '0.8rem'
                                            }}
                                        />
                                        {imagenBase64 && (
                                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <img src={imagenBase64} alt="Preview" style={{ height: '48px', width: 'auto', borderRadius: '6px', objectFit: 'cover' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => setImagenBase64('')}
                                                    style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer' }}
                                                >
                                                    Quitar imagen
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                                            Enlace a Pruebas Externas (Vídeo, Grabación, Nube)
                                        </label>
                                        <input
                                            type="url"
                                            value={enlacePrueba}
                                            onChange={(e) => setEnlacePrueba(e.target.value)}
                                            placeholder="https://youtube.com/... o enlace de Drive"
                                            style={{
                                                width: '100%',
                                                padding: '0.65rem 0.8rem',
                                                background: '#131926',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Error Alert */}
                            {errorMsg && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '8px',
                                    padding: '0.75rem 1rem',
                                    color: '#f87171',
                                    fontSize: '0.85rem',
                                    fontWeight: 500
                                }}>
                                    ⚠️ {errorMsg}
                                </div>
                            )}

                            {/* Submit Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '0.85rem 2rem',
                                        borderRadius: '8px',
                                        background: `linear-gradient(135deg, ${brandColor}, ${brandColorDark})`,
                                        border: 'none',
                                        color: '#ffffff',
                                        fontSize: '0.95rem',
                                        fontWeight: 700,
                                        cursor: submitting ? 'wait' : 'pointer',
                                        boxShadow: `0 4px 14px ${isLSSD ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    {submitting ? 'Enviando Denuncia...' : '📜 Presentar Denuncia Oficial'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}

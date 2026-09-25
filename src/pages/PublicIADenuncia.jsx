import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

function PublicIADenuncia() {
    const navigate = useNavigate();
    const { isLSSD, branding } = useTheme();

    // Ensure body allows scroll when this page is open
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

    // Form fields
    const [nombreDenunciante, setNombreDenunciante] = useState('');
    const [telefonoDenunciante, setTelefonoDenunciante] = useState('');
    const [denunciadoNombrePlaca, setDenunciadoNombrePlaca] = useState('');
    const [fechaHechos, setFechaHechos] = useState('');
    const [motivoSelect, setMotivoSelect] = useState('Abuso de autoridad');
    const [motivoOtro, setMotivoOtro] = useState('');
    const [declaracion, setDeclaracion] = useState('');
    const [enlacePrueba, setEnlacePrueba] = useState('');
    const [imagenBase64, setImagenBase64] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const MOTIVOS_PREDEFINIDOS = [
        { id: 'Abuso de autoridad', label: 'Abuso de Autoridad', desc: 'Uso indebido del poder policial o intimidación', iconType: 'authority' },
        { id: 'Uso excesivo de fuerza', label: 'Uso Excesivo de Fuerza', desc: 'Fuerza física desmedida o injustificada', iconType: 'force' },
        { id: 'Corrupción / Soborno', label: 'Corrupción / Soborno', desc: 'Cohecho, dádivas, extorsión o favores ilícitos', iconType: 'corruption' },
        { id: 'Falta de ética / Profesionalismo', label: 'Falta de Ética', desc: 'Conducta indebida, trato despectivo o negligencia', iconType: 'ethics' },
        { id: 'Otro', label: 'Otro Motivo', desc: 'Especificar circunstancias particulares del incidente', iconType: 'other' }
    ];

    const renderMotivoIcon = (type, color = 'currentColor', size = 18) => {
        switch (type) {
            case 'authority':
                return (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                );
            case 'force':
                return (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                );
            case 'corruption':
                return (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                );
            case 'ethics':
                return (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                );
            case 'other':
            default:
                return (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                );
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
            alert("La imagen es demasiado grande. El límite es 8MB.");
            return;
        }

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
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setImagenBase64(dataUrl);
            };
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg('');

        try {
            const finalMotivo = motivoSelect === 'Otro' ? motivoOtro : motivoSelect;
            if (motivoSelect === 'Otro' && !motivoOtro.trim()) {
                throw new Error("Por favor, especifica el motivo de la denuncia.");
            }

            let uploadedImageUrl = '';
            if (imagenBase64 && imagenBase64.startsWith('data:')) {
                uploadedImageUrl = await uploadImageToStorage(imagenBase64, 'complaints');
            } else if (imagenBase64) {
                uploadedImageUrl = imagenBase64;
            }

            let finalPruebas = '';
            if (enlacePrueba && uploadedImageUrl) {
                finalPruebas = `Enlace: ${enlacePrueba}\nImagen adjunta: ${uploadedImageUrl}`;
            } else if (enlacePrueba) {
                finalPruebas = enlacePrueba;
            } else if (uploadedImageUrl) {
                finalPruebas = uploadedImageUrl;
            }

            const { error } = await supabase.from('ia_complaints').insert({
                denunciante_nombre: nombreDenunciante.trim(),
                denunciante_telefono: telefonoDenunciante.trim(),
                denunciado_nombre_placa: denunciadoNombrePlaca.trim(),
                fecha_hechos: fechaHechos,
                motivo: finalMotivo,
                declaracion: declaracion.trim(),
                pruebas: finalPruebas || null
            });

            if (error) throw error;

            setSubmitted(true);
            const container = document.getElementById('public-denuncia-scroll-container');
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error("Error al enviar denuncia:", err);
            setErrorMsg(err.message || "Ocurrió un error al enviar el formulario.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setNombreDenunciante('');
        setTelefonoDenunciante('');
        setDenunciadoNombrePlaca('');
        setFechaHechos('');
        setMotivoSelect('Abuso de autoridad');
        setMotivoOtro('');
        setDeclaracion('');
        setEnlacePrueba('');
        setImagenBase64('');
        setSubmitted(false);
        setErrorMsg('');
        const container = document.getElementById('public-denuncia-scroll-container');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Color tokens
    const brandColor = isLSSD ? '#10b981' : '#3b82f6';
    const brandColorDark = isLSSD ? '#059669' : '#2563eb';
    const brandBadgeBg = isLSSD ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)';
    const brandBadgeBorder = isLSSD ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)';

    return (
        <div 
            id="public-denuncia-scroll-container"
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
                        src={branding?.ia_form_logo || (isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp")}
                        alt="Logo"
                        style={{ width: '38px', height: '38px', objectFit: 'contain' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp";
                        }}
                    />
                    <div>
                        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {branding?.ia_form_dept || (isLSSD ? "LOS SANTOS COUNTY SHERIFF" : "ASUNTOS INTERNOS")}
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
                                {branding?.ia_form_badge || "OFICIAL"}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.03em' }}>
                            {branding?.ia_form_subtitle || "Buzón Ciudadano de Quejas y Denuncias"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Volver al Inicio
                </button>
            </header>

            {/* Content Area */}
            <div style={{
                maxWidth: '780px',
                margin: '0 auto',
                padding: '2.5rem 1.25rem 6rem 1.25rem'
            }}>
                {submitted ? (
                    /* SUCCESS CONFIRMATION PANEL */
                    <div style={{
                        background: '#131926',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '3rem 2rem',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem auto',
                            color: '#10b981'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>

                        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
                            Denuncia Registrada con Éxito
                        </h2>

                        <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: '1.6', maxWidth: '540px', margin: '0 auto 1.75rem auto' }}>
                            Su reporte ha sido recibido de forma confidencial por la división de Asuntos Internos. Un oficial instructor analizará los hechos y pruebas aportadas.
                        </p>

                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#cbd5e1',
                            fontSize: '0.8rem',
                            marginBottom: '2rem'
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span>Protocolo de Confidencialidad y Protección Activo</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleReset}
                                style={{
                                    padding: '0.65rem 1.25rem',
                                    borderRadius: '8px',
                                    background: brandColor,
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Enviar Otra Denuncia
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
                                Volver al Menú Principal
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
                                <span>{branding?.ia_form_badge || 'Formulario de Denuncia Disciplinaria'}</span>
                            </div>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                                {branding?.ia_form_title || 'Registro de Denuncia Ciudadana'}
                            </h1>
                            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, lineHeight: '1.5' }}>
                                {branding?.ia_form_desc || 'Rellene los campos con los datos precisos sobre los hechos ocurridos. Todos los envíos son procesados de forma reservada.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            
                            {/* SECCIÓN 1: DATOS DEL DENUNCIANTE */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>1</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Datos del Denunciante</h2>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Nombre Completo *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: John Doe"
                                            value={nombreDenunciante}
                                            onChange={(e) => setNombreDenunciante(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.65rem 0.8rem',
                                                background: '#141c2c',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Teléfono de Contacto *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: 555-0192"
                                            value={telefonoDenunciante}
                                            onChange={(e) => setTelefonoDenunciante(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.65rem 0.8rem',
                                                background: '#141c2c',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN 2: DATOS DEL OFICIAL DENUNCIADO */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>2</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Oficial o Agente Involucrado</h2>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Nombre y/o Placa del Denunciado *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder={isLSSD ? "Ej: Deputy Miller (Placa 304)" : "Ej: Agente Rodriguez (Placa 120)"}
                                            value={denunciadoNombrePlaca}
                                            onChange={(e) => setDenunciadoNombrePlaca(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.65rem 0.8rem',
                                                background: '#141c2c',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Fecha del Incidente *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={fechaHechos}
                                            onChange={(e) => setFechaHechos(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.65rem 0.8rem',
                                                background: '#141c2c',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                colorScheme: 'dark'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN 3: MOTIVO PRINCIPAL */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>3</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Tipo de Falta / Motivo *</h2>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
                                    {MOTIVOS_PREDEFINIDOS.map((item) => {
                                        const isSelected = motivoSelect === item.id;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setMotivoSelect(item.id)}
                                                style={{
                                                    padding: '0.75rem 0.85rem',
                                                    borderRadius: '8px',
                                                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : '#141c2c',
                                                    border: isSelected ? `1.5px solid ${brandColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.2rem' }}>
                                                    <span style={{ color: isSelected ? brandColor : '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                                        {renderMotivoIcon(item.iconType, isSelected ? brandColor : '#94a3b8', 16)}
                                                    </span>
                                                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: isSelected ? '#93c5fd' : '#64748b' }}>
                                                    {item.desc}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {motivoSelect === 'Otro' && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Especifique el Motivo Concreto *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Registro ilegal de vehículo o vivienda"
                                            value={motivoOtro}
                                            onChange={(e) => setMotivoOtro(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.65rem 0.8rem',
                                                background: '#141c2c',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* SECCIÓN 4: DECLARACIÓN */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>4</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Declaración y Relato de los Hechos *</h2>
                                </div>

                                <textarea
                                    required
                                    rows="5"
                                    placeholder="Describa de forma cronológica los hechos: lugar, contexto, conducta del agente y cualquier testigo presente..."
                                    value={declaracion}
                                    onChange={(e) => setDeclaracion(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '0.75rem',
                                        background: '#141c2c',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        lineHeight: '1.5',
                                        outline: 'none',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            {/* SECCIÓN 5: PRUEBAS */}
                            <div style={{
                                background: '#0e1420',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: brandColor, background: brandBadgeBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${brandBadgeBorder}` }}>5</span>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>Pruebas y Documentos (Opcional)</h2>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Enlace a Grabación / Video (YouTube, Streamable, Drive...)
                                        </label>
                                        <input
                                            type="url"
                                            placeholder="https://..."
                                            value={enlacePrueba}
                                            onChange={(e) => setEnlacePrueba(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.65rem 0.8rem',
                                                background: '#141c2c',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '0.88rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                            Captura o Fotografía Adjunta
                                        </label>
                                        <label
                                            htmlFor="ia-image-upload"
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '1.25rem',
                                                borderRadius: '8px',
                                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                                background: '#141c2c',
                                                cursor: 'pointer',
                                                transition: 'border-color 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = brandColor}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                                        >
                                            <input
                                                id="ia-image-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                style={{ display: 'none' }}
                                            />
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.35rem' }}>
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                <circle cx="12" cy="13" r="4" />
                                            </svg>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>
                                                {imagenBase64 ? 'Imagen adjuntada correctamente' : 'Haga clic para subir una captura'}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                                PNG, JPG, WEBP hasta 8MB
                                            </span>
                                        </label>

                                        {imagenBase64 && (
                                            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px', background: '#141c2c', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                <img
                                                    src={imagenBase64}
                                                    alt="Preview"
                                                    style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>
                                                    Imagen lista para adjuntar
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setImagenBase64('')}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        color: '#f87171',
                                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                                        borderRadius: '6px',
                                                        padding: '3px 8px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 500,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {errorMsg && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#fca5a5',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            {/* BOTÓN DE ENVÍO */}
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    width: '100%',
                                    padding: '0.85rem',
                                    borderRadius: '8px',
                                    background: submitting ? '#334155' : brandColorDark,
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '0.92rem',
                                    fontWeight: 600,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'background 0.15s ease'
                                }}
                            >
                                {submitting ? (
                                    <span>Enviando denuncia...</span>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        <span>Presentar Denuncia Oficial</span>
                                    </>
                                )}
                            </button>

                            <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#64748b', lineHeight: '1.4' }}>
                                Sus datos quedan bajo la custodia de la división de Asuntos Internos de acuerdo a los protocolos disciplinarios vigentes.
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PublicIADenuncia;

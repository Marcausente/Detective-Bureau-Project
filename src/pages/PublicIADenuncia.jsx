import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

function PublicIADenuncia() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();

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
        { id: 'Abuso de autoridad', label: 'Abuso de Autoridad', icon: '🚫', desc: 'Uso indebido del poder policial' },
        { id: 'Uso excesivo de fuerza', label: 'Uso Excesivo de Fuerza', icon: '⚡', desc: 'Fuerza desmedida o injustificada' },
        { id: 'Corrupción / Soborno', label: 'Corrupción / Soborno', icon: '💵', desc: 'Cohecho, dádivas o extorsión' },
        { id: 'Falta de ética / Profesionalismo', label: 'Falta de Ética', icon: '📋', desc: 'Conducta inapropiada en servicio' },
        { id: 'Otro', label: 'Otro Motivo', icon: '✏️', desc: 'Especificar circunstancias particulares' }
    ];

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

            // Combine video link and uploaded image URL into a unified pruebas text
            let finalPruebas = '';
            if (enlacePrueba && uploadedImageUrl) {
                finalPruebas = `Enlace: ${enlacePrueba}\nImagen adjunta: ${uploadedImageUrl}`;
            } else if (enlacePrueba) {
                finalPruebas = enlacePrueba;
            } else if (uploadedImageUrl) {
                finalPruebas = uploadedImageUrl;
            }

            const { error } = await supabase.from('ia_complaints').insert({
                denunciante_nombre: nombreDenunciante,
                denunciante_telefono: telefonoDenunciante,
                denunciado_nombre_placa: denunciadoNombrePlaca,
                fecha_hechos: fechaHechos,
                motivo: finalMotivo,
                declaracion: declaracion,
                pruebas: finalPruebas || null
            });

            if (error) throw error;

            setSubmitted(true);
        } catch (err) {
            console.error("Error al enviar denuncia:", err);
            setErrorMsg(err.message || "Ocurrió un error inesperado al enviar el formulario.");
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
    };

    // Theme Color Tokens
    const primaryAccent = isLSSD ? '#34d399' : '#f43f5e';
    const primaryAccentGlow = isLSSD ? 'rgba(52, 211, 153, 0.35)' : 'rgba(244, 63, 94, 0.35)';
    const primaryAccentBg = isLSSD ? 'rgba(52, 211, 153, 0.12)' : 'rgba(244, 63, 94, 0.12)';
    const primaryAccentBorder = isLSSD ? 'rgba(52, 211, 153, 0.3)' : 'rgba(244, 63, 94, 0.3)';

    return (
        <div 
            style={{ 
                minHeight: '100vh',
                width: '100vw',
                overflowX: 'hidden',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                background: isLSSD 
                    ? 'radial-gradient(ellipse at 50% 10%, rgba(16, 185, 129, 0.15) 0%, rgba(10, 15, 13, 0.98) 70%), #070d0a' 
                    : 'radial-gradient(ellipse at 50% 10%, rgba(225, 29, 72, 0.15) 0%, rgba(15, 23, 42, 0.98) 70%), #090d16',
                color: '#f8fafc',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif'
            }}
        >
            {/* Ambient Background Decorative Grid */}
            <div 
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    pointerEvents: 'none',
                    zIndex: 0
                }}
            />

            {/* Apple macOS Top Bar Navigation */}
            <header 
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    backdropFilter: 'blur(25px)',
                    WebkitBackdropFilter: 'blur(25px)',
                    backgroundColor: isLSSD ? 'rgba(10, 20, 14, 0.75)' : 'rgba(15, 23, 42, 0.75)',
                    borderBottom: `1px solid ${primaryAccentBorder}`,
                    padding: '0.85rem 2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img 
                        src={isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp"} 
                        alt="IA Logo" 
                        style={{
                            width: '42px',
                            height: '42px',
                            objectFit: 'contain',
                            filter: `drop-shadow(0 0 12px ${primaryAccentGlow})`
                        }} 
                    />
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isLSSD ? "LOS SANTOS COUNTY SHERIFF" : "ASUNTOS INTERNOS"}
                            <span style={{ 
                                fontSize: '0.68rem', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                background: primaryAccentBg, 
                                color: primaryAccent, 
                                border: `1px solid ${primaryAccentBorder}`,
                                fontWeight: 700,
                                letterSpacing: '0.04em'
                            }}>
                                OFICIAL
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.06em', fontWeight: 500 }}>
                            PORTAL DE DENUNCIAS Y RECLAMACIONES CIUDADANAS
                        </div>
                    </div>
                </div>

                {/* Return button */}
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.45rem 1rem',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#e2e8f0',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Volver al Inicio
                </button>
            </header>

            {/* Main Content Area */}
            <main style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 1.25rem 4rem 1.25rem' }}>
                {submitted ? (
                    /* SUCCESS SCREEN (APPLE CONFIRMATION CARD) */
                    <div 
                        style={{
                            maxWidth: '620px',
                            width: '100%',
                            background: 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                            border: `1px solid ${isLSSD ? 'rgba(52, 211, 153, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`,
                            borderRadius: '24px',
                            padding: '3rem 2.5rem',
                            textAlign: 'center',
                            boxShadow: '0 30px 70px rgba(0, 0, 0, 0.6), 0 0 40px rgba(52, 211, 153, 0.15)',
                            animation: 'fadeIn 0.4s ease-out'
                        }}
                    >
                        {/* macOS Window Dots */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '2rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                        </div>

                        {/* Animated Glowing Icon */}
                        <div 
                            style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, rgba(52, 211, 153, 0.05) 70%)',
                                border: '2px solid #34d399',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem auto',
                                color: '#34d399',
                                fontSize: '2.5rem',
                                boxShadow: '0 0 30px rgba(52, 211, 153, 0.35)'
                            }}
                        >
                            ✓
                        </div>

                        <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
                            Denuncia Registrada con Éxito
                        </h2>

                        <p style={{ color: '#94a3b8', fontSize: '0.98rem', lineHeight: '1.65', marginBottom: '1.75rem' }}>
                            Su reporte ha sido transferido de forma segura al buzón directo de la división de <strong style={{ color: '#ffffff' }}>Asuntos Internos</strong>. Todos los datos, declaraciones y evidencias aportadas quedan bajo el protocolo de máxima confidencialidad.
                        </p>

                        <div 
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0.6rem 1.2rem',
                                borderRadius: '12px',
                                background: 'rgba(52, 211, 153, 0.08)',
                                border: '1px solid rgba(52, 211, 153, 0.25)',
                                color: '#a7f3d0',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                marginBottom: '2.25rem'
                            }}
                        >
                            <span>🔒</span> Transmisión Cifrada AES-256 de Extremo a Extremo
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button 
                                onClick={handleReset} 
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '12px',
                                    background: isLSSD ? '#10b981' : '#f43f5e',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '0.92rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: `0 8px 20px ${primaryAccentGlow}`
                                }}
                            >
                                + Enviar Otra Denuncia
                            </button>
                            <button 
                                onClick={() => navigate('/')} 
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#e2e8f0',
                                    fontSize: '0.92rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Volver al Menú Principal
                            </button>
                        </div>
                    </div>
                ) : (
                    /* MAIN APPLE-STYLED COMPLAINT FORM */
                    <div 
                        style={{ 
                            maxWidth: '820px', 
                            width: '100%', 
                            background: 'rgba(15, 23, 42, 0.82)',
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                            border: `1px solid ${isLSSD ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255, 255, 255, 0.12)'}`,
                            borderRadius: '24px',
                            padding: '2.5rem',
                            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255,255,255,0.05)'
                        }}
                    >
                        {/* macOS Window Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: primaryAccent, boxShadow: `0 0 8px ${primaryAccent}` }} />
                                Canal de Recepción Seguro
                            </div>
                        </div>

                        {/* Form Title & Subtitle */}
                        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: primaryAccentBg,
                                border: `1px solid ${primaryAccentBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.75rem',
                                margin: '0 auto 1rem auto',
                                boxShadow: `0 8px 25px ${primaryAccentGlow}`
                            }}>
                                ⚖️
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' }}>
                                Formulario Oficial de Denuncias
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: '0 auto', maxWidth: '600px', lineHeight: '1.55' }}>
                                Complete los siguientes campos para formular una queja o denuncia disciplinaria contra cualquier funcionario u oficial del departamento.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            
                            {/* SECTION 1: DATOS DEL DENUNCIANTE */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.025)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: primaryAccent, background: primaryAccentBg, padding: '2px 8px', borderRadius: '6px', border: `1px solid ${primaryAccentBorder}` }}>01</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Información del Denunciante</h3>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Nombre Completo *
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: Johnathan Doe"
                                                value={nombreDenunciante}
                                                onChange={(e) => setNombreDenunciante(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '0.75rem 0.9rem',
                                                    background: 'rgba(0, 0, 0, 0.4)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    borderRadius: '10px',
                                                    color: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    outline: 'none',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = primaryAccent;
                                                    e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                    e.target.style.boxShadow = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Nº Teléfono de Contacto *
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
                                                padding: '0.75rem 0.9rem',
                                                background: 'rgba(0, 0, 0, 0.4)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '10px',
                                                color: '#ffffff',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = primaryAccent;
                                                e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: DATOS DEL OFICIAL DENUNCIADO */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.025)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: primaryAccent, background: primaryAccentBg, padding: '2px 8px', borderRadius: '6px', border: `1px solid ${primaryAccentBorder}` }}>02</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Oficial o Personal Involucrado</h3>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Nombre / Nº Placa del Denunciado *
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
                                                padding: '0.75rem 0.9rem',
                                                background: 'rgba(0, 0, 0, 0.4)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '10px',
                                                color: '#ffffff',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = primaryAccent;
                                                e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Fecha y Hora Aproximada de los Hechos *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={fechaHechos}
                                            onChange={(e) => setFechaHechos(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.75rem 0.9rem',
                                                background: 'rgba(0, 0, 0, 0.4)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '10px',
                                                color: '#ffffff',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                transition: 'all 0.2s ease',
                                                colorScheme: 'dark'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = primaryAccent;
                                                e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: MOTIVO PRINCIPAL (APPLE SELECTOR CHIPS) */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.025)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: primaryAccent, background: primaryAccentBg, padding: '2px 8px', borderRadius: '6px', border: `1px solid ${primaryAccentBorder}` }}>03</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Tipificación de la Infracción *</h3>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: motivoSelect === 'Otro' ? '1rem' : 0 }}>
                                    {MOTIVOS_PREDEFINIDOS.map((item) => {
                                        const isSelected = motivoSelect === item.id;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setMotivoSelect(item.id)}
                                                style={{
                                                    padding: '0.85rem 1rem',
                                                    borderRadius: '12px',
                                                    background: isSelected ? primaryAccentBg : 'rgba(0, 0, 0, 0.3)',
                                                    border: isSelected ? `1.5px solid ${primaryAccent}` : '1px solid rgba(255, 255, 255, 0.08)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: isSelected ? `0 4px 15px ${primaryAccentGlow}` : 'none'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.2rem' }}>
                                                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.74rem', color: isSelected ? primaryAccent : '#94a3b8' }}>
                                                    {item.desc}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {motivoSelect === 'Otro' && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Especifique el Motivo Concreto *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Allanamiento sin orden judicial, coacción, etc."
                                            value={motivoOtro}
                                            onChange={(e) => setMotivoOtro(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.75rem 0.9rem',
                                                background: 'rgba(0, 0, 0, 0.4)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '10px',
                                                color: '#ffffff',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = primaryAccent;
                                                e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* SECTION 4: DECLARACIÓN DETALLADA */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.025)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: primaryAccent, background: primaryAccentBg, padding: '2px 8px', borderRadius: '6px', border: `1px solid ${primaryAccentBorder}` }}>04</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Declaración y Relato de los Hechos *</h3>
                                </div>

                                <textarea
                                    required
                                    rows="6"
                                    placeholder="Describa de forma clara y cronológica todo lo ocurrido: ubicación exacta, contexto, diálogo, acciones realizadas por el oficial y personas presentes..."
                                    value={declaracion}
                                    onChange={(e) => setDeclaracion(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '0.9rem',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '12px',
                                        color: '#ffffff',
                                        fontSize: '0.92rem',
                                        lineHeight: '1.6',
                                        outline: 'none',
                                        resize: 'vertical',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'inherit'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = primaryAccent;
                                        e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            {/* SECTION 5: PRUEBAS Y MULTIMEDIA */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.025)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: primaryAccent, background: primaryAccentBg, padding: '2px 8px', borderRadius: '6px', border: `1px solid ${primaryAccentBorder}` }}>05</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Evidencias y Pruebas Gráficas (Opcional)</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {/* Video URL Link */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Enlace a Grabaciones / Video (YouTube, Streamable, Google Drive...)
                                        </label>
                                        <input
                                            type="url"
                                            placeholder="https://youtube.com/watch?v=... o enlace de descarga"
                                            value={enlacePrueba}
                                            onChange={(e) => setEnlacePrueba(e.target.value)}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '0.75rem 0.9rem',
                                                background: 'rgba(0, 0, 0, 0.4)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '10px',
                                                color: '#ffffff',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = primaryAccent;
                                                e.target.style.boxShadow = `0 0 0 3px ${primaryAccentGlow}`;
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>

                                    {/* Image Attachment Dropzone */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                                            Captura o Fotografía Adjunta
                                        </label>
                                        <label 
                                            htmlFor="ia-image-upload" 
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '1.5rem',
                                                borderRadius: '14px',
                                                border: '1.5px dashed rgba(255, 255, 255, 0.18)',
                                                background: 'rgba(0, 0, 0, 0.25)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = primaryAccent;
                                                e.currentTarget.style.background = primaryAccentBg;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.25)';
                                            }}
                                        >
                                            <input
                                                id="ia-image-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                style={{ display: 'none' }}
                                            />
                                            <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>📷</div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                                                {imagenBase64 ? 'Imagen seleccionada' : 'Haz clic para seleccionar o arrastra una imagen'}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                PNG, JPG, WEBP hasta 8MB
                                            </div>
                                        </label>

                                        {imagenBase64 && (
                                            <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <img
                                                    src={imagenBase64}
                                                    alt="Preview"
                                                    style={{ 
                                                        width: '50px',
                                                        height: '50px', 
                                                        borderRadius: '8px', 
                                                        objectFit: 'cover',
                                                        border: `1px solid ${primaryAccent}` 
                                                    }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>Captura lista para envío</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#34d399' }}>✓ Lista para adjuntar</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setImagenBase64('')}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        color: '#f87171',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: '6px',
                                                        padding: '4px 8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
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
                                    padding: '0.85rem 1rem', 
                                    borderRadius: '12px', 
                                    background: 'rgba(239, 68, 68, 0.15)', 
                                    border: '1px solid rgba(239, 68, 68, 0.35)', 
                                    color: '#fca5a5', 
                                    fontSize: '0.88rem', 
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>⚠️</span> {errorMsg}
                                </div>
                            )}

                            {/* SUBMIT ACTION BUTTON (APPLE STYLE) */}
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    borderRadius: '14px',
                                    background: isLSSD ? '#10b981' : '#f43f5e',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '1.02rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.01em',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.25s ease',
                                    boxShadow: `0 10px 30px ${primaryAccentGlow}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    if (!submitting) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = `0 14px 40px ${primaryAccentGlow}`;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!submitting) {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = `0 10px 30px ${primaryAccentGlow}`;
                                    }
                                }}
                            >
                                {submitting ? (
                                    <>
                                        <span style={{ display: 'inline-block', width: '18px', height: '18px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        <span>Procesando y Cifrando Envío...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🛡️</span>
                                        <span>Enviar Denuncia Oficial a Asuntos Internos</span>
                                    </>
                                )}
                            </button>

                            {/* Footer Confidentiality Notice */}
                            <div style={{ textAlign: 'center', fontSize: '0.76rem', color: '#64748b', lineHeight: '1.5' }}>
                                Al enviar esta denuncia, certifica bajo apercibimiento que los hechos relatados son verídicos.
                                Sus datos personales quedan amparados bajo el protocolo de protección al denunciante de Asuntos Internos.
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}

export default PublicIADenuncia;

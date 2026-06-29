import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function PublicIADenuncia() {
    const navigate = useNavigate();

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

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("La imagen es demasiado grande. El límite es 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
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
                throw new Error("Por favor, especifica el motivo.");
            }

            // Combine video link and uploaded image base64 into a unified pruebas text
            let finalPruebas = '';
            if (enlacePrueba && imagenBase64) {
                finalPruebas = `Enlace: ${enlacePrueba}\nImagen adjunta: ${imagenBase64}`;
            } else if (enlacePrueba) {
                finalPruebas = enlacePrueba;
            } else if (imagenBase64) {
                finalPruebas = imagenBase64;
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

    return (
        <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Background image / style standard to the app */}
            <div className="background-container">
                <img src="/indeximage.png" alt="Background" className="background-image" style={{ opacity: 0.15 }} />
            </div>

            {/* Header */}
            <header className="header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <img src="/ialogo.png" alt="IA Logo" className="header-logo" style={{ filter: 'drop-shadow(0 0 10px rgba(185, 28, 28, 0.4))' }} />
                <div className="header-title-container">
                    <h1 className="header-title" style={{ color: '#f8fafc', letterSpacing: '2px' }}>ASUNTOS INTERNOS</h1>
                    <div className="header-subtitle" style={{ color: '#ef4444', letterSpacing: '1px' }}>FORMULARIO DE DENUNCIA CONFIDENCIAL</div>
                </div>
                <img src="/dblogo.png" alt="Bureau Logo" className="header-logo" />
            </header>

            <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 1.5rem' }}>
                {submitted ? (
                    <div className="login-card" style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3rem', border: '1px solid #10b981', background: 'rgba(15, 23, 42, 0.85)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', color: '#10b981' }}>✓</div>
                        <h2 style={{ color: '#f8fafc', fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 'bold' }}>Denuncia Enviada con Éxito</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                            Su reporte ha sido recibido de forma segura por la división de Asuntos Internos. 
                            Toda la información proporcionada será tratada de manera estrictamente confidencial.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button onClick={handleReset} className="login-button" style={{ width: 'auto', padding: '0.8rem 1.5rem', backgroundColor: '#3b82f6' }}>
                                Enviar Otra Denuncia
                            </button>
                            <button onClick={() => navigate('/')} className="login-button btn-secondary" style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                                Volver al Inicio
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="login-card" style={{ maxWidth: '750px', width: '100%', padding: '2.5rem', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)' }}>
                        <div className="login-header" style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <h2 style={{ color: '#f8fafc', fontSize: '1.6rem', fontWeight: 'bold' }}>Formulario de Denuncias</h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Use este formulario para reportar abusos de autoridad, corrupción o conductas inapropiadas de cualquier oficial de policía.</p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Nombre del Denunciante</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        placeholder="Ej: John Doe"
                                        value={nombreDenunciante}
                                        onChange={(e) => setNombreDenunciante(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nº Teléfono Denunciante</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        placeholder="Ej: 555-0199"
                                        value={telefonoDenunciante}
                                        onChange={(e) => setTelefonoDenunciante(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Nombre / Nº Placa del Denunciado</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        placeholder="Ej: Sgt. Martinez (Placa 420)"
                                        value={denunciadoNombrePlaca}
                                        onChange={(e) => setDenunciadoNombrePlaca(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de los Hechos</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        required
                                        value={fechaHechos}
                                        onChange={(e) => setFechaHechos(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Motivo Principal</label>
                                <select
                                    className="form-input"
                                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc' }}
                                    value={motivoSelect}
                                    onChange={(e) => setMotivoSelect(e.target.value)}
                                >
                                    <option value="Abuso de autoridad">Abuso de autoridad</option>
                                    <option value="Uso excesivo de fuerza">Uso excesivo de fuerza</option>
                                    <option value="Corrupción / Soborno">Corrupción / Soborno</option>
                                    <option value="Falta de ética / Profesionalismo">Falta de ética / Profesionalismo</option>
                                    <option value="Otro">Otro (Especificar abajo)</option>
                                </select>
                            </div>

                            {motivoSelect === 'Otro' && (
                                <div className="form-group">
                                    <label className="form-label">Especifique el Motivo</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        placeholder="Ej: Allanamiento ilegal, extorsión, etc."
                                        value={motivoOtro}
                                        onChange={(e) => setMotivoOtro(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Declaración de los Hechos</label>
                                <textarea
                                    className="form-input"
                                    required
                                    rows="5"
                                    placeholder="Describa de manera detallada lo sucedido, incluyendo horas, lugares y cualquier testigo ocular..."
                                    style={{ resize: 'vertical' }}
                                    value={declaracion}
                                    onChange={(e) => setDeclaracion(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Enlace de Videos o Pruebas (Opcional)</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://youtube.com/watch?v=... o enlace de descarga"
                                    value={enlacePrueba}
                                    onChange={(e) => setEnlacePrueba(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Adjuntar Imágenes (Opcional)</label>
                                <label className="custom-file-upload" style={{
                                    display: 'block',
                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: 'rgba(30, 41, 59, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
                                    />
                                    {imagenBase64 ? '✓ Imagen adjunta correctamente (Haga clic para cambiar)' : 'Seleccione o arrastre una captura / foto'}
                                </label>
                                {imagenBase64 && (
                                    <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'center' }}>
                                        <img
                                            src={imagenBase64}
                                            alt="Preview"
                                            style={{ maxHeight: '150px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {errorMsg && <div style={{ color: '#ef4444', textAlign: 'center', fontWeight: 'bold' }}>{errorMsg}</div>}

                            <button
                                type="submit"
                                className="login-button"
                                style={{ backgroundColor: '#ef4444', color: '#f8fafc', marginTop: '1rem' }}
                                disabled={submitting}
                            >
                                {submitting ? 'Enviando Reporte...' : 'Enviar Denuncia Confidencial'}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}

export default PublicIADenuncia;

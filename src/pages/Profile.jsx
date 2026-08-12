import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, getProfileImage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

function Profile() {
    const { t } = useLanguage();
    const { isLSSD, userTheme, setUserTheme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState(null);
    const fileInputRef = useRef(null);
    const editorRef = useRef(null);

    // User Stats State
    const [userStats, setUserStats] = useState({ incidents: 0, matrix: 0, outings: 0 });
    const [statsLoading, setStatsLoading] = useState(true);

    // Cropper State
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        no_placa: '',
        rango: '',
        rol: '',
        profile_image: ''
    });

    const [passwords, setPasswords] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    // DB Usage State
    const [dbUsage, setDbUsage] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('No user found');

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                setFormData({
                    nombre: data.nombre || '',
                    apellido: data.apellido || '',
                    no_placa: data.no_placa || '',
                    rango: data.rango || '',
                    rol: data.rol || 'Externo',
                    profile_image: data.profile_image || ''
                });

                if (data.rol === 'Administrador' || data.rol === 'superadmin') {
                    fetchDbUsage();
                }

                fetchUserStats(user.id);
            }
        } catch (error) {
            console.error('Error fetching profile:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserStats = async (userId) => {
        if (!userId) return;
        try {
            setStatsLoading(true);
            const { data, error } = await supabase.rpc('get_user_stats', { p_target_user_id: userId });
            if (!error && data && data.length > 0) {
                setUserStats({
                    incidents: Number(data[0].incidents_count || 0),
                    matrix: Number(data[0].matrix_count || 0),
                    outings: Number(data[0].outings_count || 0)
                });
            } else {
                const [incRes, matrixRes, outRes] = await Promise.all([
                    supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('author_id', userId),
                    supabase.from('gang_patrol_logs').select('id', { count: 'exact', head: true }).eq('created_by', userId),
                    supabase.from('outings').select('id', { count: 'exact', head: true }).eq('created_by', userId)
                ]);
                setUserStats({
                    incidents: incRes ? (incRes.count || 0) : 0,
                    matrix: matrixRes ? (matrixRes.count || 0) : 0,
                    outings: outRes ? (outRes.count || 0) : 0
                });
            }
        } catch (err) {
            console.error("Error fetching user stats:", err);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchDbUsage = async () => {
        try {
            const { data, error } = await supabase.rpc('get_db_usage');
            if (error) throw error;
            setDbUsage(data);
        } catch (err) {
            console.error("Failed to fetch DB usage:", err);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const handleImageClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 10000000) {
                alert("El archivo es grande, se procesará comprimido.");
            }
            setImageSrc(file);
            setEditorOpen(true);
            event.target.value = '';
        }
    };

    const handleSaveImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            setFormData({ ...formData, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    const handleCancelImage = () => {
        setEditorOpen(false);
        setImageSrc(null);
        setScale(1.2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            let imageUrl = formData.profile_image;
            if (imageUrl && imageUrl.startsWith('data:')) {
                imageUrl = await uploadImageToStorage(imageUrl, 'avatars');
                setFormData(prev => ({ ...prev, profile_image: imageUrl }));
            }

            const { error: profileError } = await supabase
                .from('users')
                .update({
                    nombre: formData.nombre,
                    apellido: formData.apellido,
                    no_placa: formData.no_placa,
                    rango: formData.rango,
                    profile_image: imageUrl,
                    updated_at: new Date()
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            if (passwords.newPassword) {
                if (passwords.newPassword !== passwords.confirmPassword) {
                    throw new Error("Las contraseñas no coinciden");
                }
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: passwords.newPassword
                });
                if (passwordError) throw passwordError;
            }

            setMessage({ type: 'success', text: '¡Perfil y ajustes guardados correctamente!' });
            setPasswords({ newPassword: '', confirmPassword: '' });

        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return (
        <div className="mac-profile-container">
            <div className="mac-doc-empty">Cargando perfil de usuario...</div>
        </div>
    );

    const canEditRank = ['Coordinador', 'Comisionado', 'Administrador', 'superadmin'].includes(formData.rol);
    const isAdmin = formData.rol === 'Administrador' || formData.rol === 'superadmin';

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const MAX_STORAGE_BYTES = 500 * 1024 * 1024;
    const usedBytes = dbUsage ? dbUsage.used_bytes : 0;
    const usagePercent = Math.min(100, Math.max(0, (usedBytes / MAX_STORAGE_BYTES) * 100));

    return (
        <div className="mac-profile-container">
            {/* macOS Command Banner Header */}
            <div className="mac-command-banner">
                <div className="mac-header-info">
                    <div className="mac-greeting-row">
                        <div className="mac-status-dot"></div>
                        <h1 className="mac-title-text">Ajustes de Perfil y Cuenta</h1>
                    </div>
                    <div className="mac-subtitle-text">
                        Administra tu información personal, credenciales de acceso y preferencias del sistema.
                    </div>
                </div>

                    <button className="mac-btn mac-btn-secondary" onClick={() => setUserTheme(userTheme === 'claro' ? 'gris' : 'claro')} title="Modo Claro / Oscuro">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                        </svg>
                        Tema: {userTheme ? userTheme.charAt(0).toUpperCase() + userTheme.slice(1) : 'Gris'}
                    </button>
            </div>

            {/* Notification Alert Message */}
            {message && (
                <div style={{
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${message.type === 'success' ? '#34d399' : '#ef4444'}`,
                    borderRadius: '16px',
                    color: message.type === 'success' ? '#34d399' : '#ef4444',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    {message.type === 'success' ? '✓' : '✕'} {message.text}
                </div>
            )}

            {/* Main Profile Grid Layout */}
            <div className="mac-profile-grid">
                {/* Left Column: Avatar & Identity Card */}
                <div className="mac-profile-card">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />

                    <div className="mac-avatar-wrapper" onClick={handleImageClick} title="Hacer clic para cambiar imagen de perfil">
                        {(formData.profile_image && formData.profile_image.startsWith('data:')) || getProfileImage(formData.profile_image) ? (
                            <img src={formData.profile_image} alt="Profile" className="mac-avatar-img" />
                        ) : (
                            <img src="/logowebp/anon.webp" alt="Default Profile" className="mac-avatar-img" />
                        )}
                        <div className="mac-avatar-overlay">
                            📷 Cambiar
                        </div>
                    </div>

                    <h2 className="mac-profile-name">
                        {formData.nombre} {formData.apellido}
                    </h2>
                    <span className="mac-profile-role-badge">
                        🛡️ {formData.rango || 'Agente'}
                    </span>

                    <div className="mac-badge-box">
                        <span className="mac-badge-number">#{formData.no_placa || '---'}</span>
                        <span className="mac-badge-label">NÚMERO DE PLACA OFICIAL</span>
                    </div>
                </div>

                {/* Right Column: Settings Form Panel */}
                <div className="mac-profile-panel">
                    <form onSubmit={handleSubmit}>
                        {/* Section 1: Personal Information */}
                        <div className="mac-profile-section-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Información Personal
                        </div>

                        <div className="mac-form-grid-2">
                            <div className="mac-form-group">
                                <label className="mac-form-label">Nombre</label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                    placeholder="Tu nombre..."
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">Apellido</label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    name="apellido"
                                    value={formData.apellido}
                                    onChange={handleChange}
                                    placeholder="Tu apellido..."
                                />
                            </div>
                        </div>

                        <div className="mac-form-grid-2">
                            <div className="mac-form-group">
                                <label className="mac-form-label">Número de Placa</label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    name="no_placa"
                                    value={formData.no_placa}
                                    onChange={handleChange}
                                    placeholder="Ej: 720"
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    Rango Oficial {canEditRank ? '' : '(Bloqueado)'}
                                </label>
                                {canEditRank ? (
                                    <select
                                        className="mac-form-input"
                                        name="rango"
                                        value={formData.rango}
                                        onChange={handleChange}
                                    >
                                        <option value="">Seleccionar Rango</option>
                                        <option value="Deputy Sheriff">Deputy Sheriff</option>
                                        <option value="Oficial I">Oficial I</option>
                                        <option value="Deputy Sheriff Bonus I">Deputy Sheriff Bonus I</option>
                                        <option value="Oficial II">Oficial II</option>
                                        <option value="Deputy Sheriff Bonus II">Deputy Sheriff Bonus II</option>
                                        <option value="Oficial III">Oficial III</option>
                                        <option value="Detective I">Detective I</option>
                                        <option value="Detective II">Detective II</option>
                                        <option value="Detective III">Detective III</option>
                                        <option value="Internal Affairs Agent">Internal Affairs Agent</option>
                                        <option value="Department of Justice Agent">Department of Justice Agent</option>
                                        <option value="Teniente">Teniente</option>
                                        <option value="Capitan">Capitan</option>
                                        <option value="Comandante">Comandante</option>
                                        <option value="Division Chief">Division Chief</option>
                                        <option value="Assistant Sheriff">Assistant Sheriff</option>
                                        <option value="Undersheriff">Undersheriff</option>
                                        <option value="Sheriff">Sheriff</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        value={formData.rango}
                                        disabled
                                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Section 2: Personal Theme Selector */}
                        <div className="mac-profile-section-title" style={{ marginTop: '1.75rem' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 2a10 10 0 0 0 0 20z" />
                            </svg>
                            Tema General de la Página (Personal)
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            {[
                                { id: 'gris', label: 'Gris', badge: '🔘 Slate' },
                                { id: 'verde', label: 'Verde', badge: '🟢 Esmeralda' },
                                { id: 'negro', label: 'Negro', badge: '⬛ OLED' },
                                { id: 'azul', label: 'Azul', badge: '🔵 Zafiro' },
                                { id: 'claro', label: 'Claro', badge: '⚪ Light' }
                            ].map(tItem => (
                                <button
                                    key={tItem.id}
                                    type="button"
                                    className={`mac-btn ${userTheme === tItem.id ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.65rem 0.5rem',
                                        borderRadius: '16px',
                                        border: userTheme === tItem.id ? '2px solid currentColor' : '1px solid rgba(255,255,255,0.12)'
                                    }}
                                    onClick={() => setUserTheme(tItem.id)}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>{tItem.badge.split(' ')[0]}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', marginTop: '0.2rem' }}>{tItem.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Section 3: Security & Password */}
                        <div className="mac-profile-section-title" style={{ marginTop: '1.75rem' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Seguridad y Contraseña
                        </div>

                        <div className="mac-form-grid-2">
                            <div className="mac-form-group">
                                <label className="mac-form-label">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    className="mac-form-input"
                                    name="newPassword"
                                    value={passwords.newPassword}
                                    onChange={handlePasswordChange}
                                    placeholder="Dejar en blanco para mantener la actual"
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    className="mac-form-input"
                                    name="confirmPassword"
                                    value={passwords.confirmPassword}
                                    onChange={handlePasswordChange}
                                    placeholder="Repetir nueva contraseña"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="mac-modal-actions" style={{ marginTop: '1.5rem' }}>
                            <button
                                type="submit"
                                className="mac-btn mac-btn-primary"
                                disabled={updating}
                            >
                                {updating ? 'Guardando...' : 'Guardar Ajustes'}
                            </button>
                        </div>

                        {/* Database Storage Statistic (Admin Only) */}
                        {isAdmin && dbUsage && (
                            <div style={{ marginTop: '2.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', color: '#cbd5e1', fontWeight: '600' }}>
                                    <span>Almacenamiento BD (Admin)</span>
                                    <span>{formatBytes(usedBytes)} / 500 MB ({usagePercent.toFixed(1)}%)</span>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                    borderRadius: '9999px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}>
                                    <div style={{
                                        width: `${usagePercent}%`,
                                        height: '100%',
                                        backgroundColor: usagePercent > 80 ? '#ef4444' : (usagePercent > 50 ? '#f59e0b' : '#34d399'),
                                        borderRadius: '9999px',
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* User Activity STATS KPI Row */}
            <div style={{ marginTop: '2.5rem' }}>
                <div className="mac-doc-section-header" style={{ marginTop: 0 }}>
                    <h2 className="mac-doc-section-title">
                        📊 {t('statsTitle') || 'Estadísticas de Actividad (STATS)'}
                    </h2>
                </div>

                {statsLoading ? (
                    <div className="mac-doc-empty">Cargando estadísticas...</div>
                ) : (
                    <div className="mac-widgets-grid">
                        <div className="mac-widget-card">
                            <div className="mac-widget-header">
                                <span className="mac-widget-label">Informes Subidos</span>
                                <div className="mac-widget-icon-pill">📄</div>
                            </div>
                            <div className="mac-widget-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span className="mac-widget-val" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{userStats.incidents}</span>
                                <span className="mac-widget-sub" style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.25rem' }}>Apartado Incidents</span>
                            </div>
                        </div>

                        <div className="mac-widget-card">
                            <div className="mac-widget-header">
                                <span className="mac-widget-label">Matrices Enviadas</span>
                                <div className="mac-widget-icon-pill">📈</div>
                            </div>
                            <div className="mac-widget-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span className="mac-widget-val" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{userStats.matrix}</span>
                                <span className="mac-widget-sub" style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.25rem' }}>Gang Unit</span>
                            </div>
                        </div>

                        <div className="mac-widget-card">
                            <div className="mac-widget-header">
                                <span className="mac-widget-label">Vigilancias Enviadas</span>
                                <div className="mac-widget-icon-pill">🕵️‍♂️</div>
                            </div>
                            <div className="mac-widget-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span className="mac-widget-val" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{userStats.outings}</span>
                                <span className="mac-widget-sub" style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.25rem' }}>Outings Log</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Cropper Modal */}
            {editorOpen && createPortal(
                <div className="mac-modal-backdrop">
                    <div className="mac-modal-container">
                        <h3 className="mac-modal-title">Ajustar Recorte de Imagen de Perfil</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor
                                ref={editorRef}
                                image={imageSrc}
                                width={240}
                                height={240}
                                border={20}
                                borderRadius={120}
                                color={[0, 0, 0, 0.6]}
                                scale={scale}
                                rotate={0}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>-</span>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={scale}
                                style={{ flex: 1 }}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>+</span>
                        </div>

                        <div className="mac-modal-actions">
                            <button type="button" className="mac-btn mac-btn-secondary" onClick={handleCancelImage}>
                                Cancelar
                            </button>
                            <button type="button" className="mac-btn mac-btn-primary" onClick={handleSaveImage}>
                                Guardar Imagen
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default Profile;

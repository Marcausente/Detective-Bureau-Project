import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme, BRANDING_PRESETS } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { uploadImageToStorage } from '../utils/imageStorage';
import '../index.css';

function Admin() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const { theme, changeTheme, isLSSD, branding, updateBranding, applyBrandingPreset } = useTheme();
    const { language, changeLanguage, t } = useLanguage();
    const [updatingTheme, setUpdatingTheme] = useState(false);
    const [updatingLanguage, setUpdatingLanguage] = useState(false);

    // Branding Form State
    const [brandingForm, setBrandingForm] = useState(branding || {});
    const [savingBranding, setSavingBranding] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [uploadingFields, setUploadingFields] = useState({});

    useEffect(() => {
        const checkAccessAndLoad = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/');
                return;
            }

            const { data: profile, error } = await supabase
                .from('users')
                .select('rol')
                .eq('id', user.id)
                .single();

            if (error || !profile || (profile.rol !== 'Administrador' && profile.rol !== 'superadmin')) {
                navigate('/dashboard');
            } else {
                setLoading(false);
            }
        };

        checkAccessAndLoad();
    }, [navigate]);

    // Sync form when global branding changes
    useEffect(() => {
        if (branding) {
            setBrandingForm(branding);
        }
    }, [branding]);

    if (loading) return <div className="loading-container">{t('verifyingAccess')}</div>;

    const handleThemeToggle = async () => {
        setUpdatingTheme(true);
        try {
            await changeTheme(isLSSD ? 'LSPD' : 'LSSD');
        } catch (error) {
            alert("Error updating theme: " + error.message);
        } finally {
            setUpdatingTheme(false);
        }
    };

    const handleLanguageToggle = async () => {
        setUpdatingLanguage(true);
        try {
            await changeLanguage(language === 'en' ? 'es' : 'en');
        } catch (error) {
            alert("Error updating language: " + error.message);
        } finally {
            setUpdatingLanguage(false);
        }
    };

    // Handle Image Upload for a specific branding field
    const handleFileUpload = async (field, file) => {
        if (!file) return;
        try {
            setUploadingFields(prev => ({ ...prev, [field]: true }));
            const url = await uploadImageToStorage(file, 'branding');
            setBrandingForm(prev => ({ ...prev, [field]: url }));
        } catch (err) {
            alert('Error al subir imagen: ' + err.message);
        } finally {
            setUploadingFields(prev => ({ ...prev, [field]: false }));
        }
    };

    // Apply Preset
    const handleSelectPreset = async (presetKey) => {
        const preset = BRANDING_PRESETS[presetKey];
        if (!preset) return;
        setBrandingForm({ ...brandingForm, ...preset });
    };

    // Save Branding Changes
    const handleSaveBranding = async (e) => {
        if (e) e.preventDefault();
        setSavingBranding(true);
        setSaveSuccess(false);

        try {
            const res = await updateBranding(brandingForm);
            if (res.success) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 4500);
            } else {
                alert('Error al guardar branding: ' + (res.error || 'Desconocido'));
            }
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setSavingBranding(false);
        }
    };

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
            {/* Header */}
            <div className="doc-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h2 className="page-title">{t('adminPanel')}</h2>
                    <h4 style={{ color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {t('adminControls')} • Personalización Global
                    </h4>
                </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* 1. SECCIÓN: AJUSTES GLOBALES BÁSICOS (TEMA & IDIOMA) */}
                <section className="announcements-section" style={{ width: '100%' }}>
                    <h3 className="section-title">⚙️ {t('globalSettings')}</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{t('departmentTheme')}</h4>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {t('themeDesc')}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontWeight: 'bold', color: !isLSSD ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>LSPD</span>
                                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={isLSSD} 
                                        onChange={handleThemeToggle} 
                                        disabled={updatingTheme}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span className="slider round" style={{ 
                                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                        backgroundColor: isLSSD ? '#065f46' : '#1e293b', 
                                        transition: '.4s', borderRadius: '34px',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <span style={{
                                            position: 'absolute', content: '""', height: '26px', width: '26px', left: '4px', bottom: '3px',
                                            backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                            transform: isLSSD ? 'translateX(26px)' : 'translateX(0)'
                                        }}></span>
                                    </span>
                                </label>
                                <span style={{ fontWeight: 'bold', color: isLSSD ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>LSSD</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{t('languageTheme')}</h4>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {t('languageDesc')}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontWeight: 'bold', color: language === 'en' ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>EN</span>
                                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={language === 'es'} 
                                        onChange={handleLanguageToggle} 
                                        disabled={updatingLanguage}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span className="slider round" style={{ 
                                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                        backgroundColor: language === 'es' ? '#065f46' : '#1e293b', 
                                        transition: '.4s', borderRadius: '34px',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <span style={{
                                            position: 'absolute', content: '""', height: '26px', width: '26px', left: '4px', bottom: '3px',
                                            backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                            transform: language === 'es' ? 'translateX(26px)' : 'translateX(0)'
                                        }}></span>
                                    </span>
                                </label>
                                <span style={{ fontWeight: 'bold', color: language === 'es' ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>ES</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. SECCIÓN: PERSONALIZACIÓN Y BRANDING DE LA WEB (WHITE-LABEL) */}
                <section className="announcements-section" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 className="section-title" style={{ margin: '0 0 0.3rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🎨</span>
                                <span>Personalización y Branding de la Web (White-Label)</span>
                            </h3>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                Cambia todos los títulos, nombres de departamentos, unidades y logos de la web en tiempo real.
                            </p>
                        </div>

                        {/* Quick Presets Buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>Plantillas Rápidas:</span>
                            <button
                                type="button"
                                onClick={() => handleSelectPreset('SCUB')}
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                🌟 SCUB
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectPreset('DB')}
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                🕵️ DB
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectPreset('LSSD')}
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                🛡️ LSSD General
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectPreset('SAPD')}
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                🚓 SAPD General
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSaveBranding} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                        {/* Tarjetas de Configuración */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                            
                            {/* BLOQUE 1: BARRA SUPERIOR & NAVEGADOR */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🔝</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Barra Superior y Pestaña del Navegador
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre en Barra Superior (Arriba a la izquierda)
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.topbar_name || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, topbar_name: e.target.value })}
                                            placeholder="Ej: SCUB, DB, LSSD, SAPD..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo de la Barra Superior
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.topbar_logo && (
                                                <img src={brandingForm.topbar_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.topbar_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, topbar_logo: e.target.value })}
                                                placeholder="/logowebp/SCUB.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['topbar_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['topbar_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['topbar_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('topbar_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título de la Pestaña del Navegador
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.app_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, app_title: e.target.value })}
                                            placeholder="Ej: Sheriff Criminal Unit Bureau"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 2: PANEL DE INICIO / DASHBOARD */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏠</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Panel de Inicio (Dashboard)
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal del Banner de Inicio
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.dashboard_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, dashboard_title: e.target.value })}
                                            placeholder="Ej: SHERIFF CRIMINAL UNIT, DETECTIVE BUREAU..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo / Nombre del Cuerpo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.dashboard_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, dashboard_subtitle: e.target.value })}
                                            placeholder="Ej: Sheriff Criminal Unit Bureau"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 3: CASOS / CRIMINAL CASES */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Casos (Expedientes)
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título de la División de Casos
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.cases_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, cases_title: e.target.value })}
                                            placeholder="Ej: GENERAL CRIMES DIVISION, MAJOR CRIMES DIVISION..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo de la División
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.cases_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, cases_subtitle: e.target.value })}
                                            placeholder="Ej: Sheriff Criminal Unit Bureau"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo de la División de Casos
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.cases_logo && (
                                                <img src={brandingForm.cases_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.cases_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, cases_logo: e.target.value })}
                                                placeholder="/logowebp/Generalcrimes.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['cases_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['cases_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['cases_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('cases_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 4: REGISTRO DE DENUNCIAS */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📜</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Denuncias
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título del Registro de Denuncias
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.complaints_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, complaints_title: e.target.value })}
                                            placeholder="Ej: Registro de Denuncias"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo del Registro de Denuncias
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.complaints_logo && (
                                                <img src={brandingForm.complaints_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.complaints_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, complaints_logo: e.target.value })}
                                                placeholder="/logowebp/Generalcrimes.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['complaints_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['complaints_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['complaints_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('complaints_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 5: PANTALLA DE LOGIN / ACCESO */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🔐</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Pantalla de Login / Acceso
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título del Departamento (Línea Superior)
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.login_dept || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, login_dept: e.target.value })}
                                            placeholder="Ej: Los Santos Sheriff's Department"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título de la Unidad / Bureau (Línea Inferior)
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.login_bureau || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, login_bureau: e.target.value })}
                                            placeholder="Ej: Sheriff Criminal Unit Bureau"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo Central de Login
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.login_logo && (
                                                <img src={brandingForm.login_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.login_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, login_logo: e.target.value })}
                                                placeholder="/logowebp/SCUB.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['login_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['login_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['login_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('login_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Fondo de Pantalla de Login (Wallpaper)
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.login_bg && (
                                                <img src={brandingForm.login_bg} alt="Preview" style={{ width: '48px', height: '32px', objectFit: 'cover', background: 'rgba(0,0,0,0.5)', borderRadius: '6px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.login_bg || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, login_bg: e.target.value })}
                                                placeholder="/logowebp/fondolssd.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['login_bg'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['login_bg'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['login_bg']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('login_bg', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 6: BANDAS / GANGS */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>👥</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Bandas / Gangs
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre en Pestaña / Barra de Navegación
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.gangs_nav_label || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, gangs_nav_label: e.target.value })}
                                            placeholder="Ej: Bandas, Gang Unit, Grupos Criminales..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Superior dentro del Apartado
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.gangs_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, gangs_title: e.target.value })}
                                            placeholder="Ej: Gangs & Narcotics Division, Gang Intelligence Unit..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 7: SEB / SWAT (ALTO RIESGO) */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de SEB / SWAT (Alto Riesgo)
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre de la Pestaña en Barra de Navegación
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.seb_nav_label || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, seb_nav_label: e.target.value })}
                                            placeholder="Ej: SEB, SWAT, GEO, Táctico..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Texto Superior del Badge / Rótulo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.seb_badge || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, seb_badge: e.target.value })}
                                            placeholder="Ej: Special Enforcement Bureau, SWAT Tactical..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal del Tablón
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.seb_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, seb_title: e.target.value })}
                                            placeholder="Ej: División Operativa de Alto Riesgo"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo Descriptivo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.seb_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, seb_subtitle: e.target.value })}
                                            placeholder="Ej: Tablón de operaciones y planificación táctica interactiva."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Escudo Personalizado (Opcional)
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.seb_logo && (
                                                <img src={brandingForm.seb_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.seb_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, seb_logo: e.target.value })}
                                                placeholder="URL del logo o subir archivo"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['seb_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['seb_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['seb_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('seb_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 8: FORMACIÓN / DTP / ACADEMIA */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🎓</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Formación / DTP / Academia
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre en Pestaña / Barra de Navegación
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.training_nav_label || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, training_nav_label: e.target.value })}
                                            placeholder="Ej: Formación, Academia, DTP, FTO..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal dentro del Módulo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.training_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, training_title: e.target.value })}
                                            placeholder="Ej: Detective Training Program, Academia de Instrucción..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo Descriptivo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.training_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, training_subtitle: e.target.value })}
                                            placeholder="Ej: Departamento de Instrucción y Capacitación Continua"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Escudo de Formación
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.training_logo && (
                                                <img src={brandingForm.training_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.training_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, training_logo: e.target.value })}
                                                placeholder="/logowebp/DTP logo.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['training_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['training_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['training_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('training_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 9: ASUNTOS INTERNOS (IA) */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⚖️</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Asuntos Internos (IA)
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre en Pestaña / Barra de Navegación
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_nav_label || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_nav_label: e.target.value })}
                                            placeholder="Ej: Asuntos Internos, Internal Affairs, IA..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Texto Superior / Badge
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_badge || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_badge: e.target.value })}
                                            placeholder="Ej: Sheriff Internal Affairs Division, Internal Affairs Bureau..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal dentro de IA
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_title: e.target.value })}
                                            placeholder="Ej: ASUNTOS INTERNOS, INTERNAL AFFAIRS..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Escudo de Asuntos Internos
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.ia_logo && (
                                                <img src={brandingForm.ia_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.ia_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, ia_logo: e.target.value })}
                                                placeholder="/logowebp/IALSSD.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['ia_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['ia_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['ia_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('ia_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 10: AIR SUPPORT DIVISION (ASD) */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🚁</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Air Support (ASD)
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre en Pestaña / Barra de Navegación
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.asd_nav_label || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, asd_nav_label: e.target.value })}
                                            placeholder="Ej: Air Support, ASD, División Aérea..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal dentro de ASD
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.asd_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, asd_title: e.target.value })}
                                            placeholder="Ej: AIR SUPPORT DIVISION, SHERIFF AERO BUREAU..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Badge / Tag Superior
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.asd_badge || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, asd_badge: e.target.value })}
                                            placeholder="Ej: ASD • S.C.U.B. / SAPD"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo Descriptivo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.asd_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, asd_subtitle: e.target.value })}
                                            placeholder="Ej: Cuadrilla y Gestión Jerárquica de Vuelo..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Escudo de ASD (Opcional)
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.asd_logo && (
                                                <img src={brandingForm.asd_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.asd_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, asd_logo: e.target.value })}
                                                placeholder="URL del logo o subir archivo"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['asd_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['asd_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['asd_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('asd_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 11: UNDERCOVER (UD / INFILTRACIONES) */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🕶️</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Apartado de Undercover (UD / Infiltraciones)
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre en Pestaña / Barra de Navegación
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.undercover_nav_label || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, undercover_nav_label: e.target.value })}
                                            placeholder="Ej: Undercover, Infiltraciones, UD..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal dentro del Apartado
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.undercover_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, undercover_title: e.target.value })}
                                            placeholder="Ej: SCUB Undercover Division, Undercover Unit..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo Descriptivo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.undercover_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, undercover_subtitle: e.target.value })}
                                            placeholder="Ej: Gestión de identidades encubiertas, leyendas de infiltración..."
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Insignia de Undercover (Opcional)
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.undercover_logo && (
                                                <img src={brandingForm.undercover_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.undercover_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, undercover_logo: e.target.value })}
                                                placeholder="URL del logo o subir archivo"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['undercover_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['undercover_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['undercover_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('undercover_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* BLOQUE 12: FORMULARIO PÚBLICO DE DENUNCIAS IA */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📋</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Formulario Público de Denuncias IA
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Nombre del Departamento / Cabecera
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_form_dept || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_form_dept: e.target.value })}
                                            placeholder="Ej: Los Santos County Sheriff's Department"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Subtítulo en Barra Superior
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_form_subtitle || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_form_subtitle: e.target.value })}
                                            placeholder="Ej: Asuntos Internos • División Disciplinaria"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título Principal del Formulario
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_form_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_form_title: e.target.value })}
                                            placeholder="Ej: Registro de Denuncia Ciudadana"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Badge / Tag Superior del Formulario
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.ia_form_badge || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_form_badge: e.target.value })}
                                            placeholder="Ej: Formulario de Denuncia Disciplinaria"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Descripción del Formulario
                                        </label>
                                        <textarea
                                            value={brandingForm.ia_form_desc || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, ia_form_desc: e.target.value })}
                                            placeholder="Ej: Rellene los campos con los datos precisos sobre los hechos ocurridos..."
                                            className="mac-form-input"
                                            rows={2}
                                            style={{ width: '100%', padding: '0.6rem 0.8rem', resize: 'vertical' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo de la Cabecera del Formulario
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.ia_form_logo && (
                                                <img src={brandingForm.ia_form_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.ia_form_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, ia_form_logo: e.target.value })}
                                                placeholder="/logowebp/IALSSD.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['ia_form_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['ia_form_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['ia_form_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('ia_form_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 13: MAPA TÁCTICO & INTELIGENCIA */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🗺️</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Mapa Táctico & Satélite Intel
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Rótulo del Satélite HUD (Barra Superior)
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.map_badge || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, map_badge: e.target.value })}
                                            placeholder="Ej: SATÉLITE INTEL SAN ANDREAS"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título del Panel Lateral de Zonas
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.map_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, map_title: e.target.value })}
                                            placeholder="Ej: Zonas & Jurisdicciones"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Insignia en HUD del Mapa
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.map_logo && (
                                                <img src={brandingForm.map_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.map_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, map_logo: e.target.value })}
                                                placeholder="/logowebp/SCUB.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['map_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['map_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['map_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('map_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOQUE 14: MAPA PÚBLICO DE ZONAS DE RIESGO */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1rem', fontWeight: 700 }}>
                                        Mapa Público de Zonas de Riesgo
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Título de la Alerta Pública
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.public_map_title || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, public_map_title: e.target.value })}
                                            placeholder="Ej: MAPA DE ADVERTENCIA DE RIESGO"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Departamento Emisor / Subtítulo
                                        </label>
                                        <input
                                            type="text"
                                            value={brandingForm.public_map_dept || ''}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, public_map_dept: e.target.value })}
                                            placeholder="Ej: Los Santos County Sheriff's Department"
                                            className="mac-form-input"
                                            style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem' }}>
                                            Logo / Escudo de Seguridad Pública
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {brandingForm.public_map_logo && (
                                                <img src={brandingForm.public_map_logo} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'contain', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }} />
                                            )}
                                            <input
                                                type="text"
                                                value={brandingForm.public_map_logo || ''}
                                                onChange={(e) => setBrandingForm({ ...brandingForm, public_map_logo: e.target.value })}
                                                placeholder="/logowebp/IALSSD.webp o URL"
                                                className="mac-form-input"
                                                style={{ flex: 1, padding: '0.6rem 0.8rem' }}
                                            />
                                            <label className="mac-btn mac-btn-secondary" style={{ padding: '0.6rem 0.8rem', cursor: uploadingFields['public_map_logo'] ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                                {uploadingFields['public_map_logo'] ? '...' : 'Subir'}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingFields['public_map_logo']}
                                                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload('public_map_logo', e.target.files[0]); }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions & Save Button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.25rem' }}>
                            {saveSuccess && (
                                <span style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    <span>¡Configuración de Branding guardada correctamente!</span>
                                </span>
                            )}
                            <button
                                type="submit"
                                className="mac-btn mac-btn-primary"
                                disabled={savingBranding}
                                style={{
                                    padding: '0.75rem 2rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 800,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    borderColor: '#059669',
                                    cursor: savingBranding ? 'wait' : 'pointer',
                                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
                                }}
                            >
                                {savingBranding ? 'Guardando Cambios...' : '💾 Guardar Configuración de Branding'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}

export default Admin;

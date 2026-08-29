import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import { useLanguage } from '../contexts/LanguageContext'; // Import useLanguage
import { DEFAULT_SANCTION_DURATIONS, fetchSanctionDurations } from '../utils/sanctionConfig';
import '../index.css';

function Admin() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const { theme, changeTheme, isLSSD } = useTheme();
    const { language, changeLanguage, t } = useLanguage();
    const [updatingTheme, setUpdatingTheme] = useState(false);
    const [updatingLanguage, setUpdatingLanguage] = useState(false);

    // Sanction Durations State
    const [sanctionDays, setSanctionDays] = useState({
        Leve: DEFAULT_SANCTION_DURATIONS.Leve,
        Media: DEFAULT_SANCTION_DURATIONS.Media,
        Grave: DEFAULT_SANCTION_DURATIONS.Grave
    });
    const [savingDurations, setSavingDurations] = useState(false);
    const [durationSavedNotice, setDurationSavedNotice] = useState(false);

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
                const loadedDurations = await fetchSanctionDurations();
                setSanctionDays(loadedDurations);
            }
        };

        checkAccessAndLoad();
    }, [navigate]);

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

    const handleSaveSanctionDurations = async (e) => {
        e.preventDefault();
        setSavingDurations(true);
        setDurationSavedNotice(false);

        const leveVal = parseInt(sanctionDays.Leve, 10) || 7;
        const mediaVal = parseInt(sanctionDays.Media, 10) || 14;
        const graveVal = parseInt(sanctionDays.Grave, 10) || 20;

        try {
            // Try via RPC first
            const { error: rpcError } = await supabase.rpc('update_sanction_durations', {
                p_leve: leveVal,
                p_media: mediaVal,
                p_grave: graveVal
            });

            if (rpcError) {
                // Fallback to direct app_settings upsert
                const updates = [
                    { key: 'sanction_days_leve', value: String(leveVal) },
                    { key: 'sanction_days_media', value: String(mediaVal) },
                    { key: 'sanction_days_grave', value: String(graveVal) }
                ];
                const { error: upsertError } = await supabase.from('app_settings').upsert(updates);
                if (upsertError) throw upsertError;
            }

            setSanctionDays({ Leve: leveVal, Media: mediaVal, Grave: graveVal });
            setDurationSavedNotice(true);
            setTimeout(() => setDurationSavedNotice(false), 4000);
        } catch (err) {
            alert((language === 'es' ? 'Error al guardar duraciones de sanciones: ' : 'Error saving sanction durations: ') + err.message);
        } finally {
            setSavingDurations(false);
        }
    };

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="doc-header">
                <div>
                    <h2 className="page-title">{t('adminPanel')}</h2>
                    <h4 style={{ color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {t('adminControls')}
                    </h4>
                </div>
            </div>
            
            <div className="dashboard-grid">
                <section className="announcements-section" style={{ width: '100%', gridColumn: '1 / -1' }}>
                    <h3 className="section-title">{t('globalSettings')}</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
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

                {/* IA Sanction Durations Section */}
                <section className="announcements-section" style={{ width: '100%', gridColumn: '1 / -1', marginTop: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 className="section-title" style={{ margin: 0 }}>
                                {language === 'es' ? 'Vigencia de Sanciones (Asuntos Internos)' : 'Internal Affairs Sanction Durations'}
                            </h3>
                            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                {language === 'es' 
                                    ? 'Establece los días de caducidad para las faltas disciplinarias. Empiezan a contar desde la fecha en que se aplica la sanción.' 
                                    : 'Configure the active expiration days for disciplinary offenses. Counts start from the sanction date.'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveSanctionDurations} style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            
                            {/* Falta Leve */}
                            <div style={{
                                background: 'rgba(56, 189, 248, 0.08)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }}></span>
                                    <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '0.95rem', fontWeight: 700 }}>
                                        {language === 'es' ? 'Falta Leve' : 'Minor Offense'}
                                    </h4>
                                </div>
                                <p style={{ margin: '0 0 0.85rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                                    {language === 'es' ? 'Amonestaciones / Infracciones leves' : 'Minor infractions'} (Default: 7 {language === 'es' ? 'días' : 'days'})
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        required
                                        className="mac-form-input"
                                        style={{ width: '90px', padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700 }}
                                        value={sanctionDays.Leve}
                                        onChange={e => setSanctionDays({ ...sanctionDays, Leve: e.target.value })}
                                    />
                                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {language === 'es' ? 'Días activo' : 'Days active'}
                                    </span>
                                </div>
                            </div>

                            {/* Falta Media */}
                            <div style={{
                                background: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                                    <h4 style={{ margin: 0, color: '#f59e0b', fontSize: '0.95rem', fontWeight: 700 }}>
                                        {language === 'es' ? 'Falta Media' : 'Moderate Offense'}
                                    </h4>
                                </div>
                                <p style={{ margin: '0 0 0.85rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                                    {language === 'es' ? 'Suspensiones temporales / Faltas medias' : 'Moderate infractions'} (Default: 14 {language === 'es' ? 'días' : 'days'})
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        required
                                        className="mac-form-input"
                                        style={{ width: '90px', padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700 }}
                                        value={sanctionDays.Media}
                                        onChange={e => setSanctionDays({ ...sanctionDays, Media: e.target.value })}
                                    />
                                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {language === 'es' ? 'Días activo' : 'Days active'}
                                    </span>
                                </div>
                            </div>

                            {/* Falta Grave */}
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                                    <h4 style={{ margin: 0, color: '#f87171', fontSize: '0.95rem', fontWeight: 700 }}>
                                        {language === 'es' ? 'Falta Grave' : 'Major Offense'}
                                    </h4>
                                </div>
                                <p style={{ margin: '0 0 0.85rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                                    {language === 'es' ? 'Expulsiones / Faltas severas' : 'Major disciplinary offenses'} (Default: 20 {language === 'es' ? 'días' : 'days'})
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        required
                                        className="mac-form-input"
                                        style={{ width: '90px', padding: '0.45rem 0.65rem', textAlign: 'center', fontWeight: 700 }}
                                        value={sanctionDays.Grave}
                                        onChange={e => setSanctionDays({ ...sanctionDays, Grave: e.target.value })}
                                    />
                                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {language === 'es' ? 'Días activo' : 'Days active'}
                                    </span>
                                </div>
                            </div>

                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                            {durationSavedNotice && (
                                <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    <span>{language === 'es' ? '¡Duraciones guardadas correctamente!' : 'Durations saved successfully!'}</span>
                                </span>
                            )}
                            <button
                                type="submit"
                                className="mac-btn mac-btn-primary"
                                disabled={savingDurations}
                                style={{
                                    padding: '0.55rem 1.25rem',
                                    fontSize: '0.88rem',
                                    fontWeight: 700
                                }}
                            >
                                {savingDurations 
                                    ? (language === 'es' ? 'Guardando...' : 'Saving...') 
                                    : (language === 'es' ? 'Guardar Duraciones de Sanciones' : 'Save Sanction Durations')}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}

export default Admin;


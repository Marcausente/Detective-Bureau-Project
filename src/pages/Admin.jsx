import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import { useLanguage } from '../contexts/LanguageContext'; // Import useLanguage
import '../index.css';

function Admin() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const { theme, changeTheme, isLSSD } = useTheme();
    const { language, changeLanguage, t } = useLanguage();
    const [updatingTheme, setUpdatingTheme] = useState(false);
    const [updatingLanguage, setUpdatingLanguage] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
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

        checkAccess();
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
            </div>
        </div>
    );
}

export default Admin;

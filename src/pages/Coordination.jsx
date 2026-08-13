import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import CoordinationTodoList from '../components/CoordinationTodoList';
import CoordinationSanctions from '../components/CoordinationSanctions';
import '../index.css';

function Coordination() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'sanctions'
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setProfile(data);
            }
        } catch (err) {
            console.error('Error loading user profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const hasAccess = () => {
        if (!profile) return false;
        const role = profile.rol ? profile.rol.toLowerCase().trim() : '';
        const rank = profile.rango ? profile.rango.toLowerCase().trim() : '';

        // Allowed roles & ranks
        const allowedRoles = ['coordinador', 'comisionado', 'administrador', 'superadmin', 'admin'];
        const allowedRanks = ['jefe', 'capitan', 'comisionado', 'coordinador'];

        const isAllowedRole = allowedRoles.some(r => role.includes(r));
        const isAllowedRank = allowedRanks.some(r => rank.includes(r));

        return isAllowedRole || isAllowedRank || role === 'administrador' || role === 'superadmin';
    };

    if (loading) {
        return (
            <div className="mac-dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
                <div className="mac-doc-card" style={{ padding: '2.5rem 3.5rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="mac-status-dot" style={{ backgroundColor: '#f59e0b', margin: '0 auto 1.2rem auto', width: '12px', height: '12px', boxShadow: '0 0 12px #f59e0b' }}></div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '-0.01em' }}>Verificando credenciales de Coordinación...</div>
                </div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div className="mac-dashboard-container" style={{ maxWidth: '640px', margin: '3rem auto' }}>
                <div className="mac-command-banner" style={{
                    flexDirection: 'column',
                    textAlign: 'center',
                    padding: '2.5rem',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(15, 23, 42, 0.95))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="mac-status-dot" style={{ backgroundColor: '#ef4444' }}></span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acceso Restringido</span>
                    </div>

                    <h2 style={{ color: '#ffffff', margin: '0 0 0.75rem 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{t('accessDenied')}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, margin: 0, maxWidth: '460px' }}>
                        Este apartado de Coordinación está restringido únicamente al personal autorizado de <strong style={{ color: '#f87171' }}>Coordinación</strong>, <strong style={{ color: '#f87171' }}>Jefatura</strong> y <strong style={{ color: '#f87171' }}>Administración</strong>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mac-dashboard-container">
            {/* macOS Apple Command Header Banner */}
            <div className="mac-command-banner" style={{
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.9))',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '20px',
                padding: '1.75rem 2rem',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', zIndex: 2 }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.1))',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fbbf24',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)'
                    }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="mac-status-dot" style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }}></span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Executive Command & Leadership
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.2rem 0 0.25rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            PANEL DE COORDINACIÓN Y JEFATURA
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', fontWeight: 500 }}>
                            Gestión interna de tareas semanales, planificación de departamento y registro disciplinario.
                        </p>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '0.45rem 1rem',
                    borderRadius: '20px',
                    position: 'relative',
                    zIndex: 2
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Personal Autorizado
                    </span>
                </div>
            </div>

            {/* macOS Apple Segmented Pill Tab Bar */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.4rem',
                borderRadius: '16px',
                marginBottom: '2rem',
                width: 'fit-content',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
                <button
                    onClick={() => setActiveTab('todos')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        border: activeTab === 'todos' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                        background: activeTab === 'todos' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))' : 'transparent',
                        color: activeTab === 'todos' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: activeTab === 'todos' ? '0 4px 14px rgba(245, 158, 11, 0.25)' : 'none'
                    }}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'todos' ? '#fbbf24' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        <path d="M9 12h6"/>
                        <path d="M9 16h6"/>
                    </svg>
                    <span>{t('coordinationTasks') || 'Planificación & Tareas'}</span>
                </button>

                <button
                    onClick={() => setActiveTab('sanctions')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        border: activeTab === 'sanctions' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                        background: activeTab === 'sanctions' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15))' : 'transparent',
                        color: activeTab === 'sanctions' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: activeTab === 'sanctions' ? '0 4px 14px rgba(239, 68, 68, 0.25)' : 'none'
                    }}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'sanctions' ? '#f87171' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <path d="M12 8v4"/>
                        <path d="M12 16h.01"/>
                    </svg>
                    <span>{t('sanctionsRegister') || 'Registro Disciplinario'}</span>
                </button>
            </div>

            {/* Active Tab Component */}
            <div>
                {activeTab === 'todos' && <CoordinationTodoList />}
                {activeTab === 'sanctions' && <CoordinationSanctions />}
            </div>
        </div>
    );
}

export default Coordination;

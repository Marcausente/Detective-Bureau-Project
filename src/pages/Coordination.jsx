import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import CoordinationTodoList from '../components/CoordinationTodoList';
import CoordinationSanctions from '../components/CoordinationSanctions';
import CoordinationRolesConfig from '../components/CoordinationRolesConfig';
import CoordinationWebhookConfig from '../components/CoordinationWebhookConfig';
import '../index.css';

function Coordination() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'sanctions' | 'roles_config' | 'webhooks'
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
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                flexWrap: 'wrap'
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

                <button
                    onClick={() => setActiveTab('roles_config')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        border: activeTab === 'roles_config' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                        background: activeTab === 'roles_config' ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.15))' : 'transparent',
                        color: activeTab === 'roles_config' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: activeTab === 'roles_config' ? '0 4px 14px rgba(59, 130, 246, 0.25)' : 'none'
                    }}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'roles_config' ? '#60a5fa' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>Configuración Roles</span>
                </button>

                <button
                    onClick={() => setActiveTab('webhooks')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        border: activeTab === 'webhooks' ? '1px solid rgba(88, 101, 242, 0.5)' : '1px solid transparent',
                        background: activeTab === 'webhooks' ? 'linear-gradient(135deg, rgba(88, 101, 242, 0.3), rgba(71, 82, 196, 0.2))' : 'transparent',
                        color: activeTab === 'webhooks' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: activeTab === 'webhooks' ? '0 4px 14px rgba(88, 101, 242, 0.35)' : 'none'
                    }}
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill={activeTab === 'webhooks' ? '#818cf8' : '#94a3b8'}>
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    <span>Discord Webhooks</span>
                </button>
            </div>

            {/* Active Tab Component */}
            <div>
                {activeTab === 'todos' && <CoordinationTodoList />}
                {activeTab === 'sanctions' && <CoordinationSanctions />}
                {activeTab === 'roles_config' && <CoordinationRolesConfig />}
                {activeTab === 'webhooks' && <CoordinationWebhookConfig />}
            </div>
        </div>
    );
}

export default Coordination;

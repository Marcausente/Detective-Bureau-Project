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
            <div className="mac-dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="mac-doc-card" style={{ padding: '2rem 3rem', textAlign: 'center' }}>
                    <div className="mac-status-dot" style={{ backgroundColor: '#f59e0b', margin: '0 auto 1rem auto' }}></div>
                    <div style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 600 }}>Verificando credenciales de Coordinación...</div>
                </div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div className="mac-dashboard-container" style={{ maxWidth: '680px', margin: '3rem auto' }}>
                <div className="mac-command-banner" style={{ flexDirection: 'column', textAlign: 'center', padding: '2.5rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.95))', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🛑</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="mac-status-dot" style={{ backgroundColor: '#ef4444' }}></span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acceso Restringido</span>
                    </div>
                    <h2 style={{ color: '#ffffff', margin: '0 0 0.75rem 0', fontSize: '1.75rem', fontWeight: 800 }}>{t('accessDenied')}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                        Este apartado de Coordinación está restringido únicamente al personal de <strong style={{ color: '#f87171' }}>Coordinación</strong>, <strong style={{ color: '#f87171' }}>Jefatura</strong> y <strong style={{ color: '#f87171' }}>Administración</strong>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mac-dashboard-container">
            {/* macOS Apple Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(15, 23, 42, 0.85))', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '16px',
                        background: 'rgba(245, 158, 11, 0.18)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        boxShadow: '0 8px 20px rgba(245, 158, 11, 0.2)'
                    }}>
                        👔
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="mac-status-dot" style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }}></span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Executive Command & Leadership
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.2rem 0 0.3rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            PANEL DE COORDINACIÓN Y JEFATURA
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', fontWeight: 500 }}>
                            Gestión interna de tareas semanales, planificación de departamento y registro disciplinario.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.45rem 1rem', borderRadius: '20px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Personal Autorizado
                    </span>
                </div>
            </div>

            {/* macOS Apple Segmented Pill Tab Bar */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0.4rem',
                borderRadius: '16px',
                marginBottom: '2rem',
                width: 'fit-content'
            }}>
                <button
                    onClick={() => setActiveTab('todos')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        border: activeTab === 'todos' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                        background: activeTab === 'todos' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                        color: activeTab === 'todos' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: activeTab === 'todos' ? '0 4px 14px rgba(245, 158, 11, 0.25)' : 'none'
                    }}
                >
                    <span style={{ fontSize: '1.1rem' }}>📋</span>
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
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        border: activeTab === 'sanctions' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                        background: activeTab === 'sanctions' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        color: activeTab === 'sanctions' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: activeTab === 'sanctions' ? '0 4px 14px rgba(239, 68, 68, 0.25)' : 'none'
                    }}
                >
                    <span style={{ fontSize: '1.1rem' }}>⚖️</span>
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

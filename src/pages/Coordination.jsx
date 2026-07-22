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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1.5rem 2.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    ⏳ Verificando permisos de Coordinación...
                </div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div style={{ maxWidth: '650px', margin: '3rem auto', textAlign: 'center' }}>
                <div style={{ padding: '3rem', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '16px', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛑</div>
                    <h2 style={{ color: '#ef4444', margin: '0 0 1rem 0', fontSize: '1.8rem' }}>{t('accessDenied')}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                        Este apartado de Coordinación está restringido únicamente a personal autorizado de **Coordinación**, **Jefatura** y **Administración**.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '0 0 3rem 0' }}>
            {/* Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                borderRadius: '16px',
                padding: '1.5rem 2rem',
                marginBottom: '2rem',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'rgba(217, 119, 6, 0.15)',
                        border: '1px solid rgba(217, 119, 6, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem'
                    }}>
                        👔
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', fontWeight: '800', letterSpacing: '0.5px' }}>
                            Panel de Coordinación y Jefatura
                        </h2>
                        <div style={{ color: 'var(--accent-gold)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                            Gestión interna de tareas semanales, planificación de departamento y registro disciplinario.
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{
                        background: 'rgba(217, 119, 6, 0.15)',
                        color: 'var(--accent-gold)',
                        border: '1px solid rgba(217, 119, 6, 0.3)',
                        padding: '0.4rem 0.9rem',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '600'
                    }}>
                        Acceso Restringido
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                borderBottom: '2px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '2rem',
                paddingBottom: '0.2rem'
            }}>
                <button
                    onClick={() => setActiveTab('todos')}
                    style={{
                        background: activeTab === 'todos' ? 'rgba(217, 119, 6, 0.18)' : 'rgba(15, 23, 42, 0.4)',
                        color: activeTab === 'todos' ? 'var(--accent-gold)' : '#94a3b8',
                        border: activeTab === 'todos' ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                        borderBottom: activeTab === 'todos' ? '3px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                        padding: '0.85rem 1.6rem',
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        borderRadius: '10px 10px 0 0',
                        transition: 'all 0.25 ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                    }}
                >
                    📋 {t('coordinationTasks')}
                </button>
                <button
                    onClick={() => setActiveTab('sanctions')}
                    style={{
                        background: activeTab === 'sanctions' ? 'rgba(217, 119, 6, 0.18)' : 'rgba(15, 23, 42, 0.4)',
                        color: activeTab === 'sanctions' ? 'var(--accent-gold)' : '#94a3b8',
                        border: activeTab === 'sanctions' ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                        borderBottom: activeTab === 'sanctions' ? '3px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                        padding: '0.85rem 1.6rem',
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        borderRadius: '10px 10px 0 0',
                        transition: 'all 0.25s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                    }}
                >
                    ⚖️ {t('sanctionsRegister')}
                </button>
            </div>

            {/* Tab Body */}
            <div>
                {activeTab === 'todos' && <CoordinationTodoList />}
                {activeTab === 'sanctions' && <CoordinationSanctions />}
            </div>
        </div>
    );
}

export default Coordination;

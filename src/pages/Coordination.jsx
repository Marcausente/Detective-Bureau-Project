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
                <div className="coordination-card" style={{ padding: '1.5rem 2.5rem' }}>
                    ⏳ Verificando permisos de Coordinación...
                </div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div style={{ maxWidth: '650px', margin: '3rem auto', textAlign: 'center' }}>
                <div className="coordination-card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛑</div>
                    <h2 style={{ color: '#ef4444', margin: '0 0 1rem 0', fontSize: '1.8rem' }}>{t('accessDenied')}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
                        Este apartado de Coordinación está restringido únicamente a personal autorizado de **Coordinación**, **Jefatura** y **Administración**.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '0 0 3rem 0' }}>
            {/* Header Banner */}
            <div className="coordination-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'rgba(217, 119, 6, 0.15)',
                        border: '1px solid var(--accent-gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem'
                    }}>
                        👔
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: '800', letterSpacing: '0.5px' }}>
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
                        border: '1px solid var(--accent-gold)',
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
                    className={`coordination-tab-btn ${activeTab === 'todos' ? 'active' : ''}`}
                >
                    📋 {t('coordinationTasks')}
                </button>
                <button
                    onClick={() => setActiveTab('sanctions')}
                    className={`coordination-tab-btn ${activeTab === 'sanctions' ? 'active' : ''}`}
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

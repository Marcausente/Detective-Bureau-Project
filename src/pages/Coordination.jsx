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
            <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    ⏳ Verificando permisos de Coordinación...
                </div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div className="main-content" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <div className="dashboard-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(15, 23, 42, 0.8)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛑</div>
                    <h2 style={{ color: '#ef4444', margin: '0 0 1rem 0' }}>{t('accessDenied')}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
                        Este apartado de Coordinación está restringido únicamente a personal de **Coordinación**, **Jefatura** y **Administración**.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="main-content" style={{ padding: '2rem 1.5rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '2rem' }}>👔</div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc', fontWeight: '800' }}>
                            {t('coordination')}
                        </h1>
                        <div style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            Panel de Gestión y Coordinación
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('todos')}
                    style={{
                        background: activeTab === 'todos' ? 'rgba(217, 119, 6, 0.2)' : 'transparent',
                        color: activeTab === 'todos' ? 'var(--accent-gold)' : '#94a3b8',
                        border: 'none',
                        borderBottom: activeTab === 'todos' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                        padding: '0.75rem 1.25rem',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        borderRadius: '6px 6px 0 0',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    📋 {t('coordinationTasks')}
                </button>
                <button
                    onClick={() => setActiveTab('sanctions')}
                    style={{
                        background: activeTab === 'sanctions' ? 'rgba(217, 119, 6, 0.2)' : 'transparent',
                        color: activeTab === 'sanctions' ? 'var(--accent-gold)' : '#94a3b8',
                        border: 'none',
                        borderBottom: activeTab === 'sanctions' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                        padding: '0.75rem 1.25rem',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        borderRadius: '6px 6px 0 0',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    ⚖️ {t('sanctionsRegister')}
                </button>
            </div>

            {/* Tab Body */}
            {activeTab === 'todos' && <CoordinationTodoList />}
            {activeTab === 'sanctions' && <CoordinationSanctions />}
        </div>
    );
}

export default Coordination;

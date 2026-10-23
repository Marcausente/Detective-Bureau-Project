import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

const DIRECTIVE_CATEGORIES = [
    { value: 'Directiva General', label: 'Directiva General', icon: '📜', color: '#38bdf8' },
    { value: 'Orden Ejecutiva', label: 'Orden Ejecutiva', icon: '⚖️', color: '#f59e0b' },
    { value: 'Alerta de Seguridad', label: 'Alerta Operativa / Seguridad', icon: '🚨', color: '#ef4444' },
    { value: 'Comunicado Oficial', label: 'Comunicado Oficial', icon: '📢', color: '#a855f7' }
];

const DIRECTIVE_PRIORITIES = [
    { value: 'Baja', label: 'Baja', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    { value: 'Media', label: 'Media', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
    { value: 'Alta', label: 'Alta', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    { value: 'Urgente', label: 'Urgente / Inmediata', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' }
];

const DIVISION_RADAR = [
    { name: 'Detective Bureau', label: 'Detective Bureau (DB)', icon: '🔍', color: '#38bdf8', path: '/cases' },
    { name: 'Internal Affairs', label: 'Asuntos Internos (IA)', icon: '🛡️', color: '#f59e0b', path: '/internal-affairs' },
    { name: 'DOJ', label: 'Departamento de Justicia (DOJ)', icon: '⚖️', color: '#10b981', path: '/doj' },
    { name: 'SEB', label: 'Special Enforcement Bureau (SEB)', icon: '⚡', color: '#ef4444', path: '/seb' },
    { name: 'ASD', label: 'Air Support Division (ASD)', icon: '🚁', color: '#06b6d4', path: '/air-support' },
    { name: 'Gang Unit', label: 'Gang Unit (GU)', icon: '🎯', color: '#ec4899', path: '/gangs' },
    { name: 'Undercover', label: 'División Undercover (UD)', icon: '🕵️', color: '#8b5cf6', path: '/undercover' }
];

export default function Comandancia() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { isLSSD, branding } = useTheme();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('directives'); // 'directives' | 'high_command' | 'divisions_radar' | 'feedbacks'
    const [directives, setDirectives] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({
        totalPersonnel: 0,
        activeCases: 0,
        iaCases: 0,
        directivesCount: 0,
        feedbacksCount: 0
    });

    // Directive Modal State
    const [showDirectiveModal, setShowDirectiveModal] = useState(false);
    const [submittingDirective, setSubmittingDirective] = useState(false);
    const [directiveForm, setDirectiveForm] = useState({
        title: '',
        category: 'Directiva General',
        priority: 'Media',
        content: '',
        target_divisions: ['Todas'],
        status: 'Vigente'
    });
    const [directiveSearch, setDirectiveSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Feedbacks View State
    const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all'); // 'all' | 'Positivo' | 'Negativo' | 'Mixto'
    const [feedbackSearch, setFeedbackSearch] = useState('');
    const [feedbackAgentFilter, setFeedbackAgentFilter] = useState('all');
    const [feedbackSubView, setFeedbackSubView] = useState('audit'); // 'audit' | 'timeline'
    const [copyNotice, setCopyNotice] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            // 1. Load User Profile
            const { data: myProfile } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
            setProfile(myProfile);

            // 2. Load all personnel for high command oversight
            const { data: allUsers } = await supabase
                .from('users')
                .select('id, nombre, apellido, no_placa, rango, rol, divisions, subdivisions, profile_image, fecha_ingreso');
            if (allUsers) setUsers(allUsers);

            // 3. Load Directives (from table or fallback to app_settings)
            let loadedDirectives = [];
            try {
                const { data: dirData, error: dirErr } = await supabase
                    .from('comandancia_directives')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!dirErr && dirData) {
                    loadedDirectives = dirData;
                } else {
                    const { data: settingData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'comandancia_directives')
                        .single();
                    if (settingData?.value) {
                        loadedDirectives = typeof settingData.value === 'string'
                            ? JSON.parse(settingData.value)
                            : settingData.value;
                    }
                }
            } catch (err) {
                console.warn('Error fetching directives:', err);
            }
            setDirectives(loadedDirectives || []);

            // 3b. Load Feedbacks (from table or fallback to app_settings)
            let loadedFeedbacks = [];
            try {
                const { data: fbData, error: fbErr } = await supabase
                    .from('agent_feedbacks')
                    .select('*')
                    .order('fecha', { ascending: false });
                if (!fbErr && fbData) {
                    loadedFeedbacks = fbData;
                } else {
                    const { data: fbSetting } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'agent_feedbacks')
                        .single();
                    if (fbSetting?.value) {
                        loadedFeedbacks = typeof fbSetting.value === 'string'
                            ? JSON.parse(fbSetting.value)
                            : fbSetting.value;
                    }
                }
            } catch (fbE) {
                console.warn('Error fetching feedbacks:', fbE);
            }
            setFeedbacks(loadedFeedbacks || []);

            // 4. Load basic counts for KPI dashboard
            const [casesRes, iaCasesRes] = await Promise.all([
                supabase.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
                supabase.from('ia_cases').select('id', { count: 'exact', head: true }).neq('status', 'Archivado')
            ]);

            setStats({
                totalPersonnel: allUsers ? allUsers.length : 0,
                activeCases: casesRes?.count || 0,
                iaCases: iaCasesRes?.count || 0,
                directivesCount: loadedDirectives ? loadedDirectives.length : 0,
                feedbacksCount: loadedFeedbacks ? loadedFeedbacks.length : 0
            });
        } catch (err) {
            console.error('Error loading Comandancia data:', err);
        } finally {
            setLoading(false);
        }
    };

    const hasAccess = useMemo(() => {
        if (!profile) return false;
        const role = (profile.rol || '').trim();
        const roleLower = role.toLowerCase();
        const isSuperRole = ['comisionado', 'administrador', 'superadmin'].includes(roleLower);
        const hasDivision = (profile.divisions && profile.divisions.includes('Comandancia')) ||
            (profile.subdivisions && profile.subdivisions.includes('Comandancia'));
        return isSuperRole || hasDivision;
    }, [profile]);

    const handleCreateDirective = async (e) => {
        e.preventDefault();
        if (!directiveForm.title.trim() || !directiveForm.content.trim()) {
            alert('Por favor, ingresa el título y contenido de la directiva.');
            return;
        }

        try {
            setSubmittingDirective(true);
            const newDirective = {
                id: crypto.randomUUID ? crypto.randomUUID() : `dir-${Date.now()}`,
                title: directiveForm.title.trim(),
                category: directiveForm.category,
                priority: directiveForm.priority,
                content: directiveForm.content.trim(),
                target_divisions: directiveForm.target_divisions,
                author_id: profile?.id,
                author_name: `${profile?.nombre || ''} ${profile?.apellido || ''}`.trim(),
                author_rank: profile?.rango || 'Alto Mando',
                status: directiveForm.status || 'Vigente',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error: tblError } = await supabase
                .from('comandancia_directives')
                .insert([newDirective]);

            if (tblError) {
                const updatedList = [newDirective, ...directives];
                await supabase.from('app_settings').upsert({
                    key: 'comandancia_directives',
                    value: updatedList,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
            }

            setDirectives(prev => [newDirective, ...prev]);
            setShowDirectiveModal(false);
            setDirectiveForm({
                title: '',
                category: 'Directiva General',
                priority: 'Media',
                content: '',
                target_divisions: ['Todas'],
                status: 'Vigente'
            });
        } catch (err) {
            console.error('Error creating directive:', err);
            alert('Error al guardar directiva: ' + err.message);
        } finally {
            setSubmittingDirective(false);
        }
    };

    const handleDeleteDirective = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta directiva oficial?')) return;
        try {
            await supabase
                .from('comandancia_directives')
                .delete()
                .eq('id', id);

            const filtered = directives.filter(d => d.id !== id);
            setDirectives(filtered);

            await supabase.from('app_settings').upsert({
                key: 'comandancia_directives',
                value: filtered,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (err) {
            console.error('Error deleting directive:', err);
        }
    };

    const handleDeleteFeedback = async (id) => {
        if (!window.confirm('¿Deseas eliminar este registro de feedback?')) return;
        try {
            await supabase
                .from('agent_feedbacks')
                .delete()
                .eq('id', id);

            const filtered = feedbacks.filter(f => f.id !== id);
            setFeedbacks(filtered);

            await supabase.from('app_settings').upsert({
                key: 'agent_feedbacks',
                value: filtered,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (err) {
            console.error('Error deleting feedback:', err);
        }
    };

    const copyPublicFeedbackLink = () => {
        const link = `${window.location.origin}/feedback`;
        navigator.clipboard.writeText(link);
        setCopyNotice(true);
        setTimeout(() => setCopyNotice(false), 2500);
    };

    const highCommandOfficers = useMemo(() => {
        const commandRanks = [
            'Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief',
            'Comandante', 'Capitan', 'Teniente', 'Sargento II', 'Sargento I'
        ];
        return users.filter(u =>
            commandRanks.includes(u.rango) ||
            ['Comisionado', 'Administrador', 'Coordinador'].includes(u.rol) ||
            (u.divisions && u.divisions.includes('Comandancia'))
        ).sort((a, b) => {
            const priority = {
                'Sheriff': 120, 'Undersheriff': 115, 'Assistant Sheriff': 112,
                'Division Chief': 111, 'Comandante': 110, 'Capitan': 100,
                'Teniente': 90, 'Sargento II': 75, 'Sargento I': 65
            };
            return (priority[b.rango] || 0) - (priority[a.rango] || 0);
        });
    }, [users]);

    const filteredDirectives = useMemo(() => {
        return directives.filter(d => {
            const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;
            const matchesSearch = !directiveSearch.trim() ||
                (d.title && d.title.toLowerCase().includes(directiveSearch.toLowerCase())) ||
                (d.content && d.content.toLowerCase().includes(directiveSearch.toLowerCase())) ||
                (d.author_name && d.author_name.toLowerCase().includes(directiveSearch.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [directives, categoryFilter, directiveSearch]);

    // Agent Feedbacks Audit Map (Evaluated Targets & Authors)
    const agentFeedbackAudit = useMemo(() => {
        const map = {};
        users.forEach(u => {
            map[u.id] = {
                user: u,
                receivedTotal: 0,
                positivesReceived: 0,
                negativesReceived: 0,
                mixedReceived: 0,
                submittedTotal: 0,
                positivesSubmitted: 0,
                negativesSubmitted: 0,
                mixedSubmitted: 0
            };
        });

        feedbacks.forEach(fb => {
            // Target matching
            let targetUser = users.find(u => u.id === fb.target_user_id);
            if (!targetUser && fb.target_name) {
                const cleanTarget = fb.target_name.toLowerCase();
                targetUser = users.find(u =>
                    (u.nombre && cleanTarget.includes(u.nombre.toLowerCase())) &&
                    (u.apellido && cleanTarget.includes(u.apellido.toLowerCase()))
                );
            }
            if (targetUser && map[targetUser.id]) {
                map[targetUser.id].receivedTotal += 1;
                if (fb.tipo === 'Positivo') map[targetUser.id].positivesReceived += 1;
                else if (fb.tipo === 'Negativo') map[targetUser.id].negativesReceived += 1;
                else if (fb.tipo === 'Mixto') map[targetUser.id].mixedReceived += 1;
            }

            // Author matching
            let authorUser = users.find(u => u.id === fb.author_user_id);
            if (!authorUser && fb.author_name) {
                const cleanAuthor = fb.author_name.toLowerCase();
                authorUser = users.find(u =>
                    (u.nombre && cleanAuthor.includes(u.nombre.toLowerCase())) &&
                    (u.apellido && cleanAuthor.includes(u.apellido.toLowerCase()))
                );
            }
            if (authorUser && map[authorUser.id]) {
                map[authorUser.id].submittedTotal += 1;
                if (fb.tipo === 'Positivo') map[authorUser.id].positivesSubmitted += 1;
                else if (fb.tipo === 'Negativo') map[authorUser.id].negativesSubmitted += 1;
                else if (fb.tipo === 'Mixto') map[authorUser.id].mixedSubmitted += 1;
            }
        });

        return Object.values(map).map(entry => {
            const netScore = entry.positivesReceived - entry.negativesReceived;
            let status = 'neutral';
            if (entry.receivedTotal > 0) {
                if (entry.positivesReceived > entry.negativesReceived) status = 'positive';
                else if (entry.negativesReceived > entry.positivesReceived) status = 'negative';
            }

            let submittedTendency = 'Sin feedbacks puestos';
            if (entry.submittedTotal > 0) {
                if (entry.positivesSubmitted > entry.negativesSubmitted) {
                    submittedTendency = `Más positivos (+${entry.positivesSubmitted} vs -${entry.negativesSubmitted})`;
                } else if (entry.negativesSubmitted > entry.positivesSubmitted) {
                    submittedTendency = `Más negativos (-${entry.negativesSubmitted} vs +${entry.positivesSubmitted})`;
                } else {
                    submittedTendency = `Equilibrado (${entry.positivesSubmitted} / ${entry.negativesSubmitted})`;
                }
            }

            return {
                ...entry,
                netScore,
                status,
                submittedTendency
            };
        });
    }, [users, feedbacks]);

    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            const matchesType = feedbackTypeFilter === 'all' || f.tipo === feedbackTypeFilter;
            const matchesSearch = !feedbackSearch.trim() ||
                (f.author_name && f.author_name.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.target_name && f.target_name.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.motivo && f.motivo.toLowerCase().includes(feedbackSearch.toLowerCase()));
            const matchesAgent = feedbackAgentFilter === 'all' ||
                f.target_user_id === feedbackAgentFilter ||
                (f.target_name && f.target_name.toLowerCase().includes(feedbackAgentFilter.toLowerCase()));
            return matchesType && matchesSearch && matchesAgent;
        });
    }, [feedbacks, feedbackTypeFilter, feedbackSearch, feedbackAgentFilter]);

    const feedbackKPIs = useMemo(() => {
        const positives = feedbacks.filter(f => f.tipo === 'Positivo').length;
        const negatives = feedbacks.filter(f => f.tipo === 'Negativo').length;
        const mixed = feedbacks.filter(f => f.tipo === 'Mixto').length;
        return {
            total: feedbacks.length,
            positives,
            negatives,
            mixed,
            netBalance: positives - negatives
        };
    }, [feedbacks]);

    if (loading) {
        return (
            <div className="mac-dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
                <div className="mac-doc-card" style={{ padding: '2.5rem 3.5rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="mac-status-dot" style={{ backgroundColor: '#f59e0b', margin: '0 auto 1.2rem auto', width: '12px', height: '12px', boxShadow: '0 0 12px #f59e0b' }}></div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '-0.01em' }}>Verificando credenciales de Comandancia...</div>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
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
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="mac-status-dot" style={{ backgroundColor: '#ef4444' }}></span>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>Acceso Restringido</h2>
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                        Este módulo está reservado exclusivamente para la <strong>Comandancia</strong>, <strong>Comisionado</strong> y <strong>Administradores</strong> del sistema.
                    </p>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.6rem 1.6rem', margin: '0 auto' }}
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mac-dashboard-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem' }}>
            {/* Header Banner - Apple macOS Style */}
            <div className="mac-command-banner" style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(99, 102, 241, 0.15) 50%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '24px',
                padding: '2rem 2.25rem',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                marginBottom: '1.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '18px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(99, 102, 241, 0.35))',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            boxShadow: '0 10px 25px rgba(245, 158, 11, 0.2)'
                        }}>
                            🏛️
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    color: '#fbbf24',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(245, 158, 11, 0.35)'
                                }}>
                                    Despacho de Jefatura
                                </span>
                                <span className="mac-status-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nivel de Mando Superior</span>
                            </div>
                            <h1 style={{ margin: '0.35rem 0 0.2rem 0', fontSize: '1.75rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                Comandancia General
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                                Coordinación estratégica, emisión de directivas departamentales y supervisión de estado mayor.
                            </p>
                        </div>
                    </div>

                    {/* Active Officer Identity Card */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0.65rem 1.1rem',
                        borderRadius: '14px',
                        backdropFilter: 'blur(16px)'
                    }}>
                        {profile?.profile_image ? (
                            <img
                                src={profile.profile_image}
                                alt="Mando"
                                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(245, 158, 11, 0.5)' }}
                            />
                        ) : (
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                background: 'rgba(245, 158, 11, 0.2)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem',
                                color: '#fbbf24',
                                fontWeight: 800
                            }}>
                                🎖️
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                {profile?.no_placa ? `[#${profile.no_placa}] ` : ''}{profile?.nombre} {profile?.apellido}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
                                {profile?.rango || 'Alto Mando'} • {profile?.rol}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Metric Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <div className="mac-doc-card" style={{ padding: '1.25rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Personal Total</span>
                        <span>👥</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.35rem' }}>
                        {stats.totalPersonnel}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                        Agentes registrados en la BBDD
                    </div>
                </div>

                <div className="mac-doc-card" style={{ padding: '1.25rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Casos Abiertos (DB)</span>
                        <span>📁</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.35rem' }}>
                        {stats.activeCases}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Investigaciones criminales activas
                    </div>
                </div>

                <div className="mac-doc-card" style={{ padding: '1.25rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Asuntos Internos (IA)</span>
                        <span>🛡️</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.35rem' }}>
                        {stats.iaCases}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Expedientes disciplinarios en trámite
                    </div>
                </div>

                <div className="mac-doc-card" style={{ padding: '1.25rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Directivas Vigentes</span>
                        <span>📜</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#a855f7', marginTop: '0.35rem' }}>
                        {stats.directivesCount}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Órdenes de mando activas
                    </div>
                </div>

                <div className="mac-doc-card" style={{ padding: '1.25rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Feedbacks de Agentes</span>
                        <span>💬</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: '0.35rem' }}>
                        {stats.feedbacksCount}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        +{feedbackKPIs.positives} / -{feedbackKPIs.negatives}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs (macOS Segmented Controller) */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.85rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setActiveTab('directives')}
                    style={{
                        background: activeTab === 'directives' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${activeTab === 'directives' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: activeTab === 'directives' ? '#fbbf24' : '#cbd5e1',
                        borderRadius: '10px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>📜</span>
                    <span>Directivas Oficiales</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        {directives.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('feedbacks')}
                    style={{
                        background: activeTab === 'feedbacks' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${activeTab === 'feedbacks' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: activeTab === 'feedbacks' ? '#4ade80' : '#cbd5e1',
                        borderRadius: '10px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>💬</span>
                    <span>Feedbacks de Agentes</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        {feedbacks.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('high_command')}
                    style={{
                        background: activeTab === 'high_command' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${activeTab === 'high_command' ? 'rgba(99, 102, 241, 0.45)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: activeTab === 'high_command' ? '#a5b4fc' : '#cbd5e1',
                        borderRadius: '10px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>🎖️</span>
                    <span>Alto Mando & Mandos Intermedios</span>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        {highCommandOfficers.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('divisions_radar')}
                    style={{
                        background: activeTab === 'divisions_radar' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${activeTab === 'divisions_radar' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: activeTab === 'divisions_radar' ? '#38bdf8' : '#cbd5e1',
                        borderRadius: '10px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>🌐</span>
                    <span>Radar de Divisiones</span>
                </button>
            </div>

            {/* TAB 1: DIRECTIVAS DE COMANDANCIA */}
            {activeTab === 'directives' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, maxWidth: '650px' }}>
                            <input
                                type="text"
                                placeholder="Buscar en directivas oficiales..."
                                value={directiveSearch}
                                onChange={(e) => setDirectiveSearch(e.target.value)}
                                className="form-input"
                                style={{
                                    flex: 1,
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '10px',
                                    padding: '0.55rem 0.9rem',
                                    color: '#ffffff',
                                    fontSize: '0.85rem'
                                }}
                            />

                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="form-input custom-select"
                                style={{
                                    width: 'auto',
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '10px',
                                    padding: '0.55rem 0.9rem',
                                    color: '#ffffff',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <option value="all">Todas las categorías</option>
                                {DIRECTIVE_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowDirectiveModal(true)}
                            className="personnel-add-btn"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 800,
                                gap: '6px'
                            }}
                        >
                            <span>➕</span>
                            <span>Nueva Directiva de Mando</span>
                        </button>
                    </div>

                    {filteredDirectives.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem 2rem',
                            background: 'rgba(30, 41, 59, 0.3)',
                            borderRadius: '16px',
                            border: '1px dashed rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📜</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No hay directivas registradas</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Utiliza el botón superior para emitir una nueva directiva o comunicado de jefatura.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredDirectives.map(directive => {
                                const catConfig = DIRECTIVE_CATEGORIES.find(c => c.value === directive.category) || DIRECTIVE_CATEGORIES[0];
                                const prioConfig = DIRECTIVE_PRIORITIES.find(p => p.value === directive.priority) || DIRECTIVE_PRIORITIES[1];

                                return (
                                    <div
                                        key={directive.id}
                                        style={{
                                            background: 'rgba(30, 41, 59, 0.65)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '16px',
                                            padding: '1.25rem 1.5rem',
                                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                                            backdropFilter: 'blur(16px)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        color: catConfig.color,
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        {catConfig.icon} {catConfig.label}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        color: prioConfig.color,
                                                        background: prioConfig.bg,
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${prioConfig.color}40`
                                                    }}>
                                                        Prioridad: {prioConfig.label}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {new Date(directive.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                                    {directive.title}
                                                </h3>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDirective(directive.id)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.12)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171',
                                                    fontSize: '0.75rem',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>

                                        <p style={{ margin: '0 0 1rem 0', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                            {directive.content}
                                        </p>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.65rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Emitido por:</span>
                                                <strong style={{ color: '#f8fafc' }}>{directive.author_name || 'Comandancia General'}</strong>
                                                <span>({directive.author_rank || 'Mando'})</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {(directive.target_divisions || ['Todas']).map(div => (
                                                    <span key={div} style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', color: '#cbd5e1' }}>
                                                        {div}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: FEEDBACKS DE AGENTES */}
            {activeTab === 'feedbacks' && (
                <div>
                    {/* Public Form Banner & Link Action */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(30, 41, 59, 0.7) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '16px',
                        padding: '1.25rem 1.5rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>📢</span>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                                    Formulario Público de Feedback (Sin Login)
                                </h3>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                                Cualquier agente puede acceder y emitir valoraciones positivas, negativas o mixtas hacia sus compañeros.
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={copyPublicFeedbackLink}
                                style={{
                                    background: copyNotice ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                    border: `1px solid ${copyNotice ? '#10b981' : 'rgba(255, 255, 255, 0.2)'}`,
                                    color: copyNotice ? '#4ade80' : '#f8fafc',
                                    borderRadius: '10px',
                                    padding: '0.55rem 1.1rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>{copyNotice ? '✓' : '🔗'}</span>
                                <span>{copyNotice ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => window.open('/feedback', '_blank')}
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    border: 'none',
                                    color: '#ffffff',
                                    borderRadius: '10px',
                                    padding: '0.55rem 1.2rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Abrir Formulario ↗
                            </button>
                        </div>
                    </div>

                    {/* Feedback KPI Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1rem', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Feedbacks</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>{feedbackKPIs.total}</div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>🌟 Positivos</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80', marginTop: '0.2rem' }}>+{feedbackKPIs.positives}</div>
                        </div>

                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>⚠️ Negativos</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f87171', marginTop: '0.2rem' }}>-{feedbackKPIs.negatives}</div>
                        </div>

                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '1rem', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>⚖️ Mixtos</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem' }}>{feedbackKPIs.mixed}</div>
                        </div>

                        <div style={{
                            background: feedbackKPIs.netBalance >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${feedbackKPIs.netBalance >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            padding: '1rem',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: feedbackKPIs.netBalance >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                                Balance Departamental
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: feedbackKPIs.netBalance >= 0 ? '#4ade80' : '#f87171', marginTop: '0.2rem' }}>
                                {feedbackKPIs.netBalance >= 0 ? `+${feedbackKPIs.netBalance}` : feedbackKPIs.netBalance}
                            </div>
                        </div>
                    </div>

                    {/* View Switcher: Audit por Agente vs Registro Cronológico */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setFeedbackSubView('audit')}
                                style={{
                                    background: feedbackSubView === 'audit' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${feedbackSubView === 'audit' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                                    color: feedbackSubView === 'audit' ? '#fbbf24' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.45rem 1rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                👥 Auditoría por Agente (Semáforo & Balance)
                            </button>

                            <button
                                type="button"
                                onClick={() => setFeedbackSubView('timeline')}
                                style={{
                                    background: feedbackSubView === 'timeline' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${feedbackSubView === 'timeline' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                                    color: feedbackSubView === 'timeline' ? '#38bdf8' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.45rem 1rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                📜 Registro Cronológico de Feedbacks ({filteredFeedbacks.length})
                            </button>
                        </div>

                        {/* Search & Type filter */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                placeholder="Buscar agente o palabra clave..."
                                value={feedbackSearch}
                                onChange={(e) => setFeedbackSearch(e.target.value)}
                                className="form-input"
                                style={{
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '0.45rem 0.85rem',
                                    color: '#ffffff',
                                    fontSize: '0.82rem',
                                    minWidth: '220px'
                                }}
                            />

                            <select
                                value={feedbackTypeFilter}
                                onChange={(e) => setFeedbackTypeFilter(e.target.value)}
                                className="form-input custom-select"
                                style={{
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '0.45rem 0.85rem',
                                    color: '#ffffff',
                                    fontSize: '0.82rem'
                                }}
                            >
                                <option value="all">Todos los tipos</option>
                                <option value="Positivo">🌟 Solo Positivos</option>
                                <option value="Negativo">⚠️ Solo Negativos</option>
                                <option value="Mixto">⚖️ Solo Mixtos</option>
                            </select>
                        </div>
                    </div>

                    {/* SUBVIEW 1: AUDITORÍA POR AGENTE (SEMÁFORO) */}
                    {feedbackSubView === 'audit' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {agentFeedbackAudit
                                .filter(item => {
                                    if (feedbackTypeFilter === 'Positivo' && item.positivesReceived === 0) return false;
                                    if (feedbackTypeFilter === 'Negativo' && item.negativesReceived === 0) return false;
                                    if (feedbackTypeFilter === 'Mixto' && item.mixedReceived === 0) return false;
                                    if (!feedbackSearch.trim()) return true;
                                    const term = feedbackSearch.toLowerCase();
                                    return (item.user.nombre && item.user.nombre.toLowerCase().includes(term)) ||
                                        (item.user.apellido && item.user.apellido.toLowerCase().includes(term)) ||
                                        (item.user.no_placa && item.user.no_placa.toLowerCase().includes(term)) ||
                                        (item.user.rango && item.user.rango.toLowerCase().includes(term));
                                })
                                .sort((a, b) => (b.receivedTotal - a.receivedTotal) || (b.netScore - a.netScore))
                                .map(entry => {
                                    const u = entry.user;
                                    const isGreen = entry.status === 'positive';
                                    const isRed = entry.status === 'negative';

                                    return (
                                        <div
                                            key={u.id}
                                            style={{
                                                background: isGreen
                                                    ? 'rgba(16, 185, 129, 0.06)'
                                                    : isRed
                                                        ? 'rgba(239, 68, 68, 0.06)'
                                                        : 'rgba(30, 41, 59, 0.5)',
                                                border: `1px solid ${isGreen ? 'rgba(16, 185, 129, 0.35)' : isRed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                borderRadius: '14px',
                                                padding: '1rem 1.25rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '1rem'
                                            }}
                                        >
                                            {/* Officer Basic Info */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {u.profile_image ? (
                                                    <img
                                                        src={u.profile_image}
                                                        alt={u.nombre}
                                                        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '44px',
                                                        height: '44px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 800,
                                                        color: '#cbd5e1'
                                                    }}>
                                                        {(u.nombre || 'A')[0]}
                                                    </div>
                                                )}

                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem' }}>
                                                        {u.no_placa ? `[#${u.no_placa}] ` : ''}{u.nombre} {u.apellido}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                                        {u.rango} • {u.divisions ? u.divisions.join(', ') : 'Detective Bureau'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Feedbacks Recibidos (Semáforo Verde / Rojo) */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                <div style={{ textAlign: 'center', minWidth: '130px' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Feedbacks Recibidos</div>
                                                    <div style={{
                                                        marginTop: '3px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '3px 10px',
                                                        borderRadius: '8px',
                                                        fontWeight: 800,
                                                        fontSize: '0.82rem',
                                                        background: isGreen ? 'rgba(16, 185, 129, 0.18)' : isRed ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                                                        color: isGreen ? '#4ade80' : isRed ? '#f87171' : '#cbd5e1',
                                                        border: `1px solid ${isGreen ? 'rgba(16, 185, 129, 0.4)' : isRed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`
                                                    }}>
                                                        <span>{isGreen ? '🟢 +' : isRed ? '🔴 -' : '⚪ '}</span>
                                                        <span>{entry.receivedTotal} Total ({entry.positivesReceived} pos / {entry.negativesReceived} neg)</span>
                                                    </div>
                                                </div>

                                                {/* Feedbacks Puestos (Emisor) */}
                                                <div style={{ textAlign: 'center', minWidth: '140px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '10px' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Feedbacks Puestos</div>
                                                    <div style={{
                                                        marginTop: '3px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        color: entry.submittedTotal > 0 ? '#38bdf8' : '#64748b'
                                                    }}>
                                                        {entry.submittedTotal} emitidos • {entry.submittedTendency}
                                                    </div>
                                                </div>

                                                {/* Action Link to profile */}
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/personnel/${u.id}`)}
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        color: '#f8fafc',
                                                        borderRadius: '8px',
                                                        padding: '0.45rem 0.9rem',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Ficha →
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* SUBVIEW 2: REGISTRO CRONOLÓGICO */}
                    {feedbackSubView === 'timeline' && (
                        <div>
                            {filteredFeedbacks.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem 2rem',
                                    background: 'rgba(30, 41, 59, 0.3)',
                                    borderRadius: '16px',
                                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                                    color: '#94a3b8'
                                }}>
                                    No se encontraron feedbacks coincidentes con los filtros actuales.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {filteredFeedbacks.map(fb => {
                                        const isPos = fb.tipo === 'Positivo';
                                        const isNeg = fb.tipo === 'Negativo';
                                        const pillColor = isPos ? '#4ade80' : isNeg ? '#f87171' : '#38bdf8';
                                        const pillBg = isPos ? 'rgba(16, 185, 129, 0.15)' : isNeg ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)';

                                        return (
                                            <div
                                                key={fb.id}
                                                style={{
                                                    background: 'rgba(30, 41, 59, 0.65)',
                                                    border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.3)' : isNeg ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                                                    borderRadius: '16px',
                                                    padding: '1.25rem 1.5rem',
                                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            color: pillColor,
                                                            background: pillBg,
                                                            padding: '3px 10px',
                                                            borderRadius: '6px',
                                                            border: `1px solid ${pillColor}40`
                                                        }}>
                                                            {isPos ? '🌟 Positivo' : isNeg ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                            Fecha: {fb.fecha || new Date(fb.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFeedback(fb.id)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.12)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            color: '#f87171',
                                                            fontSize: '0.72rem',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.85rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                                                    <div>
                                                        <span style={{ color: '#94a3b8' }}>Agente Destinatario: </span>
                                                        <strong style={{ color: '#f8fafc' }}>{fb.target_name}</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: '#94a3b8' }}>Emitido por: </span>
                                                        <strong style={{ color: '#cbd5e1' }}>{fb.author_name}</strong>
                                                    </div>
                                                </div>

                                                <div style={{
                                                    background: 'rgba(15, 23, 42, 0.6)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '10px',
                                                    padding: '0.9rem',
                                                    color: '#e2e8f0',
                                                    fontSize: '0.88rem',
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap'
                                                }}>
                                                    {fb.motivo}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: ALTO MANDO & MANDOS INTERMEDIOS */}
            {activeTab === 'high_command' && (
                <div>
                    <div style={{ marginBottom: '1.25rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
                        Mostrando oficiales de <strong>Comandancia</strong>, <strong>Jefatura</strong>, <strong>Capitanes</strong>, <strong>Tenientes</strong> y <strong>Sargentos</strong> activos.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                        {highCommandOfficers.map(officer => (
                            <div
                                key={officer.id}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '16px',
                                    padding: '1.1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}
                            >
                                {officer.profile_image ? (
                                    <img
                                        src={officer.profile_image}
                                        alt={officer.nombre}
                                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(245, 158, 11, 0.4)' }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        background: 'rgba(99, 102, 241, 0.25)',
                                        border: '2px solid rgba(99, 102, 241, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem',
                                        color: '#cbd5e1',
                                        fontWeight: 800
                                    }}>
                                        {(officer.nombre || 'O')[0]}
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {officer.no_placa ? `[#${officer.no_placa}] ` : ''}{officer.nombre} {officer.apellido}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, margin: '2px 0' }}>
                                        {officer.rango}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                        {(officer.divisions || ['Detective Bureau']).map(div => (
                                            <span key={div} style={{ fontSize: '0.68rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                                {div}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: RADAR DE DIVISIONES */}
            {activeTab === 'divisions_radar' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {DIVISION_RADAR.map(div => {
                            const count = users.filter(u => u.divisions && u.divisions.includes(div.name)).length;
                            return (
                                <div
                                    key={div.name}
                                    style={{
                                        background: 'rgba(30, 41, 59, 0.6)',
                                        border: `1px solid ${div.color}35`,
                                        borderRadius: '16px',
                                        padding: '1.4rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '1.75rem' }}>{div.icon}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: div.color, background: `${div.color}18`, padding: '2px 8px', borderRadius: '6px' }}>
                                                {count} Miembros
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                                            {div.label}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                                            Unidad operativa activa bajo supervisión de Comandancia.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(div.path)}
                                        style={{
                                            marginTop: '1.25rem',
                                            width: '100%',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: '#f8fafc',
                                            padding: '0.5rem',
                                            borderRadius: '8px',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Acceder a la División →
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal para Crear Directiva de Mando */}
            {showDirectiveModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '620px',
                        width: '90vw',
                        background: 'rgba(15, 23, 42, 0.96)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        backdropFilter: 'blur(25px)'
                    }}>
                        <div className="mac-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowDirectiveModal(false)} />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
                                    📜 Nueva Directiva Oficial de Comandancia
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleCreateDirective} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                    Título de la Directiva u Orden
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej. Directiva Operativa 2026-04: Protocolo en Despliegues ASD..."
                                    value={directiveForm.title}
                                    onChange={(e) => setDirectiveForm({ ...directiveForm, title: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', color: '#ffffff', borderRadius: '10px', padding: '0.6rem 0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        Categoría
                                    </label>
                                    <select
                                        value={directiveForm.category}
                                        onChange={(e) => setDirectiveForm({ ...directiveForm, category: e.target.value })}
                                        className="form-input custom-select"
                                        style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', color: '#ffffff', borderRadius: '10px', padding: '0.6rem 0.9rem' }}
                                    >
                                        {DIRECTIVE_CATEGORIES.map(c => (
                                            <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        Nivel de Prioridad
                                    </label>
                                    <select
                                        value={directiveForm.priority}
                                        onChange={(e) => setDirectiveForm({ ...directiveForm, priority: e.target.value })}
                                        className="form-input custom-select"
                                        style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', color: '#ffffff', borderRadius: '10px', padding: '0.6rem 0.9rem' }}
                                    >
                                        {DIRECTIVE_PRIORITIES.map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                    Contenido y Disposiciones de la Directiva
                                </label>
                                <textarea
                                    required
                                    rows={6}
                                    placeholder="Redacta las instrucciones, marco normativo, disposiciones y alcance de la orden..."
                                    value={directiveForm.content}
                                    onChange={(e) => setDirectiveForm({ ...directiveForm, content: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', color: '#ffffff', borderRadius: '10px', padding: '0.75rem', lineHeight: 1.5 }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowDirectiveModal(false)}
                                    className="login-button btn-secondary"
                                    style={{ width: 'auto', padding: '0.5rem 1.3rem', borderRadius: '10px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingDirective}
                                    className="login-button"
                                    style={{
                                        width: 'auto',
                                        padding: '0.5rem 1.6rem',
                                        borderRadius: '10px',
                                        fontWeight: 800,
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)'
                                    }}
                                >
                                    {submittingDirective ? 'Emitiendo...' : 'Publicar Directiva'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

export default function Comandancia() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { isLSSD, branding } = useTheme();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [feedbacks, setFeedbacks] = useState([]);
    const [existingFichas, setExistingFichas] = useState([]);

    // Feedbacks View State
    const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all'); // 'all' | 'Positivo' | 'Negativo' | 'Mixto'
    const [feedbackSearch, setFeedbackSearch] = useState('');
    const [feedbackSubView, setFeedbackSubView] = useState('audit'); // 'audit' | 'timeline'
    const [copyNotice, setCopyNotice] = useState(false);

    // Generic Ficha Modal State
    const [selectedFichaAgent, setSelectedFichaAgent] = useState(null);
    const [modalFichaTab, setModalFichaTab] = useState('received'); // 'received' | 'submitted'

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

            // 2. Load Feedbacks from agent_feedbacks (or fallback to app_settings)
            let loadedFeedbacks = [];
            try {
                const { data: fbData, error: fbErr } = await supabase
                    .from('agent_feedbacks')
                    .select('*')
                    .order('created_at', { ascending: false });
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

            // 3. Load Fichas from RPC if available
            try {
                const { data: fichasData, error: fichasErr } = await supabase.rpc('get_feedback_fichas');
                if (!fichasErr && fichasData) {
                    setExistingFichas(fichasData);
                }
            } catch (fErr) {
                console.warn('get_feedback_fichas RPC not available:', fErr);
            }
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

            // If an agent is open in modal, update selectedFichaAgent
            if (selectedFichaAgent) {
                setSelectedFichaAgent(prev => {
                    if (!prev) return null;
                    const updatedRec = prev.feedbacksReceived.filter(f => f.id !== id);
                    const updatedSub = prev.feedbacksSubmitted.filter(f => f.id !== id);
                    const pos = updatedRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'positivo').length;
                    const neg = updatedRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'negativo').length;
                    const mix = updatedRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'mixto').length;
                    return {
                        ...prev,
                        receivedTotal: updatedRec.length,
                        positivesReceived: pos,
                        negativesReceived: neg,
                        mixedReceived: mix,
                        netScore: pos - neg,
                        submittedTotal: updatedSub.length,
                        feedbacksReceived: updatedRec,
                        feedbacksSubmitted: updatedSub
                    };
                });
            }
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

    // Aggregate all agents into generic Fichas Evaluativas
    const agentFeedbackAudit = useMemo(() => {
        const map = {};

        // Helper to register agent in map
        const ensureAgent = (rawName) => {
            const cleanName = (rawName || '').trim();
            if (!cleanName) return null;
            const key = cleanName.toLowerCase();
            if (!map[key]) {
                map[key] = {
                    id: key,
                    name: cleanName,
                    receivedTotal: 0,
                    positivesReceived: 0,
                    negativesReceived: 0,
                    mixedReceived: 0,
                    submittedTotal: 0,
                    positivesSubmitted: 0,
                    negativesSubmitted: 0,
                    mixedSubmitted: 0,
                    feedbacksReceived: [],
                    feedbacksSubmitted: []
                };
            }
            return key;
        };

        // Populate from existing fichas
        existingFichas.forEach(f => {
            ensureAgent(f.agent_name);
        });

        // Group by feedbacks
        feedbacks.forEach(fb => {
            const rawTarget = fb.target_name || fb.target_agent_name || '';
            const targetKey = ensureAgent(rawTarget);
            const rawAuthor = fb.author_name || fb.author_agent_name || '';
            const authorKey = ensureAgent(rawAuthor);

            const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();

            if (targetKey && map[targetKey]) {
                map[targetKey].receivedTotal += 1;
                map[targetKey].feedbacksReceived.push(fb);
                if (fbType === 'positivo') map[targetKey].positivesReceived += 1;
                else if (fbType === 'negativo') map[targetKey].negativesReceived += 1;
                else if (fbType === 'mixto') map[targetKey].mixedReceived += 1;
            }

            if (authorKey && map[authorKey] && authorKey !== 'anónimo' && authorKey !== 'anonimo') {
                map[authorKey].submittedTotal += 1;
                map[authorKey].feedbacksSubmitted.push(fb);
                if (fbType === 'positivo') map[authorKey].positivesSubmitted += 1;
                else if (fbType === 'negativo') map[authorKey].negativesSubmitted += 1;
                else if (fbType === 'mixto') map[authorKey].mixedSubmitted += 1;
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
    }, [feedbacks, existingFichas]);

    const filteredAuditList = useMemo(() => {
        return agentFeedbackAudit
            .filter(item => {
                if (feedbackTypeFilter === 'Positivo' && item.positivesReceived === 0) return false;
                if (feedbackTypeFilter === 'Negativo' && item.negativesReceived === 0) return false;
                if (feedbackTypeFilter === 'Mixto' && item.mixedReceived === 0) return false;
                if (!feedbackSearch.trim()) return true;
                const term = feedbackSearch.toLowerCase();
                return item.name.toLowerCase().includes(term);
            })
            .sort((a, b) => (b.receivedTotal - a.receivedTotal) || (b.netScore - a.netScore));
    }, [agentFeedbackAudit, feedbackTypeFilter, feedbackSearch]);

    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            const fType = (f.tipo || f.feedback_type || '').toLowerCase();
            const matchesType = feedbackTypeFilter === 'all' || fType === feedbackTypeFilter.toLowerCase();
            const matchesSearch = !feedbackSearch.trim() ||
                (f.author_name && f.author_name.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.target_name && f.target_name.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.motivo && f.motivo.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.reason && f.reason.toLowerCase().includes(feedbackSearch.toLowerCase()));
            return matchesType && matchesSearch;
        });
    }, [feedbacks, feedbackTypeFilter, feedbackSearch]);

    const feedbackKPIs = useMemo(() => {
        let positives = 0;
        let negatives = 0;
        let mixed = 0;
        feedbacks.forEach(f => {
            const t = (f.tipo || f.feedback_type || '').toLowerCase();
            if (t === 'positivo') positives++;
            else if (t === 'negativo') negatives++;
            else if (t === 'mixto') mixed++;
        });
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
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(59, 130, 246, 0.12) 50%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
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
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(59, 130, 246, 0.35))',
                            border: '1px solid rgba(16, 185, 129, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)'
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
                                    color: '#6ee7b7',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(16, 185, 129, 0.35)'
                                }}>
                                    Despacho de Comandancia
                                </span>
                                <span className="mac-status-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Supervisión de Desempeño</span>
                            </div>
                            <h1 style={{ margin: '0.35rem 0 0.2rem 0', fontSize: '1.75rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                Feedbacks de Agentes • Comandancia
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                                Auditoría centralizada de feedbacks, fichas evaluativas y balance de conducta departamental.
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
                                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(16, 185, 129, 0.5)' }}
                            />
                        ) : (
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyCenter: 'center',
                                fontSize: '1.1rem',
                                color: '#6ee7b7',
                                fontWeight: 800
                            }}>
                                🎖️
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                {profile?.no_placa ? `[#${profile.no_placa}] ` : ''}{profile?.nombre} {profile?.apellido}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600 }}>
                                {profile?.rango || 'Alto Mando'} • {profile?.rol}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* THE ONLY COUNTER: Feedbacks de Agentes & Breakdown */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '20px',
                padding: '1.5rem',
                marginBottom: '1.75rem',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(16px)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem'
                        }}>
                            💬
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#6ee7b7', letterSpacing: '0.08em' }}>
                                Indicador Oficial de Comandancia
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc' }}>
                                Feedbacks de Agentes ({feedbackKPIs.total} Total)
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => window.open('/feedback', '_blank')}
                            className="personnel-add-btn"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 800,
                                gap: '8px',
                                padding: '0.55rem 1.1rem',
                                borderRadius: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            <span>✍️</span>
                            <span>Rellenar Nuevo Feedback ↗</span>
                        </button>

                        <button
                            type="button"
                            onClick={copyPublicFeedbackLink}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.18)',
                                color: '#f8fafc',
                                borderRadius: '10px',
                                padding: '0.55rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>🔗</span>
                            <span>{copyNotice ? '¡Enlace Copiado!' : 'Copiar Formulario'}</span>
                        </button>
                    </div>
                </div>

                {/* Counter Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.28)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase' }}>
                            🌟 Positivos
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4ade80', marginTop: '0.25rem' }}>
                            {feedbackKPIs.positives}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Reconocimientos de labor
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.28)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 800, textTransform: 'uppercase' }}>
                            ⚠️ Negativos
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f87171', marginTop: '0.25rem' }}>
                            {feedbackKPIs.negatives}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Observaciones de conducta
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.28)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 800, textTransform: 'uppercase' }}>
                            ⚖️ Mixtos
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#facc15', marginTop: '0.25rem' }}>
                            {feedbackKPIs.mixed}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Aspectos neutros / mixtos
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 800, textTransform: 'uppercase' }}>
                            📊 Balance Neto
                        </div>
                        <div style={{
                            fontSize: '1.75rem',
                            fontWeight: 900,
                            color: feedbackKPIs.netBalance >= 0 ? '#4ade80' : '#f87171',
                            marginTop: '0.25rem'
                        }}>
                            {feedbackKPIs.netBalance > 0 ? `+${feedbackKPIs.netBalance}` : feedbackKPIs.netBalance}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            {feedbackKPIs.netBalance >= 0 ? 'Balance positivo' : 'Balance deficitario'}
                        </div>
                    </div>
                </div>
            </div>

            {/* FEEDBACK CONTROLS & SUB-VIEWS */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '1.5rem',
                backdropFilter: 'blur(20px)'
            }}>
                {/* Subview Selector & Filters */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '1.25rem'
                }}>
                    {/* Subview tabs: Auditoría por Agente vs Cronología */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <button
                            type="button"
                            onClick={() => setFeedbackSubView('audit')}
                            style={{
                                background: feedbackSubView === 'audit' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                                border: feedbackSubView === 'audit' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                                color: feedbackSubView === 'audit' ? '#6ee7b7' : '#94a3b8',
                                borderRadius: '8px',
                                padding: '0.45rem 1rem',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>🚦</span>
                            <span>Auditoría por Agente ({filteredAuditList.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFeedbackSubView('timeline')}
                            style={{
                                background: feedbackSubView === 'timeline' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                                border: feedbackSubView === 'timeline' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                                color: feedbackSubView === 'timeline' ? '#6ee7b7' : '#94a3b8',
                                borderRadius: '8px',
                                padding: '0.45rem 1rem',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>📜</span>
                            <span>Cronología de Informes ({filteredFeedbacks.length})</span>
                        </button>
                    </div>

                    {/* Search & Type filter */}
                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', flex: 1, maxWidth: '520px', justifyContent: 'flex-end' }}>
                        <input
                            type="text"
                            placeholder={feedbackSubView === 'audit' ? 'Filtrar por nombre de agente...' : 'Buscar por agente, emisor o motivo...'}
                            value={feedbackSearch}
                            onChange={(e) => setFeedbackSearch(e.target.value)}
                            className="form-input"
                            style={{
                                flex: 1,
                                minWidth: '180px',
                                background: 'rgba(15, 23, 42, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '10px',
                                padding: '0.45rem 0.85rem',
                                color: '#ffffff',
                                fontSize: '0.82rem'
                            }}
                        />

                        <select
                            value={feedbackTypeFilter}
                            onChange={(e) => setFeedbackTypeFilter(e.target.value)}
                            className="form-input custom-select"
                            style={{
                                width: 'auto',
                                background: 'rgba(15, 23, 42, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '10px',
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

                {/* SUBVIEW 1: AUDITORÍA POR AGENTE (GENERIC FICHAS) */}
                {feedbackSubView === 'audit' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredAuditList.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 2rem',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: '16px',
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No se encontraron agentes con feedbacks</div>
                                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Modifica la búsqueda o registra nuevos feedbacks para comenzar la auditoría.</div>
                            </div>
                        ) : (
                            filteredAuditList.map(entry => {
                                const isGreen = entry.status === 'positive';
                                const isRed = entry.status === 'negative';

                                const semaforoBg = isGreen
                                    ? 'rgba(16, 185, 129, 0.08)'
                                    : isRed
                                        ? 'rgba(239, 68, 68, 0.08)'
                                        : 'rgba(30, 41, 59, 0.5)';
                                const semaforoBorder = isGreen
                                    ? 'rgba(16, 185, 129, 0.35)'
                                    : isRed
                                        ? 'rgba(239, 68, 68, 0.35)'
                                        : 'rgba(255, 255, 255, 0.1)';

                                return (
                                    <div
                                        key={entry.id}
                                        style={{
                                            background: semaforoBg,
                                            border: `1px solid ${semaforoBorder}`,
                                            borderRadius: '16px',
                                            padding: '1.1rem 1.35rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '1rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {/* Agent Generic Identity */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                                            <div style={{
                                                width: '46px',
                                                height: '46px',
                                                borderRadius: '14px',
                                                background: isGreen
                                                    ? 'rgba(16, 185, 129, 0.2)'
                                                    : isRed
                                                        ? 'rgba(239, 68, 68, 0.2)'
                                                        : 'rgba(255, 255, 255, 0.08)',
                                                border: `1px solid ${isGreen ? 'rgba(16, 185, 129, 0.4)' : isRed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 900,
                                                fontSize: '1.15rem',
                                                color: isGreen ? '#4ade80' : isRed ? '#f87171' : '#cbd5e1'
                                            }}>
                                                {entry.name.charAt(0).toUpperCase()}
                                            </div>

                                            <div>
                                                <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>
                                                    {entry.name}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        fontSize: '0.7rem',
                                                        color: '#cbd5e1'
                                                    }}>
                                                        Ficha Evaluativa
                                                    </span>
                                                    <span>•</span>
                                                    <span style={{ color: isGreen ? '#4ade80' : isRed ? '#f87171' : '#cbd5e1' }}>
                                                        Balance: {entry.netScore > 0 ? `+${entry.netScore}` : entry.netScore}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Feedbacks Recibidos (Semáforo Verde / Rojo) */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ textAlign: 'center', minWidth: '160px' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    Feedbacks Recibidos
                                                </div>
                                                <div style={{
                                                    marginTop: '4px',
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
                                                    <span>{isGreen ? '🟢' : isRed ? '🔴' : '⚪'}</span>
                                                    <span>{entry.receivedTotal} Total ({entry.positivesReceived} pos / {entry.negativesReceived} neg)</span>
                                                </div>
                                            </div>

                                            {/* Feedbacks Puestos (Emisor) */}
                                            <div style={{ textAlign: 'center', minWidth: '150px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '12px' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    Feedbacks Emitidos
                                                </div>
                                                <div style={{
                                                    marginTop: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    color: entry.submittedTotal > 0 ? '#38bdf8' : '#64748b'
                                                }}>
                                                    {entry.submittedTotal} emitidos • {entry.submittedTendency}
                                                </div>
                                            </div>

                                            {/* Open Generic Ficha Modal (NEVER redirects to personal!) */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFichaAgent(entry);
                                                    setModalFichaTab('received');
                                                }}
                                                style={{
                                                    background: 'rgba(16, 185, 129, 0.18)',
                                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                                    color: '#6ee7b7',
                                                    borderRadius: '10px',
                                                    padding: '0.55rem 1.1rem',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                                }}
                                            >
                                                <span>📋</span>
                                                <span>Ver Ficha Evaluativa</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* SUBVIEW 2: REGISTRO CRONOLÓGICO */}
                {feedbackSubView === 'timeline' && (
                    <div>
                        {filteredFeedbacks.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 2rem',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: '16px',
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No hay feedbacks registrados con esos criterios</div>
                                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Intenta limpiar los filtros o rellenar un nuevo informe de feedback.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredFeedbacks.map(fb => {
                                    const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                    const isPos = fbType === 'positivo';
                                    const isNeg = fbType === 'negativo';
                                    const pillColor = isPos ? '#4ade80' : isNeg ? '#f87171' : '#facc15';
                                    const pillBg = isPos ? 'rgba(16, 185, 129, 0.15)' : isNeg ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                    const pillBorder = isPos ? 'rgba(16, 185, 129, 0.35)' : isNeg ? 'rgba(239, 68, 68, 0.35)' : 'rgba(234, 179, 8, 0.35)';

                                    const targetName = fb.target_name || fb.target_agent_name || 'Agente';
                                    const authorName = fb.author_name || fb.author_agent_name || 'Anónimo';
                                    const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                    const reasonText = fb.motivo || fb.reason || '';

                                    return (
                                        <div
                                            key={fb.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.75)',
                                                border: `1px solid ${pillBorder}`,
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
                                                        border: `1px solid ${pillBorder}`
                                                    }}>
                                                        {isPos ? '🌟 Positivo' : isNeg ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        Fecha: {dateStr}
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
                                                        padding: '3px 9px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.85rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                                                <div>
                                                    <span style={{ color: '#94a3b8' }}>Agente Evaluado: </span>
                                                    <strong style={{ color: '#f8fafc' }}>{targetName}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#94a3b8' }}>Emitido por: </span>
                                                    <strong style={{ color: '#cbd5e1' }}>{authorName}</strong>
                                                </div>
                                            </div>

                                            <div style={{
                                                background: 'rgba(0, 0, 0, 0.35)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '10px',
                                                padding: '0.9rem',
                                                color: '#e2e8f0',
                                                fontSize: '0.88rem',
                                                lineHeight: 1.6,
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {reasonText}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GENERIC FICHA EVALUATIVA MODAL (Dedicated Self-Contained Ficha in Comandancia) */}
            {selectedFichaAgent && (
                <div className="mac-modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem'
                }}>
                    <div className="mac-modal-content" style={{
                        maxWidth: '750px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        background: 'rgba(15, 23, 42, 0.96)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '24px',
                        padding: '2rem',
                        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(25px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '14px',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    fontWeight: 900,
                                    color: '#4ade80'
                                }}>
                                    {selectedFichaAgent.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#6ee7b7', letterSpacing: '0.08em' }}>
                                        Ficha Evaluativa de Comandancia
                                    </div>
                                    <h2 style={{ margin: '2px 0 0 0', fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc' }}>
                                        {selectedFichaAgent.name}
                                    </h2>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedFichaAgent(null)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#94a3b8',
                                    borderRadius: '10px',
                                    width: '34px',
                                    height: '34px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Semáforo & Metrics Card */}
                        <div style={{
                            background: selectedFichaAgent.status === 'positive'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : selectedFichaAgent.status === 'negative'
                                    ? 'rgba(239, 68, 68, 0.12)'
                                    : 'rgba(30, 41, 59, 0.5)',
                            border: `1px solid ${selectedFichaAgent.status === 'positive' ? 'rgba(16, 185, 129, 0.35)' : selectedFichaAgent.status === 'negative' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '16px',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.8rem' }}>
                                        {selectedFichaAgent.status === 'positive' ? '🟢' : selectedFichaAgent.status === 'negative' ? '🔴' : '⚪'}
                                    </span>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                            Dictamen de Semáforo
                                        </div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                            {selectedFichaAgent.status === 'positive'
                                                ? 'Desempeño Favorable'
                                                : selectedFichaAgent.status === 'negative'
                                                    ? 'Atención Requerida (Desfavorable)'
                                                    : 'Neutral / Sin Desviación Significativa'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '10px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    textAlign: 'right'
                                }}>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Balance Neto</div>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 900,
                                        color: selectedFichaAgent.netScore >= 0 ? '#4ade80' : '#f87171'
                                    }}>
                                        {selectedFichaAgent.netScore > 0 ? `+${selectedFichaAgent.netScore}` : selectedFichaAgent.netScore}
                                    </div>
                                </div>
                            </div>

                            {/* Metric Badges */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                                <div style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '10px', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#86efac', fontWeight: 800 }}>POSITIVOS</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4ade80' }}>{selectedFichaAgent.positivesReceived}</div>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#fca5a5', fontWeight: 800 }}>NEGATIVOS</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f87171' }}>{selectedFichaAgent.negativesReceived}</div>
                                </div>
                                <div style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#fde047', fontWeight: 800 }}>MIXTOS</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#facc15' }}>{selectedFichaAgent.mixedReceived}</div>
                                </div>
                                <div style={{ background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 800 }}>TOTAL RECIBIDOS</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9' }}>{selectedFichaAgent.receivedTotal}</div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Tabs: Feedbacks Recibidos vs Feedbacks Emitidos */}
                        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                            <button
                                type="button"
                                onClick={() => setModalFichaTab('received')}
                                style={{
                                    background: modalFichaTab === 'received' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    border: modalFichaTab === 'received' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                    color: modalFichaTab === 'received' ? '#6ee7b7' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.4rem 0.9rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Informes Recibidos ({selectedFichaAgent.feedbacksReceived.length})
                            </button>

                            <button
                                type="button"
                                onClick={() => setModalFichaTab('submitted')}
                                style={{
                                    background: modalFichaTab === 'submitted' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    border: modalFichaTab === 'submitted' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                    color: modalFichaTab === 'submitted' ? '#6ee7b7' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.4rem 0.9rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Informes Emitidos ({selectedFichaAgent.feedbacksSubmitted.length})
                            </button>
                        </div>

                        {/* Feedbacks List inside Modal */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                            {modalFichaTab === 'received' ? (
                                selectedFichaAgent.feedbacksReceived.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                        No hay informes de feedback recibidos para este agente.
                                    </div>
                                ) : (
                                    selectedFichaAgent.feedbacksReceived.map(fb => {
                                        const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                        const isP = fbType === 'positivo';
                                        const isN = fbType === 'negativo';
                                        const badgeBg = isP ? 'rgba(34, 197, 94, 0.15)' : isN ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                        const badgeColor = isP ? '#4ade80' : isN ? '#f87171' : '#facc15';
                                        const badgeBorder = isP ? 'rgba(34, 197, 94, 0.3)' : isN ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)';
                                        const authorName = fb.author_name || fb.author_agent_name || 'Anónimo';
                                        const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                        const reason = fb.motivo || fb.reason || '';

                                        return (
                                            <div
                                                key={fb.id}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '12px',
                                                    padding: '0.85rem 1rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: badgeBg,
                                                            color: badgeColor,
                                                            border: `1px solid ${badgeBorder}`,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {isP ? '🌟 Positivo' : isN ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                        </span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                            Por: {authorName}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        {dateStr}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                                    {reason}
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            ) : (
                                selectedFichaAgent.feedbacksSubmitted.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                        Este oficial no ha emitido ningún feedback a otros compañeros.
                                    </div>
                                ) : (
                                    selectedFichaAgent.feedbacksSubmitted.map(fb => {
                                        const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                        const isP = fbType === 'positivo';
                                        const isN = fbType === 'negativo';
                                        const badgeBg = isP ? 'rgba(34, 197, 94, 0.15)' : isN ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                        const badgeColor = isP ? '#4ade80' : isN ? '#f87171' : '#facc15';
                                        const targetName = fb.target_name || fb.target_agent_name || 'Agente';
                                        const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                        const reason = fb.motivo || fb.reason || '';

                                        return (
                                            <div
                                                key={fb.id}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '12px',
                                                    padding: '0.85rem 1rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: badgeBg,
                                                            color: badgeColor
                                                        }}>
                                                            {isP ? '🌟 Positivo' : isN ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                        </span>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                            Hacia: {targetName}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        {dateStr}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                                    {reason}
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    window.open(`/feedback?target=${encodeURIComponent(selectedFichaAgent.name)}`, '_blank');
                                }}
                                style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    color: '#6ee7b7',
                                    borderRadius: '10px',
                                    padding: '0.5rem 1.1rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                ✍️ Rellenar Nuevo Feedback para {selectedFichaAgent.name} ↗
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedFichaAgent(null)}
                                className="login-button btn-secondary"
                                style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}
                            >
                                Cerrar Ficha
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

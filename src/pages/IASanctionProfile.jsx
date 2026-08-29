import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    DEFAULT_SANCTION_DURATIONS, 
    fetchSanctionDurations, 
    calculateSanctionExpiry 
} from '../utils/sanctionConfig';
import '../index.css';

function IASanctionProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { language } = useLanguage();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [durations, setDurations] = useState(DEFAULT_SANCTION_DURATIONS);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [cases, setCases] = useState([]); // For dropdown
    const [formData, setFormData] = useState({
        type: 'Media', // Default
        description: '',
        date: new Date().toISOString().split('T')[0],
        caseId: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const loadedDurations = await fetchSanctionDurations();
            setDurations(loadedDurations);

            const { data, error } = await supabase.rpc('get_ia_subject_details', { p_subject_id: id });
            if (error) throw error;
            setProfileData(data);
        } catch (err) {
            console.error('Error loading profile:', err);
            alert(language === 'es' ? 'Error al cargar el perfil del oficial.' : 'Failed to load officer profile.');
        } finally {
            setLoading(false);
        }
    };

    const loadCasesForDropdown = async () => {
        const { data, error } = await supabase.rpc('get_ia_cases_dropdown');
        if (error) {
            console.error('Error loading cases:', error);
        }
        setCases(data || []);
    };

    const openForCreate = () => {
        setModalMode('create');
        setEditingId(null);
        setFormData({ type: 'Media', description: '', date: new Date().toISOString().split('T')[0], caseId: '' });
        loadCasesForDropdown();
        setShowModal(true);
    };

    const openForEdit = (item) => {
        setModalMode('update');
        setEditingId(item.id);
        setFormData({
            type: item.type || 'Media',
            description: item.description || '',
            date: item.date,
            caseId: item.case_id || ''
        });
        loadCasesForDropdown();
        setShowModal(true);
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('manage_ia_sanction', {
                p_action: modalMode,
                p_id: editingId,
                p_subject_id: id,
                p_type: formData.type,
                p_description: formData.description,
                p_date: formData.date,
                p_case_id: formData.caseId || null
            });
            if (error) throw error;

            setShowModal(false);
            loadData();
        } catch (err) {
            alert((language === 'es' ? 'Error: ' : 'Error: ') + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (sanctionId) => {
        if (!window.confirm(language === 'es' 
            ? '¿Está seguro de que desea eliminar este registro de sanción?' 
            : 'Are you sure you want to delete this sanction record?')) return;

        try {
            const { error } = await supabase.rpc('manage_ia_sanction', {
                p_action: 'delete',
                p_id: sanctionId
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert((language === 'es' ? 'Error al eliminar: ' : 'Error deleting: ') + err.message);
        }
    };

    const severityConfig = {
        Grave: {
            color: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.15)',
            border: 'rgba(239, 68, 68, 0.35)',
            label: language === 'es' ? 'Falta Grave' : 'Major Offense',
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            )
        },
        Media: {
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.15)',
            border: 'rgba(245, 158, 11, 0.35)',
            label: language === 'es' ? 'Falta Media' : 'Moderate Offense',
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            )
        },
        Leve: {
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.15)',
            border: 'rgba(56, 189, 248, 0.35)',
            label: language === 'es' ? 'Falta Leve' : 'Minor Offense',
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
            )
        }
    };

    // Calculate processed sanctions with expiration info
    const enrichedSanctions = useMemo(() => {
        if (!profileData?.sanctions) return [];
        return profileData.sanctions.map(s => {
            const expiry = calculateSanctionExpiry(s, durations);
            return {
                ...s,
                expiry
            };
        });
    }, [profileData, durations]);

    const activeSanctions = useMemo(() => {
        return enrichedSanctions.filter(s => s.expiry.isActive);
    }, [enrichedSanctions]);

    const hasActive = activeSanctions.length > 0;
    const latestActiveExpiry = useMemo(() => {
        if (!hasActive) return null;
        const sorted = [...activeSanctions].sort((a, b) => b.expiry.expiryDate.getTime() - a.expiry.expiryDate.getTime());
        return sorted[0].expiry;
    }, [activeSanctions, hasActive]);

    if (loading) {
        return (
            <div className="mac-dashboard-container">
                <div className="mac-doc-empty" style={{ marginTop: '4rem' }}>
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#ef4444' }}></span>
                    <span>{language === 'es' ? 'Cargando expediente del oficial y vigencias...' : 'Loading officer profile and expiration data...'}</span>
                </div>
            </div>
        );
    }

    if (!profileData) {
        return (
            <div className="mac-dashboard-container">
                <div className="mac-doc-empty" style={{ marginTop: '4rem', color: '#f87171' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span>{language === 'es' ? 'Perfil del oficial no encontrado.' : 'Officer profile not found.'}</span>
                    <button
                        onClick={() => navigate('/internal-affairs/sanctions')}
                        className="mac-btn mac-btn-secondary"
                        style={{ marginTop: '1rem' }}
                    >
                        {language === 'es' ? 'Volver al Registro' : 'Back to Registry'}
                    </button>
                </div>
            </div>
        );
    }

    const { profile } = profileData;
    const initials = `${(profile.nombre?.[0] || '').toUpperCase()}${(profile.apellido?.[0] || '').toUpperCase()}` || 'OF';

    const countGrave = enrichedSanctions.filter(s => s.type === 'Grave').length;
    const countMedia = enrichedSanctions.filter(s => s.type === 'Media').length;
    const countLeve = enrichedSanctions.filter(s => s.type === 'Leve').length;

    const countGraveActive = activeSanctions.filter(s => s.type === 'Grave').length;
    const countMediaActive = activeSanctions.filter(s => s.type === 'Media').length;
    const countLeveActive = activeSanctions.filter(s => s.type === 'Leve').length;

    return (
        <div className="mac-dashboard-container" style={{ maxWidth: '1100px' }}>
            {/* Top Navigation & Breadcrumb */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <button
                    onClick={() => navigate('/internal-affairs/sanctions')}
                    style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '20px',
                        padding: '0.35rem 0.85rem',
                        color: '#cbd5e1',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = '#cbd5e1';
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                    <span>{language === 'es' ? 'Volver al Registro' : 'Back to Registry'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>
                    <span className="mac-status-dot" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></span>
                    <span>{language === 'es' ? 'Expediente Disciplinario Oficial' : 'Official Disciplinary Record'}</span>
                </div>
            </div>

            {/* Officer Hero Banner Card */}
            <div
                className="mac-widget-card"
                style={{
                    marginBottom: '2rem',
                    padding: '1.75rem 2rem',
                    background: hasActive
                        ? 'linear-gradient(135deg, rgba(38, 20, 27, 0.85), rgba(15, 23, 42, 0.95))'
                        : 'linear-gradient(135deg, rgba(30, 27, 38, 0.8), rgba(15, 23, 42, 0.9))',
                    border: `1px solid ${hasActive ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255, 255, 255, 0.1)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '2rem',
                    flexWrap: 'wrap'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Big Avatar Ring */}
                    <div style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '24px',
                        background: hasActive
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.35))'
                            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 78, 59, 0.3))',
                        border: `2px solid ${hasActive ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.4)'}`,
                        color: hasActive ? '#f87171' : '#34d399',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        boxShadow: `0 8px 24px ${hasActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0,0,0,0.2)'}`,
                        flexShrink: 0
                    }}>
                        {initials}
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: 'var(--accent-gold, #f59e0b)',
                                padding: '0.2rem 0.65rem',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                fontWeight: 700
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                                <span>{language === 'es' ? 'Placa: ' : 'Badge: '}#{profile.no_placa}</span>
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>•</span>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {language === 'es' ? 'Sujeto Registrado' : 'Registered Subject'}
                            </span>
                        </div>

                        <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {profile.nombre} {profile.apellido}
                        </h1>

                        {/* Active Sanction Expiration Alert in Header */}
                        {hasActive ? (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0.35rem 0.85rem',
                                background: 'rgba(239, 68, 68, 0.18)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                color: '#fca5a5'
                            }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></span>
                                <span>
                                    <strong>{activeSanctions.length} {language === 'es' ? 'FALTA(S) ACTIVA(S)' : 'ACTIVE FAULT(S)'}</strong> — {language === 'es' ? 'Caduca el' : 'Expires on'} <strong style={{ color: '#ffffff' }}>{latestActiveExpiry.expiryDateFormatted}</strong> ({latestActiveExpiry.daysRemaining === 0 ? (language === 'es' ? 'Caduca hoy' : 'Expires today') : `${latestActiveExpiry.daysRemaining} ${language === 'es' ? 'días restantes' : 'days left'}`})
                                </span>
                            </div>
                        ) : (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0.35rem 0.85rem',
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                color: '#34d399'
                            }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                                <span>
                                    <strong>{language === 'es' ? 'Sin Sanciones Activas' : 'No Active Sanctions'}</strong> {enrichedSanctions.length > 0 && `(${language === 'es' ? 'Historial archivado' : 'Archived records'})`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={openForCreate}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.65rem 1.25rem',
                            fontSize: '0.88rem',
                            background: 'rgba(239, 68, 68, 0.25)',
                            borderColor: 'rgba(239, 68, 68, 0.5)',
                            color: '#f87171'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>{language === 'es' ? 'Registrar Sanción' : 'Register Sanction'}</span>
                    </button>
                </div>
            </div>

            {/* Severity Breakdown Widgets */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                {/* Active Sanctions Widget */}
                <div className="mac-widget-card" style={{
                    padding: '1rem 1.25rem',
                    borderLeft: `4px solid ${hasActive ? '#ef4444' : '#10b981'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: hasActive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.05)'
                }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hasActive ? '#f87171' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Faltas Activas' : 'Active Sanctions'}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                            {activeSanctions.length}
                        </div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: hasActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasActive ? '#ef4444' : '#34d399'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                </div>

                {/* Graves */}
                <div className="mac-widget-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Faltas Graves' : 'Major Offenses'}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                            {countGrave}
                            {countGraveActive > 0 && (
                                <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 700, marginLeft: '6px' }}>
                                    ({countGraveActive} {language === 'es' ? 'activas' : 'act.'})
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                </div>

                {/* Medias */}
                <div className="mac-widget-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Faltas Medias' : 'Moderate Offenses'}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                            {countMedia}
                            {countMediaActive > 0 && (
                                <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, marginLeft: '6px' }}>
                                    ({countMediaActive} {language === 'es' ? 'activas' : 'act.'})
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                </div>

                {/* Leves */}
                <div className="mac-widget-card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Faltas Leves' : 'Minor Offenses'}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                            {countLeve}
                            {countLeveActive > 0 && (
                                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, marginLeft: '6px' }}>
                                    ({countLeveActive} {language === 'es' ? 'activas' : 'act.'})
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Sanctions History Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>{language === 'es' ? 'Historial Disciplinario' : 'Disciplinary History Timeline'}</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {enrichedSanctions.length} {language === 'es' ? 'registros en expediente' : 'records logged'}
                </span>
            </div>

            <div className="sanctions-timeline">
                {enrichedSanctions.length === 0 ? (
                    <div className="mac-doc-empty">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{language === 'es' ? 'No se encontraron expedientes disciplinarios para este oficial.' : 'No disciplinary records found for this officer.'}</span>
                    </div>
                ) : (
                    enrichedSanctions.map((item, index) => {
                        const cfg = severityConfig[item.type] || severityConfig.Media;
                        const isLast = index === enrichedSanctions.length - 1;
                        const isSanctionActive = item.expiry.isActive;

                        return (
                            <div
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    gap: '1.5rem',
                                    marginBottom: '1.5rem',
                                    position: 'relative'
                                }}
                            >
                                {/* Timeline Node & Line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px' }}>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: isSanctionActive ? cfg.color : '#64748b',
                                        border: '3px solid rgba(15, 23, 42, 0.9)',
                                        boxShadow: isSanctionActive ? `0 0 12px ${cfg.color}` : 'none',
                                        marginTop: '1.25rem',
                                        zIndex: 2,
                                        flexShrink: 0
                                    }}></div>
                                    {!isLast && (
                                        <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.1)', minHeight: '60px' }}></div>
                                    )}
                                </div>

                                {/* Apple Style Card */}
                                <div
                                    className="mac-widget-card"
                                    style={{
                                        flex: 1,
                                        padding: '1.35rem 1.5rem',
                                        borderLeft: `4px solid ${isSanctionActive ? cfg.color : '#64748b'}`,
                                        position: 'relative',
                                        ...(isSanctionActive ? {
                                            background: 'linear-gradient(135deg, rgba(30, 20, 28, 0.6), rgba(15, 23, 42, 0.8))'
                                        } : {})
                                    }}
                                >
                                    {/* Header Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            {/* Severity Tag */}
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontWeight: 700,
                                                color: cfg.color,
                                                background: cfg.bg,
                                                border: `1px solid ${cfg.border}`,
                                                borderRadius: '12px',
                                                padding: '0.25rem 0.75rem',
                                                fontSize: '0.78rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                {cfg.icon}
                                                <span>{cfg.label}</span>
                                            </span>

                                            {/* Active / Expired Pill */}
                                            {isSanctionActive ? (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    border: '1px solid rgba(239, 68, 68, 0.45)',
                                                    color: '#fca5a5',
                                                    borderRadius: '12px',
                                                    padding: '0.25rem 0.65rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }}></span>
                                                    <span>
                                                        {language === 'es' ? 'ACTIVA • Caduca: ' : 'ACTIVE • Expires: '}
                                                        <strong style={{ color: '#ffffff' }}>{item.expiry.expiryDateFormatted}</strong>
                                                        {` (${item.expiry.daysRemaining === 0 ? (language === 'es' ? 'Hoy' : 'Today') : `${item.expiry.daysRemaining}d`})`}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    background: 'rgba(100, 116, 139, 0.15)',
                                                    border: '1px solid rgba(100, 116, 139, 0.3)',
                                                    color: '#94a3b8',
                                                    borderRadius: '12px',
                                                    padding: '0.25rem 0.65rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600
                                                }}>
                                                    <span>
                                                        {language === 'es' ? 'CADUCADA' : 'EXPIRED'} ({language === 'es' ? 'Venció el ' : 'Expired '}{item.expiry.expiryDateFormatted})
                                                    </span>
                                                </span>
                                            )}

                                            {/* Imposition Date */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                                </svg>
                                                <span>{language === 'es' ? 'Imposición: ' : 'Issued: '}<strong>{item.date}</strong></span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <button
                                                onClick={() => openForEdit(item)}
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    color: '#cbd5e1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                                    e.currentTarget.style.color = '#ffffff';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                                    e.currentTarget.style.color = '#cbd5e1';
                                                }}
                                                title={language === 'es' ? 'Editar Sanción' : 'Edit Sanction'}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9"/>
                                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(239, 68, 68, 0.08)',
                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                    color: '#f87171',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                                                }}
                                                title={language === 'es' ? 'Eliminar Sanción' : 'Delete Sanction'}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Description Container */}
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '10px',
                                        padding: '0.9rem 1.1rem',
                                        color: '#e2e8f0',
                                        fontSize: '0.88rem',
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-line',
                                        marginBottom: item.case_id ? '0.85rem' : '0.5rem'
                                    }}>
                                        {item.description || (language === 'es' ? "Sin descripción detallada registrada." : "No detailed description logged.")}
                                    </div>

                                    {/* Linked Case Preview */}
                                    {item.case_id && (
                                        <div
                                            onClick={() => navigate(`/internal-affairs/cases/${item.case_id}`)}
                                            style={{
                                                marginTop: '0.65rem',
                                                padding: '0.75rem 1rem',
                                                background: 'rgba(245, 158, 11, 0.08)',
                                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
                                                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
                                                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(245, 158, 11, 0.15)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--accent-gold, #f59e0b)'
                                                }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {language === 'es' ? 'Caso de Asuntos Internos Vinculado' : 'Linked IA Investigation Case'}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold, #f59e0b)', fontWeight: 700 }}>
                                                        IA-#{String(item.case_number || '').padStart(3, '0')} {item.case_title}
                                                    </div>
                                                </div>
                                            </div>

                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold, #f59e0b)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12"/>
                                                <polyline points="12 5 19 12 12 19"/>
                                            </svg>
                                        </div>
                                    )}

                                    {/* Footer / Registered by */}
                                    <div style={{
                                        marginTop: '0.75rem',
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.75rem',
                                        color: '#94a3b8'
                                    }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        <span>{language === 'es' ? 'Registrado por:' : 'Logged by:'}</span>
                                        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{item.created_by_name || 'Agente de IA'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Apple / macOS Modal for Create & Edit Sanctions */}
            {showModal && (
                <div className="mac-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="mac-modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <span className="mac-dot red" onClick={() => setShowModal(false)}></span>
                                <span className="mac-dot yellow"></span>
                                <span className="mac-dot green"></span>
                            </div>
                            <h3 className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                                <span>{modalMode === 'create' ? (language === 'es' ? 'Registrar Sanción Disciplinaria' : 'Register Disciplinary Sanction') : (language === 'es' ? 'Editar Sanción' : 'Edit Sanction')}</span>
                            </h3>
                            <button className="mac-modal-close" onClick={() => setShowModal(false)}>&times;</button>
                        </div>

                        <form onSubmit={handleAction}>
                            <div className="mac-modal-body" style={{ gap: '1rem' }}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Tipo de Sanción / Gravedad' : 'Sanction Severity Type'}</label>
                                    <select
                                        className="mac-form-input mac-form-select"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="Leve">{language === 'es' ? `Falta Leve (${durations.Leve} días de vigencia)` : `Minor Offense (${durations.Leve} days active)`}</option>
                                        <option value="Media">{language === 'es' ? `Falta Media (${durations.Media} días de vigencia)` : `Moderate Offense (${durations.Media} days active)`}</option>
                                        <option value="Grave">{language === 'es' ? `Falta Grave (${durations.Grave} días de vigencia)` : `Major Offense (${durations.Grave} days active)`}</option>
                                    </select>
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Fecha de Imposición de la Falta' : 'Sanction Imposition Date'}</label>
                                    <input
                                        type="date"
                                        className="mac-form-input"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                        {language === 'es' 
                                            ? `La falta caducará automáticamente tras los días configurados desde esta fecha.` 
                                            : `The fault will expire automatically after the configured days from this date.`}
                                    </span>
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Descripción y Motivo de la Sanción' : 'Description & Reason'}</label>
                                    <textarea
                                        className="mac-form-input"
                                        rows="4"
                                        placeholder={language === 'es' ? 'Detalla los motivos de la sanción disciplinaria aplicada...' : 'Detail the disciplinary reasons for this sanction...'}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Vincular a Caso de Asuntos Internos (Opcional)' : 'Link to IA Case (Optional)'}</label>
                                    <select
                                        className="mac-form-input mac-form-select"
                                        value={formData.caseId}
                                        onChange={e => setFormData({ ...formData, caseId: e.target.value })}
                                    >
                                        <option value="">{language === 'es' ? '-- Sin Caso Vinculado --' : '-- No Linked Case --'}</option>
                                        {cases.map(c => (
                                            <option key={c.id} value={c.id}>
                                                IA-#{String(c.case_number).padStart(3, '0')} {c.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mac-modal-actions" style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
                                <button
                                    type="button"
                                    className="mac-btn mac-btn-secondary"
                                    onClick={() => setShowModal(false)}
                                    disabled={submitting}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    style={{ background: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#f87171' }}
                                    disabled={submitting}
                                >
                                    {submitting 
                                        ? (language === 'es' ? 'Guardando...' : 'Saving...') 
                                        : (language === 'es' ? 'Confirmar Registro' : 'Confirm Sanction')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IASanctionProfile;


import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import '../index.css';

function DOJSanctionProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [cases, setCases] = useState([]);
    const [formData, setFormData] = useState({
        type: 'Media',
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
            const { data, error } = await supabase.rpc('get_doj_subject_details', { p_subject_id: id });
            if (error) throw error;
            setProfileData(data);
        } catch (err) {
            console.error('Error loading profile:', err);
            alert(language === 'es' ? 'Error al cargar el perfil' : 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    const loadCasesForDropdown = async () => {
        const { data, error } = await supabase.rpc('get_doj_cases_dropdown');
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
            type: item.type,
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
            const { error } = await supabase.rpc('manage_doj_sanction', {
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
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (sanctionId) => {
        const confirmMsg = language === 'es' 
            ? '¿Estás seguro de que deseas eliminar este registro disciplinario?' 
            : 'Are you sure you want to delete this sanction record?';
        if (!window.confirm(confirmMsg)) return;
        try {
            const { error } = await supabase.rpc('manage_doj_sanction', {
                p_action: 'delete',
                p_id: sanctionId
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const getTypeColor = (type) => {
        if (type === 'Grave') return { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.35)', dot: '#ef4444' };
        if (type === 'Media') return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b' };
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.35)', dot: '#3b82f6' };
    };

    if (loading) {
        return (
            <div className="mac-dashboard-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    {language === 'es' ? 'Cargando expediente...' : 'Loading Disciplinary Profile...'}
                </div>
            </div>
        );
    }

    if (!profileData || !profileData.profile) {
        return (
            <div className="mac-dashboard-container" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ color: '#ef4444', fontSize: '1.2rem', fontWeight: 600 }}>
                    {language === 'es' ? 'Expediente no encontrado' : 'Disciplinary Profile Not Found'}
                </div>
                <button className="mac-btn mac-btn-secondary" onClick={() => navigate('/doj/sanctions')}>
                    ← {language === 'es' ? 'Volver a Sanciones' : 'Back to Sanctions'}
                </button>
            </div>
        );
    }

    const { profile, sanctions = [] } = profileData;
    const graveCount = sanctions.filter(s => s.type === 'Grave').length;
    const mediaCount = sanctions.filter(s => s.type === 'Media').length;
    const leveCount = sanctions.filter(s => s.type === 'Leve').length;

    return (
        <div className="mac-dashboard-container">
            {/* Top Navigation */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => navigate('/doj/sanctions')}
                    className="mac-btn mac-btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    {language === 'es' ? 'Volver al Registro' : 'Back to Registry'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>DOJ INTERNAL AFFAIRS //</span>
                    <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                        CONFIDENTIAL
                    </span>
                </div>
            </div>

            {/* Officer Profile Hero Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '2rem',
                marginBottom: '2rem',
                boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '2rem',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', minWidth: '300px' }}>
                    <div style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.08) 100%)',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        fontWeight: 800,
                        border: '2px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 0 24px rgba(239, 68, 68, 0.2)',
                        letterSpacing: '1px'
                    }}>
                        {(profile.nombre?.[0] || 'A')}{(profile.apellido?.[0] || 'O')}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                {profile.nombre} {profile.apellido}
                            </h1>
                            <span style={{
                                padding: '0.2rem 0.65rem',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                background: 'rgba(217, 119, 6, 0.15)',
                                color: '#fbbf24',
                                border: '1px solid rgba(217, 119, 6, 0.3)'
                            }}>
                                #{profile.no_placa}
                            </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>{language === 'es' ? 'Oficial Sujeto a Asuntos Internos' : 'Officer Subject to Internal Affairs'}</span>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                            <span>ID: <code style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{id.slice(0, 8)}</code></span>
                        </div>
                    </div>
                </div>

                {/* Metric Summary Strip & Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            textAlign: 'center',
                            minWidth: '70px'
                        }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>{graveCount}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {language === 'es' ? 'Graves' : 'Severe'}
                            </div>
                        </div>

                        <div style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            textAlign: 'center',
                            minWidth: '70px'
                        }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{mediaCount}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {language === 'es' ? 'Medias' : 'Moderate'}
                            </div>
                        </div>

                        <div style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            textAlign: 'center',
                            minWidth: '70px'
                        }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6' }}>{leveCount}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {language === 'es' ? 'Leves' : 'Minor'}
                            </div>
                        </div>
                    </div>

                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={openForCreate}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.65rem 1.25rem',
                            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
                        }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        {language === 'es' ? 'Registrar Sanción' : 'Register Sanction'}
                    </button>
                </div>
            </div>

            {/* History Section Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: '#ef4444' }} />
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                        {language === 'es' ? 'Historial Disciplinario' : 'Disciplinary History'}
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        ({sanctions.length} {language === 'es' ? 'registros' : 'records'})
                    </span>
                </div>
            </div>

            {/* Sanctions Timeline */}
            <div style={{ position: 'relative' }}>
                {sanctions.length === 0 ? (
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '14px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        padding: '3.5rem 2rem',
                        textAlign: 'center',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>🛡️</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                            {language === 'es' ? 'Sin registros de sanciones' : 'No disciplinary records found'}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>
                            {language === 'es' ? 'Este oficial no posee sanciones activas registradas en el sistema del DOJ.' : 'This officer has no active disciplinary records in the DOJ system.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {sanctions.map((item) => {
                            const colors = getTypeColor(item.type);
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        gap: '1.25rem',
                                        position: 'relative'
                                    }}
                                >
                                    {/* Timeline Node & Line */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px', paddingTop: '0.25rem' }}>
                                        <div style={{
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '50%',
                                            background: colors.dot,
                                            boxShadow: `0 0 12px ${colors.dot}`,
                                            border: '2px solid rgba(15, 23, 42, 0.9)'
                                        }} />
                                        <div style={{
                                            width: '2px',
                                            flex: 1,
                                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0.03))',
                                            margin: '0.35rem 0'
                                        }} />
                                    </div>

                                    {/* Sanction Card */}
                                    <div style={{
                                        flex: 1,
                                        background: 'rgba(30, 41, 59, 0.45)',
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.07)',
                                        padding: '1.25rem 1.5rem',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    letterSpacing: '0.5px',
                                                    textTransform: 'uppercase',
                                                    background: colors.bg,
                                                    color: colors.text,
                                                    border: `1px solid ${colors.border}`
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.dot }} />
                                                    {language === 'es' ? `Falta ${item.type}` : `${item.type} Fault`}
                                                </span>

                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                    {item.date}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <button
                                                    onClick={() => openForEdit(item)}
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                                    title={language === 'es' ? 'Editar' : 'Edit'}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                    {language === 'es' ? 'Editar' : 'Edit'}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="mac-btn mac-btn-danger"
                                                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                                    title={language === 'es' ? 'Eliminar' : 'Delete'}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                    {language === 'es' ? 'Eliminar' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '1rem' }}>
                                            {item.description || (
                                                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                    {language === 'es' ? 'Sin descripción proporcionada.' : 'No description provided.'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Linked DOJ Case Pill */}
                                        {item.case_id && (
                                            <div
                                                onClick={() => navigate(`/doj/cases/${item.case_id}`)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.6rem',
                                                    padding: '0.55rem 0.9rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255, 255, 255, 0.04)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    marginBottom: '0.75rem'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                                </svg>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        {language === 'es' ? 'Caso Vinculado' : 'Related Case'}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>
                                                        DOJ-#{String(item.case_number || 0).padStart(3, '0')} {item.case_title}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer Metadata */}
                                        <div style={{
                                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                            paddingTop: '0.75rem',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-secondary)',
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            <span>{language === 'es' ? 'Registrado por:' : 'Registered by:'}</span>
                                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>{item.created_by_name || 'DOJ Staff'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal for Creating / Editing Sanction */}
            {showModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div
                        className="mac-modal-container"
                        style={{ maxWidth: '520px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Traffic light bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                            <div className="mac-status-dot" style={{ background: '#ff5f56' }} onClick={() => setShowModal(false)} />
                            <div className="mac-status-dot" style={{ background: '#ffbd2e' }} />
                            <div className="mac-status-dot" style={{ background: '#27c93f' }} />
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                                {modalMode === 'create'
                                    ? (language === 'es' ? 'REGISTRAR SANCIÓN' : 'REGISTER SANCTION')
                                    : (language === 'es' ? 'EDITAR SANCIÓN' : 'EDIT SANCTION')}
                            </span>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                                {modalMode === 'create'
                                    ? (language === 'es' ? 'Nueva Sanción Disciplinaria' : 'New Disciplinary Sanction')
                                    : (language === 'es' ? 'Editar Sanción' : 'Edit Sanction')}
                            </h3>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {profile.nombre} {profile.apellido} (#{profile.no_placa})
                            </p>
                        </div>

                        <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Tipo de Falta / Gravedad' : 'Sanction Type / Severity'}
                                </label>
                                <select
                                    className="mac-form-select"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="Leve">{language === 'es' ? 'Leve (Amonestación / Menor)' : 'Leve (Minor / Warning)'}</option>
                                    <option value="Media">{language === 'es' ? 'Media (Suspensión / Moderada)' : 'Media (Moderate / Suspension)'}</option>
                                    <option value="Grave">{language === 'es' ? 'Grave (Expulsión / Severa)' : 'Grave (Severe / Expulsion)'}</option>
                                </select>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Fecha de los Hechos' : 'Date of Incident'}
                                </label>
                                <input
                                    type="date"
                                    className="mac-form-input"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Descripción y Motivo de la Sanción' : 'Description / Reason'}
                                </label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows="4"
                                    placeholder={language === 'es' ? 'Detalles sobre los hechos, artículos vulnerados...' : 'Provide details of the violation...'}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Vincular a Expediente / Caso DOJ (Opcional)' : 'Link to DOJ Case (Optional)'}
                                </label>
                                <select
                                    className="mac-form-select"
                                    value={formData.caseId}
                                    onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
                                >
                                    <option value="">{language === 'es' ? '-- Sin caso vinculado --' : '-- No Linked Case --'}</option>
                                    {cases.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            DOJ-#{String(c.case_number).padStart(3, '0')} {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
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
                                    disabled={submitting}
                                    style={{
                                        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)'
                                    }}
                                >
                                    {submitting
                                        ? (language === 'es' ? 'Guardando...' : 'Saving...')
                                        : (language === 'es' ? 'Guardar Sanción' : 'Confirm Sanction')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJSanctionProfile;

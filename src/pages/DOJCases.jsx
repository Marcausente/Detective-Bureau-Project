import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function DOJCases() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Open'); // Open, Closed, Archived
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form State
    const [newCase, setNewCase] = useState({
        title: '',
        location: '',
        occurred_at: '',
        description: '',
        assignments: [], // Array of user IDs
        initialImage: null
    });
    const [users, setUsers] = useState([]); // DOJ Users for assignment
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchCases();
        fetchDOJUsers();
    }, [filter]);

    const fetchCases = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_doj_cases', { p_status_filter: filter });
        if (error) console.error('Error fetching DOJ cases:', error);
        else setCases(data || []);
        setLoading(false);
    };

    const fetchDOJUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, divisions, profile_image').order('rango');
        if (data) {
            const dojUsers = data.filter(u =>
                (u.divisions && u.divisions.includes('DOJ')) ||
                u.rol === 'Administrador'
            );
            setUsers(dojUsers);
        }
    };

    const handleCreateCase = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const timestamp = new Date(newCase.occurred_at).toISOString();

            let imageUrl = newCase.initialImage;
            if (imageUrl && imageUrl.startsWith('data:')) {
                imageUrl = await uploadImageToStorage(imageUrl, 'cases');
            }

            const { data: newId, error } = await supabase.rpc('create_doj_case', {
                p_title: newCase.title,
                p_location: newCase.location,
                p_occurred_at: timestamp,
                p_description: newCase.description,
                p_assigned_ids: newCase.assignments,
                p_image: imageUrl
            });

            if (error) throw error;

            setShowCreateModal(false);
            setNewCase({
                title: '',
                location: '',
                occurred_at: '',
                description: '',
                assignments: [],
                initialImage: null
            });
            navigate(`/doj/cases/${newId}`);

        } catch (err) {
            alert('Error creating DOJ case: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleAssignment = (userId) => {
        const current = newCase.assignments;
        if (current.includes(userId)) {
            setNewCase({ ...newCase, assignments: current.filter(id => id !== userId) });
        } else {
            setNewCase({ ...newCase, assignments: [...current, userId] });
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                setNewCase({ ...newCase, initialImage: dataUrl });
            };
        };
    };

    const statusColors = {
        'Open': '#10b981',     // Emerald
        'Closed': '#ef4444',   // Rose / Red
        'Archived': '#64748b'  // Slate Gray
    };

    const filteredCases = cases.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const caseNumStr = String(c.case_number).padStart(3, '0');
        return c.title?.toLowerCase().includes(q) ||
            c.location?.toLowerCase().includes(q) ||
            caseNumStr.includes(q);
    });

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Command Header Banner */}
            <div 
                className="mac-command-banner" 
                style={{ 
                    marginBottom: '1.75rem', 
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <img
                        src="/logowebp/doj-logo.webp"
                        alt="DOJ Logo"
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 14px rgba(37, 99, 235, 0.45))' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/logowebp/dojlogo.webp";
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/doj')}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '20px',
                                    padding: '0.2rem 0.65rem',
                                    color: '#cbd5e1',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al DOJ' : 'Back to DOJ Hub'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'Department of Justice • Fiscalía' : 'Department of Justice • Inquiries'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'INVESTIGACIONES JUDICIALES' : 'LEGAL INVESTIGATIONS'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div className="mac-input-with-icon" style={{ width: '260px' }}>
                        <span className="mac-input-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="mac-form-input has-icon"
                            style={{ padding: '0.55rem 0.85rem 0.55rem 2.6rem', fontSize: '0.85rem' }}
                            placeholder={language === 'es' ? "Buscar sumario, delito o lugar..." : "Search case or location..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* New Case Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={() => setShowCreateModal(true)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            padding: '0.6rem 1.1rem', 
                            background: 'rgba(59, 130, 246, 0.25)', 
                            border: '1px solid rgba(59, 130, 246, 0.5)', 
                            color: '#93c5fd',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nueva Investigación' : 'New Investigation'}</span>
                    </button>
                </div>
            </div>

            {/* Filter Pill Tabs */}
            <div className="mac-doc-tabs" style={{ marginBottom: '1.75rem' }}>
                {[
                    {
                        id: 'Open',
                        label: language === 'es' ? 'Sumarios Abiertos' : 'Open Cases',
                        color: '#10b981',
                        icon: (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        )
                    },
                    {
                        id: 'Closed',
                        label: language === 'es' ? 'Sumarios Cerrados' : 'Closed Cases',
                        color: '#ef4444',
                        icon: (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        )
                    },
                    {
                        id: 'Archived',
                        label: language === 'es' ? 'Sumarios Archivados' : 'Archived Cases',
                        color: '#64748b',
                        icon: (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="21 8 21 21 3 21 3 8"/>
                                <rect x="1" y="3" width="22" height="5"/>
                                <line x1="10" y1="12" x2="14" y2="12"/>
                            </svg>
                        )
                    }
                ].map(status => (
                    <button
                        key={status.id}
                        className={`mac-doc-tab ${filter === status.id ? 'active' : ''}`}
                        onClick={() => setFilter(status.id)}
                        style={{
                            borderColor: filter === status.id ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
                            backgroundColor: filter === status.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            color: filter === status.id ? '#ffffff' : '#94a3b8'
                        }}
                    >
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                    </button>
                ))}
            </div>

            {/* Cases List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#3b82f6', width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginBottom: '0.5rem' }}></span>
                    <div>{language === 'es' ? 'Cargando investigaciones del Departamento de Justicia...' : 'Loading DOJ investigations...'}</div>
                </div>
            ) : filteredCases.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        {language === 'es' ? `No se encontraron investigaciones en estado ${filter}` : `No ${filter.toLowerCase()} investigations found.`}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Utilice el botón superior para abrir un nuevo sumario' : 'Use the button above to register a new investigation'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                    {filteredCases.map(c => {
                        const statusColor = statusColors[c.status] || '#64748b';
                        return (
                            <div
                                key={c.id}
                                onClick={() => navigate(`/doj/cases/${c.id}`)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderLeft: `4px solid ${statusColor}`,
                                    borderRadius: '18px',
                                    padding: '1.4rem 1.6rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = `0 14px 30px -8px rgba(0,0,0,0.5), 0 0 0 1px ${statusColor}40`;
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                                    e.currentTarget.style.borderLeftColor = statusColor;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderLeftColor = statusColor;
                                }}
                            >
                                {/* Top Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ 
                                        fontFamily: 'monospace', 
                                        fontWeight: 700, 
                                        fontSize: '0.8rem', 
                                        color: '#60a5fa',
                                        background: 'rgba(59, 130, 246, 0.12)',
                                        border: '1px solid rgba(59, 130, 246, 0.25)',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '8px'
                                    }}>
                                        DOJ-CASE #{String(c.case_number).padStart(3, '0')}
                                    </span>
                                    
                                    <span style={{ 
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        fontSize: '0.75rem', 
                                        fontWeight: 700, 
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        color: statusColor,
                                        background: `${statusColor}18`,
                                        border: `1px solid ${statusColor}35`,
                                        padding: '0.2rem 0.65rem',
                                        borderRadius: '9999px'
                                    }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }}></span>
                                        {c.status}
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 style={{ 
                                    margin: '0 0 0.75rem 0', 
                                    color: '#ffffff', 
                                    fontSize: '1.15rem',
                                    fontWeight: 700,
                                    lineHeight: 1.35
                                }}>
                                    {c.title}
                                </h3>

                                {/* Meta: Location & Date */}
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '1rem', 
                                    fontSize: '0.82rem', 
                                    color: '#94a3b8',
                                    marginBottom: '1.25rem',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span>{c.location || 'Localización N/A'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        <span>{new Date(c.occurred_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Footer: Agents Stack */}
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    marginTop: 'auto', 
                                    paddingTop: '0.9rem', 
                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {c.assigned_avatars && c.assigned_avatars.length > 0 ? (
                                            <div style={{ display: 'flex', marginRight: '0.65rem' }}>
                                                {c.assigned_avatars.map((img, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={img || '/logowebp/anon.webp'}
                                                        alt="Agent"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            marginLeft: idx > 0 ? '-8px' : '0',
                                                            border: '2px solid #0f172a',
                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                                {language === 'es' ? 'Sin fiscales asignados' : 'No agents assigned'}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                                            {language === 'es' ? 'Fiscales / Agentes' : 'Assigned Agents'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <span>{language === 'es' ? 'Ver sumario' : 'View File'}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="9 18 15 12 9 6"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* macOS Modal: Create New Investigation */}
            {showCreateModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowCreateModal(false)}>
                    <div 
                        className="mac-modal-container" 
                        style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Traffic light bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                DOJ • INQUIRY FILE
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                            {language === 'es' ? 'Apertura de Sumario / Investigación Judicial' : 'Open New Legal Investigation'}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.5rem 0' }}>
                            {language === 'es' 
                                ? 'Complete los antecedentes preliminares del expediente para dar curso legal a la causa.'
                                : 'Complete initial inquiry data to register the legal case in the Department of Justice.'}
                        </p>

                        <form onSubmit={handleCreateCase}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Título del Sumario / Asunto *' : 'Investigation Title *'}
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    required
                                    value={newCase.title}
                                    onChange={e => setNewCase({ ...newCase, title: e.target.value })}
                                    placeholder={language === 'es' ? "Ej: Causa Penal 418 — Investigación Fraude Fiscal" : "e.g. Legal Inquest 418 - Wire Fraud Inquiry"}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">
                                        {language === 'es' ? 'Lugar de los Hechos / Jurisdicción *' : 'Location / Jurisdiction *'}
                                    </label>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        required
                                        value={newCase.location}
                                        onChange={e => setNewCase({ ...newCase, location: e.target.value })}
                                        placeholder={language === 'es' ? "Ej: Juzgado de Distrito / Downtown" : "e.g. Downtown Federal Court"}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">
                                        {language === 'es' ? 'Fecha y Hora del Suceso *' : 'Date & Time *'}
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="mac-form-input"
                                        required
                                        value={newCase.occurred_at}
                                        onChange={e => setNewCase({ ...newCase, occurred_at: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Relato de Hechos / Resumen Inicial *' : 'Initial Report / Brief *'}
                                </label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows="4"
                                    required
                                    value={newCase.description}
                                    onChange={e => setNewCase({ ...newCase, description: e.target.value })}
                                    placeholder={language === 'es' ? "Detalle los antecedentes preliminares de la investigación..." : "Describe the preliminary case facts..."}
                                />
                            </div>

                            {/* Evidence Photo */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Fotografía de la Escena / Evidencia Inicial (Opcional)' : 'Initial Scene / Evidence Photo (Optional)'}
                                </label>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.6rem',
                                    padding: '0.85rem',
                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    color: '#cbd5e1',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                    <span>{newCase.initialImage ? (language === 'es' ? 'Foto Seleccionada (Clic para cambiar)' : 'Photo Selected (Click to change)') : (language === 'es' ? 'Subir Fotografía' : 'Upload Scene Photo')}</span>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                </label>

                                {newCase.initialImage && (
                                    <div style={{ position: 'relative', marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                                        <img src={newCase.initialImage} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} alt="Evidence" />
                                        <button
                                            type="button"
                                            onClick={() => setNewCase({ ...newCase, initialImage: null })}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(239, 68, 68, 0.9)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '24px',
                                                height: '24px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Assign DOJ Agents */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Asignar Fiscales / Agentes del DOJ' : 'Assign DOJ Agents'}
                                </label>
                                <div style={{
                                    maxHeight: '160px',
                                    overflowY: 'auto',
                                    background: 'rgba(0, 0, 0, 0.35)',
                                    padding: '0.6rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem'
                                }}>
                                    {users.length === 0 ? (
                                        <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '0.75rem', textAlign: 'center' }}>
                                            {language === 'es' ? 'No se encontraron agentes del DOJ.' : 'No DOJ agents found.'}
                                        </div>
                                    ) : (
                                        users.map(u => {
                                            const isSelected = newCase.assignments.includes(u.id);
                                            return (
                                                <div
                                                    key={u.id}
                                                    onClick={() => toggleAssignment(u.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        padding: '0.45rem 0.65rem',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                                                    />
                                                    <img
                                                        src={u.profile_image || '/logowebp/anon.webp'}
                                                        alt=""
                                                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                    <span style={{ fontSize: '0.86rem', color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: isSelected ? 600 : 400 }}>
                                                        {u.rango} {u.nombre} {u.apellido}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.6rem 1.2rem',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#ffffff',
                                        padding: '0.6rem 1.4rem',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)'
                                    }}
                                >
                                    {submitting ? (language === 'es' ? 'Creando...' : 'Creating...') : (language === 'es' ? 'Abrir Causa' : 'Create Case')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJCases;

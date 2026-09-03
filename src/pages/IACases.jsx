import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, processHtmlImages } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function IACases() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
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
        initialImage: null,
        hiddenUserIds: [],
        isHiddenFromAll: false
    });
    const [users, setUsers] = useState([]); // IA Users for assignment
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
                setCurrentUser(data);
            }
        };
        getCurrentUser();
        fetchCases();
        fetchIAUsers();
    }, [filter]);

    const canPinCase = () => {
        if (!currentUser) return true; // Default allow for click attempt if user is in IA dashboard
        const r = (currentUser.rol || '').toLowerCase().trim();
        const rank = (currentUser.rango || '').toLowerCase().trim();
        const isHighCommand = ['administrador', 'coordinador', 'comisionado', 'director', 'fundador'].includes(r) ||
                              ['sheriff', 'undersheriff', 'assistant sheriff', 'division chief', 'comandante', 'capitan', 'teniente'].includes(rank) ||
                              r.includes('admin');
        const isIA = (currentUser.divisions && currentUser.divisions.includes('Internal Affairs')) ||
                     (currentUser.subdivisions && currentUser.subdivisions.includes('Internal Affairs')) ||
                     rank === 'internal affairs agent';
        return isHighCommand || isIA;
    };

    const handleTogglePin = async (e, caseId, currentPinned) => {
        e.stopPropagation();
        if (!canPinCase()) {
            alert('No tienes permisos suficientes para fijar casos de Asuntos Internos.');
            return;
        }

        const newPinnedState = !currentPinned;

        // Optimistic UI update
        setCases(prev => {
            const updated = prev.map(c => c.id === caseId ? { ...c, is_pinned: newPinnedState } : c);
            return updated.sort((a, b) => {
                const pinA = a.id === caseId ? newPinnedState : !!a.is_pinned;
                const pinB = b.id === caseId ? newPinnedState : !!b.is_pinned;
                if (pinA !== pinB) return pinB ? 1 : -1;
                return (b.case_number || 0) - (a.case_number || 0);
            });
        });

        try {
            let { error } = await supabase.rpc('toggle_ia_case_pin', { p_case_id: caseId, p_pinned: newPinnedState });
            if (error) {
                // Fallback direct table update if RPC is missing or fails
                const fallbackRes = await supabase.from('ia_cases').update({ is_pinned: newPinnedState }).eq('id', caseId);
                if (fallbackRes.error) throw fallbackRes.error;
            }
            fetchCases();
        } catch (err) {
            console.error('Error toggling pin:', err);
            alert('Error al fijar caso: ' + (err.message || JSON.stringify(err)));
            fetchCases(); // rollback
        }
    };

    const fetchCases = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_ia_cases', { p_status_filter: filter });
        if (error) console.error('Error fetching IA cases:', error);
        else setCases(data || []);
        setLoading(false);
    };

    const fetchIAUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, divisions, profile_image').order('rango');
        if (data) {
            const iaUsers = data.filter(u =>
                (u.divisions && u.divisions.includes('Internal Affairs')) ||
                u.rol === 'Administrador'
            );
            setUsers(iaUsers);
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

            const finalDescription = await processHtmlImages(newCase.description, 'cases');

            const { data: newId, error } = await supabase.rpc('create_ia_case', {
                p_title: newCase.title,
                p_location: newCase.location,
                p_occurred_at: timestamp,
                p_description: finalDescription,
                p_assigned_ids: newCase.assignments,
                p_image: imageUrl,
                p_hidden_user_ids: newCase.hiddenUserIds || [],
                p_is_hidden_from_all: newCase.isHiddenFromAll || false
            });

            if (error) throw error;

            setShowCreateModal(false);
            navigate(`/internal-affairs/cases/${newId}`);

        } catch (err) {
            alert('Error creating IA case: ' + err.message);
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

    const toggleHiddenUser = (userId) => {
        const current = newCase.hiddenUserIds || [];
        if (current.includes(userId)) {
            setNewCase({ ...newCase, hiddenUserIds: current.filter(id => id !== userId) });
        } else {
            setNewCase({ ...newCase, hiddenUserIds: [...current, userId] });
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
        'Open': '#10b981',     // Green
        'Closed': '#ef4444',   // Red
        'Archived': '#64748b'  // Slate
    };

    // Filter cases based on search query
    const filteredCases = cases.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const caseNumStr = String(c.case_number).padStart(3, '0');
        return c.title.toLowerCase().includes(q) ||
            c.location.toLowerCase().includes(q) ||
            caseNumStr.includes(q);
    });

    return (
        <div className="mac-dashboard-container">
            {/* Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '1.75rem', background: 'linear-gradient(135deg, rgba(30, 27, 38, 0.75), rgba(15, 23, 42, 0.85))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img
                        src={isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp"}
                        alt="IA Logo"
                        style={{ height: '64px', width: 'auto', filter: `drop-shadow(0 4px 14px ${isLSSD ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.45)'})` }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/internal-affairs')}
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
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al Panel' : 'Back to Dashboard'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'División de Asuntos Internos' : 'Internal Affairs Division'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'INVESTIGACIONES INTERNAS' : 'INTERNAL INVESTIGATIONS'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                            placeholder={language === 'es' ? "Buscar caso de IA..." : "Search IA case..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* New Case Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={() => setShowCreateModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.45)', color: '#f87171' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nueva Investigación' : 'New IA Investigation'}</span>
                    </button>
                </div>
            </div>

            {/* Filter Pill Tabs */}
            <div className="mac-doc-tabs" style={{ marginBottom: '1.75rem' }}>
                {[
                    {
                        id: 'Open',
                        label: language === 'es' ? 'Casos Abiertos' : 'Open Cases',
                        color: '#10b981',
                        icon: (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        )
                    },
                    {
                        id: 'Closed',
                        label: language === 'es' ? 'Casos Cerrados' : 'Closed Cases',
                        color: '#ef4444',
                        icon: (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        )
                    },
                    {
                        id: 'Archived',
                        label: language === 'es' ? 'Casos Archivados' : 'Archived Cases',
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
                    >
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                    </button>
                ))}
            </div>

            {/* Case List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#ef4444' }}></span>
                    <span>{language === 'es' ? 'Cargando investigaciones de Asuntos Internos...' : 'Loading IA investigations...'}</span>
                </div>
            ) : filteredCases.length === 0 ? (
                <div className="mac-doc-empty">
                    <span>
                        {language === 'es'
                            ? `No se encontraron investigaciones registradas con estado "${filter === 'Open' ? 'abiertas' : filter === 'Closed' ? 'cerradas' : 'archivadas'}".`
                            : `No ${filter.toLowerCase()} investigations found.`
                        }
                    </span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                    {filteredCases.map(c => {
                        const isPinned = c.is_pinned;
                        const statusColor = statusColors[c.status] || '#64748b';
                        const statusText = c.status === 'Open' ? (language === 'es' ? 'Abierto' : 'Open') : c.status === 'Closed' ? (language === 'es' ? 'Cerrado' : 'Closed') : (language === 'es' ? 'Archivado' : 'Archived');
                        const isRestricted = c.is_hidden_from_all || (c.hidden_user_ids && c.hidden_user_ids.length > 0);

                        return (
                            <div
                                key={c.id}
                                className="mac-widget-card"
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                                    borderLeft: `4px solid ${statusColor}`,
                                    padding: '1.35rem'
                                }}
                                onClick={() => navigate(`/internal-affairs/cases/${c.id}`)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.08em',
                                            color: '#cbd5e1',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '6px'
                                        }}>
                                            {language === 'es' ? 'CASO-IA #' : 'IA-CASE #'}{String(c.case_number).padStart(3, '0')}
                                        </span>

                                        {isPinned && (
                                            <span style={{ fontSize: '0.85rem', color: '#fbbf24' }} title={language === 'es' ? "Caso Anclado" : "Pinned Case"}>
                                                📌
                                            </span>
                                        )}

                                        {isRestricted && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '6px',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#f87171',
                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                                </svg>
                                                <span>{language === 'es' ? 'Restringido' : 'Restricted'}</span>
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {canPinCase() && (
                                            <button 
                                                onClick={(e) => handleTogglePin(e, c.id, c.is_pinned)}
                                                style={{ 
                                                    background: 'transparent', 
                                                    border: 'none', 
                                                    cursor: 'pointer', 
                                                    fontSize: '0.95rem', 
                                                    padding: '0.2rem',
                                                    opacity: isPinned ? 1 : 0.35, 
                                                    transition: 'opacity 0.2s ease, transform 0.15s ease' 
                                                }}
                                                title={isPinned ? (language === 'es' ? "Desanclar Caso" : "Unpin Case") : (language === 'es' ? "Anclar Caso" : "Pin Case")}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = isPinned ? '1' : '0.35'}
                                            >
                                                📌
                                            </button>
                                        )}

                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.06em',
                                            color: statusColor,
                                            textTransform: 'uppercase',
                                            background: `${statusColor}18`,
                                            border: `1px solid ${statusColor}33`,
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '9999px'
                                        }}>
                                            {statusText}
                                        </span>
                                    </div>
                                </div>

                                {/* Case Title */}
                                <h3 style={{
                                    margin: '0.25rem 0 0.6rem 0',
                                    fontSize: '1.15rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    lineHeight: '1.35',
                                    letterSpacing: '-0.01em'
                                }}>
                                    {c.title}
                                </h3>

                                {/* Location & Timestamp */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                    fontSize: '0.82rem',
                                    color: '#94a3b8',
                                    marginBottom: '1.1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {c.location || (language === 'es' ? 'Ubicación no especificada' : 'Unspecified location')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        <span>{new Date(c.occurred_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                {/* Assigned Agents Footer Stack */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginTop: 'auto',
                                    paddingTop: '0.85rem',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {c.assigned_avatars && c.assigned_avatars.length > 0 ? (
                                            c.assigned_avatars.map((img, idx) => (
                                                <img
                                                    key={idx}
                                                    src={img || '/logowebp/anon.webp'}
                                                    alt="Agente"
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        marginLeft: idx > 0 ? '-8px' : '0',
                                                        border: '2px solid rgba(16, 22, 36, 0.9)',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                                                    }}
                                                />
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                                                {language === 'es' ? 'Sin asignar' : 'Unassigned'}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
                                        {language === 'es' ? 'Agentes Asignados' : 'Agents Assigned'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* macOS Glass Create Case Modal */}
            {showCreateModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '660px' }}>
                        {/* macOS Modal Header */}
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowCreateModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                {language === 'es' ? 'Abrir Nueva Investigación de IA' : 'Open New IA Investigation'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        {/* Modal Body */}
                        <div className="mac-modal-body">
                            <form onSubmit={handleCreateCase}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Título del Caso' : 'Case Title'}</label>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        required
                                        value={newCase.title}
                                        onChange={e => setNewCase({ ...newCase, title: e.target.value })}
                                        placeholder={language === 'es' ? 'Ej: Mala conducta de oficial - 418' : 'e.g. Officer Misconduct - 418'}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="mac-form-group">
                                        <label className="mac-form-label">{language === 'es' ? 'Ubicación' : 'Location'}</label>
                                        <input
                                            type="text"
                                            className="mac-form-input"
                                            required
                                            value={newCase.location}
                                            onChange={e => setNewCase({ ...newCase, location: e.target.value })}
                                            placeholder={language === 'es' ? 'Ej. Comisaría Mission Row' : 'e.g. Mission Row PD'}
                                        />
                                    </div>
                                    <div className="mac-form-group">
                                        <label className="mac-form-label">{language === 'es' ? 'Fecha y Hora' : 'Date & Time'}</label>
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
                                    <label className="mac-form-label">{language === 'es' ? 'Reporte Inicial / Descripción' : 'Initial Report / Description'}</label>
                                    <textarea
                                        className="eval-textarea"
                                        rows="4"
                                        required
                                        value={newCase.description}
                                        onChange={e => setNewCase({ ...newCase, description: e.target.value })}
                                        placeholder={language === 'es' ? 'Describa los detalles del incidente...' : 'Describe the incident details...'}
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', padding: '0.65rem' }}
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Foto de Evidencia / Escena (Opcional)' : 'Evidence / Scene Photo (Optional)'}</label>
                                    <label className="mac-btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', textAlign: 'center', height: '44px', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                            <circle cx="12" cy="13" r="4"/>
                                        </svg>
                                        <span>{language === 'es' ? 'Añadir Foto' : 'Add Photo'}</span>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                    </label>
                                    {newCase.initialImage && (
                                        <div style={{ position: 'relative', marginTop: '10px' }}>
                                            <img src={newCase.initialImage} style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} alt="Evidence" />
                                            <button type="button" onClick={() => setNewCase({ ...newCase, initialImage: null })} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
                                        </div>
                                    )}
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Asignar Agentes de IA' : 'Assign IA Agents'}</label>
                                    <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)' }}>
                                        {users.length === 0 ? (
                                            <div style={{ color: '#94a3b8', padding: '0.5rem', fontSize: '0.82rem' }}>
                                                {language === 'es' ? 'No se encontraron agentes de Asuntos Internos.' : 'No Internal Affairs agents found.'}
                                            </div>
                                        ) : (
                                            users.map(u => (
                                                <div
                                                    key={u.id}
                                                    onClick={() => toggleAssignment(u.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '0.4rem 0.6rem',
                                                        cursor: 'pointer',
                                                        background: newCase.assignments.includes(u.id) ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                                                        marginBottom: '2px',
                                                        borderRadius: '6px'
                                                    }}
                                                >
                                                    <input type="checkbox" checked={newCase.assignments.includes(u.id)} readOnly style={{ marginRight: '10px' }} />
                                                    <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' }} />
                                                    <span style={{ fontSize: '0.85rem', color: '#fff' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Restricted Visibility Section */}
                                <div style={{ border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.06)', marginTop: '1.25rem' }}>
                                    <label className="mac-form-label" style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.6rem' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                        </svg>
                                        <span>{language === 'es' ? 'Ocultar Caso / Restringir Visibilidad' : 'Hide Case / Restrict Visibility'}</span>
                                    </label>
                                    <div style={{ marginBottom: '0.6rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem', color: '#f87171' }}>
                                            <input
                                                type="checkbox"
                                                checked={newCase.isHiddenFromAll}
                                                onChange={e => setNewCase({ ...newCase, isHiddenFromAll: e.target.checked })}
                                                style={{ marginRight: '10px' }}
                                            />
                                            {language === 'es' ? 'Ocultar caso a todos los miembros de IA' : 'Hide case from all IA members'}
                                        </label>
                                    </div>
                                    {!newCase.isHiddenFromAll && (
                                        <>
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                                                {language === 'es' ? 'Ocultar caso a miembros específicos:' : 'Hide case from specific members:'}
                                            </span>
                                            <div style={{ maxHeight: '110px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                {users.length === 0 ? (
                                                    <div style={{ color: '#94a3b8', padding: '0.4rem', fontSize: '0.8rem' }}>{language === 'es' ? 'No hay agentes.' : 'No agents.'}</div>
                                                ) : (
                                                    users.map(u => (
                                                        <div
                                                            key={u.id}
                                                            onClick={() => toggleHiddenUser(u.id)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                padding: '0.35rem 0.5rem',
                                                                cursor: 'pointer',
                                                                background: newCase.hiddenUserIds.includes(u.id) ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                                                marginBottom: '2px',
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            <input type="checkbox" checked={newCase.hiddenUserIds.includes(u.id)} readOnly style={{ marginRight: '8px' }} />
                                                            <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' }} />
                                                            <span style={{ fontSize: '0.82rem', color: '#fff' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                    <button type="button" className="mac-btn btn-secondary" onClick={() => setShowCreateModal(false)} style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}>
                                        {language === 'es' ? 'Cancelar' : 'Cancel'}
                                    </button>
                                    <button type="submit" className="mac-btn mac-btn-primary" disabled={submitting} style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#f87171' }}>
                                        {submitting ? (language === 'es' ? 'Creando...' : 'Creating...') : (language === 'es' ? 'Crear Caso' : 'Create Case')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IACases;

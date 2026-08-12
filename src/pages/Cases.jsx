import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, processHtmlImages } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Cases() {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Open'); // Open, Closed, Archived
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { isLSSD } = useTheme();
    const { t } = useLanguage();

    // Form State
    const [newCase, setNewCase] = useState({
        title: '',
        location: '',
        occurred_at: '',
        description: '',
        assignments: [], // Array of user IDs
        initialImage: null
    });
    const [users, setUsers] = useState([]); // For assignment selection
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('users').select('rol').eq('id', user.id).single();
                setCurrentUser(data);
            }
        };
        getCurrentUser();
        fetchCases();
        fetchUsers();
    }, [filter]);

    const fetchCases = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_cases', { p_status_filter: filter });
        if (error) console.error('Error fetching cases:', error);
        else setCases(data || []);
        setLoading(false);
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango').order('rango');
        setUsers(data || []);
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

            const { data: newId, error } = await supabase.rpc('create_new_case', {
                p_title: newCase.title,
                p_location: newCase.location,
                p_occurred_at: timestamp,
                p_description: finalDescription,
                p_assigned_ids: newCase.assignments,
                p_image: imageUrl
            });

            if (error) throw error;

            setShowCreateModal(false);
            navigate(`/cases/${newId}`);

        } catch (err) {
            alert('Error creating case: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const canPinCase = () => {
        if (!currentUser?.rol) return false;
        const r = currentUser.rol.toLowerCase().trim();
        return r === 'administrador' || r === 'coordinador' || r === 'comisionado' || r.includes('detective') || r.includes('admin');
    };

    const handleTogglePin = async (e, caseId, currentPinned) => {
        e.stopPropagation();
        if (!canPinCase()) return;
        try {
            const { error } = await supabase.rpc('toggle_case_pin', { p_case_id: caseId, p_pinned: !currentPinned });
            if (error) throw error;
            fetchCases();
        } catch (err) {
            console.error('Error toggling pin:', err);
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

    // Filter cases based on search query
    const filteredCases = cases.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const caseNumStr = String(c.case_number).padStart(3, '0');
        return c.title.toLowerCase().includes(q) || 
               c.location.toLowerCase().includes(q) || 
               caseNumStr.includes(q);
    });

    const openCount = cases.filter(c => c.status === 'Open').length;

    return (
        <div className="mac-dashboard-container">
            {/* Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img 
                        src={isLSSD ? "/logowebp/Generalcrimes.webp" : "/logowebp/mcd.webp"} 
                        alt="Division Logo" 
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))' }} 
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="mac-status-dot"></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {isLSSD ? "Sheriff Criminal Unit Bureau" : "Detective Bureau Division"}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {isLSSD ? "GENERAL CRIMES DIVISION" : "MAJOR CRIMES DIVISION"}
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
                            placeholder="Buscar expediente o caso..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* New Case Button */}
                    {currentUser && !['Ayudante', 'Invitado', 'Externo'].includes(currentUser.rol) && (
                        <button 
                            className="mac-btn mac-btn-primary" 
                            onClick={() => setShowCreateModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>{t('openNewCaseBtn') || 'Abrir Nuevo Caso'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Pill Tabs */}
            <div className="mac-doc-tabs" style={{ marginBottom: '1.75rem' }}>
                {[
                    { id: 'Open', label: t('openCasesBtn') || 'Casos Abiertos', icon: '🟢' },
                    { id: 'Closed', label: t('closedCasesBtn') || 'Casos Cerrados', icon: '🔴' },
                    { id: 'Archived', label: t('archivedCasesBtn') || 'Casos Archivados', icon: '📁' }
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

            {/* Cases List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite' }}></span>
                    <span>{t('loadingCases') || 'Cargando expedientes policiales...'}</span>
                </div>
            ) : filteredCases.length === 0 ? (
                <div className="mac-doc-empty">
                    <span>{t('noCasesFound')?.replace('{status}', filter.toLowerCase()) || `No se encontraron casos registrados con estado "${filter.toLowerCase()}".`}</span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                    {filteredCases.map(c => {
                        const isPinned = c.is_pinned;
                        const statusColor = c.status === 'Open' ? '#10b981' : c.status === 'Closed' ? '#ef4444' : '#64748b';
                        const statusText = c.status === 'Open' ? 'Abierto' : c.status === 'Closed' ? 'Cerrado' : 'Archivado';

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
                                onClick={() => navigate(`/cases/${c.id}`)}
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
                                            {t('caseHash') || 'CASO-'}#{String(c.case_number).padStart(3, '0')}
                                        </span>

                                        {isPinned && (
                                            <span style={{ fontSize: '0.85rem', color: '#fbbf24' }} title="Caso Anclado">
                                                📌
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
                                                title={isPinned ? "Desanclar Caso" : "Anclar Caso"}
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
                                        <span>📍</span>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {c.location || 'Ubicación no especificada'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>📅</span>
                                        <span>{new Date(c.occurred_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                {/* Assigned Detectives Footer Stack */}
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
                                                    alt="Detective"
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
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>Sin asignar</span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
                                        {t('assigned') || 'Agentes Asignados'}
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
                    <div className="mac-modal-card" style={{ maxWidth: '640px' }}>
                        {/* macOS Modal Header */}
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowCreateModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                {t('openNewCaseFile') || 'Apertura de Nuevo Expediente Policial'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        {/* Modal Body */}
                        <div className="mac-modal-body">
                            <form onSubmit={handleCreateCase}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">{t('caseTitle') || 'Título del Caso'}</label>
                                    <input 
                                        type="text" 
                                        className="mac-form-input" 
                                        required
                                        value={newCase.title} 
                                        onChange={e => setNewCase({ ...newCase, title: e.target.value })} 
                                        placeholder={t('caseTitlePlaceholder') || 'Ej: Homicidio en Rockford Hills'} 
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="mac-form-group">
                                        <label className="mac-form-label">{t('location') || 'Lugar de los Hechos'}</label>
                                        <input 
                                            type="text" 
                                            className="mac-form-input" 
                                            required
                                            value={newCase.location} 
                                            onChange={e => setNewCase({ ...newCase, location: e.target.value })} 
                                            placeholder={t('locationPlaceholder') || 'Ej: Vinewood Blvd / Alta St'} 
                                        />
                                    </div>
                                    <div className="mac-form-group">
                                        <label className="mac-form-label">{t('dateTime') || 'Fecha y Hora'}</label>
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
                                    <label className="mac-form-label">{t('initialReport') || 'Informe Inicial / Detalles'}</label>
                                    <textarea 
                                        className="mac-form-textarea" 
                                        rows="4" 
                                        required
                                        value={newCase.description} 
                                        onChange={e => setNewCase({ ...newCase, description: e.target.value })} 
                                        placeholder={t('initialReportPlaceholder') || 'Describe los hallazgos iniciales del incidente...'} 
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{t('evidencePhoto') || 'Fotografía de Evidencia Principal'}</label>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.85rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        color: '#cbd5e1',
                                        fontSize: '0.85rem',
                                        transition: 'border-color 0.2s ease, background 0.2s ease'
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                        <span>{t('addPhoto') || 'Adjuntar Fotografía / Escena'}</span>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                    </label>
                                    
                                    {newCase.initialImage && (
                                        <div style={{ position: 'relative', marginTop: '0.75rem' }}>
                                            <img 
                                                src={newCase.initialImage} 
                                                style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)' }} 
                                                alt="Evidence" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setNewCase({ ...newCase, initialImage: null })} 
                                                style={{ 
                                                    position: 'absolute', 
                                                    top: 8, 
                                                    right: 8, 
                                                    background: 'rgba(239, 68, 68, 0.9)', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '50%', 
                                                    width: '24px', 
                                                    height: '24px', 
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{t('assignDetectives') || 'Asignar Detectives Encargados'}</label>
                                    <div style={{ 
                                        maxHeight: '140px', 
                                        overflowY: 'auto', 
                                        background: 'rgba(0,0,0,0.4)', 
                                        padding: '0.5rem', 
                                        borderRadius: '12px', 
                                        border: '1px solid rgba(255,255,255,0.12)' 
                                    }}>
                                        {users.map(u => (
                                            <div 
                                                key={u.id}
                                                onClick={() => toggleAssignment(u.id)}
                                                style={{
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    padding: '0.45rem 0.6rem',
                                                    cursor: 'pointer', 
                                                    background: newCase.assignments.includes(u.id) ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                                    borderRadius: '8px',
                                                    marginBottom: '2px',
                                                    transition: 'background 0.15s ease'
                                                }}
                                            >
                                                <input type="checkbox" checked={newCase.assignments.includes(u.id)} readOnly style={{ marginRight: '10px' }} />
                                                <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' }} />
                                                <span style={{ fontSize: '0.85rem', color: '#ffffff' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mac-modal-actions">
                                    <button 
                                        type="button" 
                                        className="mac-btn mac-btn-secondary" 
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        {t('cancelBtn') || 'Cancelar'}
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="mac-btn mac-btn-primary" 
                                        disabled={submitting}
                                    >
                                        {submitting ? (t('creatingCase') || 'Ariendo Expediente...') : (t('createCaseFileBtn') || 'Aperturar Expediente')}
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

export default Cases;

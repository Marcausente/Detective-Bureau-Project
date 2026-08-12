import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, processHtmlImages } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { makeQuillModules, quillFormats } from '../utils/quillConfig';
import '../index.css';

// SwiftUI Vector SVG Icons
const IconMegaphone = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
);

const IconCalendar = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const IconPin = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14l-1.5-6H18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h.5L5 17z" />
    </svg>
);

const IconPlus = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const IconEdit = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const IconTrash = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const IconCheck = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconUsers = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const IconCamera = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

const IconClock = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();
    const { isLSSD } = useTheme();

    const [activeTab, setActiveTab] = useState('all');

    const [showModal, setShowModal] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', pinned: false, images: [] });
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);
    const [feedbackNotice, setFeedbackNotice] = useState(null);

    const [showEventModal, setShowEventModal] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '' });
    const [submittingEvent, setSubmittingEvent] = useState(false);

    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [allEvents, setAllEvents] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const [selectedEvent, setSelectedEvent] = useState(null);

    const quillModules = useMemo(() => makeQuillModules(), []);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                navigate('/');
                return;
            }

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (userError) throw userError;
            setUser(userData);

            await fetchAnnouncements();
            await fetchEvents(authUser.id);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnnouncements = async () => {
        const { data, error } = await supabase.rpc('get_announcements');
        if (error) {
            console.error('Error fetching announcements:', error);
        } else {
            setAnnouncements(data || []);
        }
    };

    const fetchEvents = async (userId) => {
        const { data, error } = await supabase.rpc('get_upcoming_events', { p_user_id: userId || user?.id });
        if (error) {
            console.error('Error fetching events:', error);
        } else {
            setEvents(data || []);
        }
    };

    const fetchAllMonthEvents = async () => {
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;

            const { data, error } = await supabase.rpc('get_all_month_events', {
                p_user_id: user?.id,
                p_year: year,
                p_month: month
            });

            if (error) throw error;
            setAllEvents(data || []);
        } catch (error) {
            console.error('Error fetching all events:', error);
        }
    };

    const handleOpenCalendar = () => {
        fetchAllMonthEvents();
        setShowCalendarModal(true);
    };

    const handleCloseCalendar = () => {
        setShowCalendarModal(false);
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleSaveAnnouncement = async (e) => {
        e.preventDefault();
        const isContentEmpty = newPost.content.replace(/<[^>]*>/g, '').trim() === '';
        if (!newPost.title.trim() || isContentEmpty) return;

        try {
            setSubmitting(true);
            setFeedbackNotice(null);

            let uploadedImages = [];
            let usedBucket = false;
            if (newPost.images && newPost.images.length > 0) {
                uploadedImages = await Promise.all(
                    newPost.images.map(async img => {
                        if (img && img.startsWith('data:')) {
                            usedBucket = true;
                            return await uploadImageToStorage(img, 'announcements');
                        }
                        return img;
                    })
                );
            }

            const finalContent = await processHtmlImages(newPost.content, 'announcements');
            if (finalContent !== newPost.content) usedBucket = true;

            if (editingId) {
                const { error } = await supabase.rpc('update_announcement', {
                    p_id: editingId,
                    p_title: newPost.title,
                    p_content: finalContent,
                    p_pinned: newPost.pinned,
                    p_images: uploadedImages
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('create_announcement', {
                    p_title: newPost.title,
                    p_content: finalContent,
                    p_pinned: newPost.pinned,
                    p_images: uploadedImages
                });
                if (error) throw error;
            }

            closeModal();
            fetchAnnouncements();
            setFeedbackNotice(usedBucket
                ? "Anuncio guardado con éxito (Imágenes subidas)"
                : "Anuncio guardado con éxito"
            );
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            alert('Error al guardar anuncio: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            for (const file of files) {
                const publicUrl = await uploadImageToStorage(file, 'announcements');
                if (publicUrl) {
                    setNewPost(prev => ({ ...prev, images: [...(prev.images || []), publicUrl] }));
                }
            }
            setFeedbackNotice("Imagen subida con éxito");
            setTimeout(() => setFeedbackNotice(null), 4000);
        } catch (err) {
            alert("Error al subir imagen: " + err.message);
        }
    };

    const handleEdit = (ann) => {
        setNewPost({ title: ann.title, content: ann.content, pinned: ann.pinned, images: ann.images || [] });
        setEditingId(ann.id);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setNewPost({ title: '', content: '', pinned: false, images: [] });
        setEditingId(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar este anuncio?")) return;
        try {
            const { error } = await supabase.rpc('delete_announcement', { p_id: id });
            if (error) throw error;
            fetchAnnouncements();
        } catch (err) {
            alert(err.message);
        }
    };

    const handlePin = async (id) => {
        try {
            const { error } = await supabase.rpc('toggle_pin_announcement', { p_id: id });
            if (error) throw error;
            fetchAnnouncements();
        } catch (err) {
            alert(err.message);
        }
    };

    const toggleAnnouncementReaction = async (announcementId) => {
        try {
            const { error } = await supabase.rpc('toggle_announcement_reaction', {
                p_announcement_id: announcementId
            });
            if (error) throw error;
            fetchAnnouncements();
        } catch (err) {
            console.error('Error toggling reaction:', err);
        }
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!newEvent.title.trim() || !newEvent.description.trim() || !newEvent.event_date) return;

        try {
            setSubmittingEvent(true);

            const { error } = await supabase.rpc('create_event', {
                p_title: newEvent.title,
                p_description: newEvent.description,
                p_event_date: new Date(newEvent.event_date).toISOString()
            });
            if (error) throw error;

            closeEventModal();
            fetchEvents();
        } catch (err) {
            alert('Error al guardar evento: ' + err.message);
        } finally {
            setSubmittingEvent(false);
        }
    };

    const closeEventModal = () => {
        setShowEventModal(false);
        setNewEvent({ title: '', description: '', event_date: '' });
    };

    const toggleEventRegistration = async (eventId) => {
        try {
            const { error } = await supabase.rpc('toggle_event_registration', {
                p_event_id: eventId,
                p_user_id: user.id
            });
            if (error) throw error;
            fetchEvents();
            if (showCalendarModal) {
                fetchAllMonthEvents();
            }
        } catch (err) {
            alert('Error de inscripción: ' + err.message);
        }
    };

    const canPost = user && ['Detective', 'Coordinador', 'Comisionado', 'Administrador'].includes(user.rol);
    const canPin = user && ['Coordinador', 'Comisionado', 'Administrador'].includes(user.rol);
    const canCreateEvent = user && ['Detective', 'Coordinador', 'Comisionado', 'Administrador', 'DOJ General', 'Fiscal General', 'Juez', 'Juez Supremo'].includes(user.rol);

    const pinnedCount = announcements.filter(a => a.pinned).length;
    const myCount = announcements.filter(a => a.cur_user_can_delete).length;

    const filteredAnnouncements = announcements.filter(ann => {
        if (activeTab === 'pinned') return ann.pinned;
        if (activeTab === 'mine') return ann.cur_user_can_delete;
        return true;
    });

    const currentDateFormatted = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="mac-status-dot"></div>
                    <span>Cargando sistema...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mac-dashboard-wrapper">
            {/* macOS Command Banner Header */}
            <div className="mac-command-banner">
                <div className="mac-header-info">
                    <div className="mac-greeting-row">
                        <div className="mac-status-dot" title="Sistema Conectado"></div>
                        <span className="mac-date-badge" style={{ textTransform: 'capitalize' }}>{currentDateFormatted}</span>
                    </div>
                    <h1 className="mac-title-text">
                        {isLSSD ? 'SHERIFF CRIMINAL UNIT' : 'DETECTIVE BUREAU'}
                    </h1>
                    <div className="mac-subtitle-text">
                        <span>Bienvenido, <strong>{user?.rango} {user?.apellido}</strong></span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>Placa #{user?.no_placa || 'N/A'}</span>
                    </div>
                </div>

                <div className="mac-action-bar">
                    {canPost && (
                        <button
                            className="mac-btn mac-btn-primary"
                            onClick={() => {
                                setEditingId(null);
                                setNewPost({ title: '', content: '', pinned: false, images: [] });
                                setShowModal(true);
                            }}
                        >
                            <IconPlus />
                            <span>{t('newAnnouncementBtn')}</span>
                        </button>
                    )}
                    {canCreateEvent && (
                        <button className="mac-btn mac-btn-secondary" onClick={() => setShowEventModal(true)}>
                            <IconCalendar />
                            <span>{t('createEventBtn')}</span>
                        </button>
                    )}
                    <button className="mac-btn mac-btn-secondary" onClick={handleOpenCalendar}>
                        <IconCalendar />
                        <span>{t('fullCalendar')}</span>
                    </button>
                </div>
            </div>

            {/* Feedback Notice Banner */}
            {feedbackNotice && (
                <div style={{
                    margin: '-1rem 0 1.5rem 0',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '16px',
                    background: 'rgba(52, 199, 89, 0.12)',
                    border: '1px solid rgba(52, 199, 89, 0.3)',
                    color: '#34c759',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <IconCheck />
                    <span>{feedbackNotice}</span>
                </div>
            )}

            {/* macOS 2 KPI Widgets Row */}
            <div className="mac-widgets-grid-2">
                <div className="mac-widget-card">
                    <div className="mac-widget-header">
                        <span className="mac-widget-label">Anuncios Activos</span>
                        <div className="mac-widget-icon-pill">
                            <IconMegaphone />
                        </div>
                    </div>
                    <div className="mac-widget-val">{announcements.length}</div>
                    <div className="mac-widget-sub">
                        <span>{pinnedCount} Fijados</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{myCount} Publicados por ti</span>
                    </div>
                </div>

                <div className="mac-widget-card">
                    <div className="mac-widget-header">
                        <span className="mac-widget-label">Próximos Eventos</span>
                        <div className="mac-widget-icon-pill">
                            <IconCalendar />
                        </div>
                    </div>
                    <div className="mac-widget-val">{events.length}</div>
                    <div className="mac-widget-sub">
                        {events.length > 0 ? (
                            <span>Próximo: {events[0].title}</span>
                        ) : (
                            <span>Sin eventos agendados</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Columns Grid */}
            <div className="mac-main-grid">
                {/* Left Column: Announcements Feed */}
                <div className="mac-feed-column">
                    <div className="mac-section-head">
                        <h2 className="mac-section-title">
                            <IconMegaphone />
                            <span>{t('announcementsTitle')}</span>
                        </h2>

                        {/* macOS Segmented Tab Control */}
                        <div className="mac-segmented-control">
                            <button
                                className={`mac-segment-btn ${activeTab === 'all' ? 'active' : ''}`}
                                onClick={() => setActiveTab('all')}
                            >
                                <span>Todos</span>
                                <span style={{ opacity: 0.6 }}>({announcements.length})</span>
                            </button>
                            <button
                                className={`mac-segment-btn ${activeTab === 'pinned' ? 'active' : ''}`}
                                onClick={() => setActiveTab('pinned')}
                            >
                                <IconPin />
                                <span>Fijados</span>
                                <span style={{ opacity: 0.6 }}>({pinnedCount})</span>
                            </button>
                            <button
                                className={`mac-segment-btn ${activeTab === 'mine' ? 'active' : ''}`}
                                onClick={() => setActiveTab('mine')}
                            >
                                <span>Mis Anuncios</span>
                                <span style={{ opacity: 0.6 }}>({myCount})</span>
                            </button>
                        </div>
                    </div>

                    <div className="mac-announcements-list">
                        {filteredAnnouncements.length === 0 ? (
                            <div className="mac-card-widget" style={{ textAlign: 'center', padding: '3.5rem 2rem', color: '#94a3b8' }}>
                                <div style={{ marginBottom: '1rem', opacity: 0.4, display: 'flex', justifyContent: 'center' }}>
                                    <IconMegaphone />
                                </div>
                                <h3 style={{ color: '#f1f5f9', fontWeight: '600' }}>Sin comunicados</h3>
                                <p style={{ fontSize: '0.88rem', marginTop: '0.5rem', color: '#64748b' }}>
                                    {activeTab === 'pinned' ? 'No hay comunicados fijados actualmente.' :
                                        activeTab === 'mine' ? 'Aún no has redactado ningún anuncio.' :
                                            t('noAnnouncements')}
                                </p>
                            </div>
                        ) : (
                            filteredAnnouncements.map(ann => (
                                <article key={ann.id} className={`mac-ann-card ${ann.pinned ? 'pinned' : ''}`}>
                                    {ann.pinned && (
                                        <div className="mac-pin-tag">
                                            <IconPin />
                                            <span>FIJADO</span>
                                        </div>
                                    )}

                                    <div className="mac-ann-header">
                                        <div className="mac-ann-title-box">
                                            <h3 className="mac-ann-title">{ann.title}</h3>
                                            <div className="mac-ann-author-pill">
                                                {ann.author_image ? (
                                                    <img src={ann.author_image} alt="" className="mac-ann-avatar" />
                                                ) : (
                                                    <div className="mac-ann-avatar-ph">{ann.author_name?.charAt(0)}</div>
                                                )}
                                                <span className="mac-ann-author-name">
                                                    {ann.author_rank} {ann.author_name}
                                                </span>
                                                <span className="mac-ann-date-text">
                                                    • {new Date(ann.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="ann-actions" style={{ display: 'flex', gap: '4px' }}>
                                            {canPin && (
                                                <button
                                                    onClick={() => handlePin(ann.id)}
                                                    className="icon-btn"
                                                    title={ann.pinned ? t('unpin') : t('pin')}
                                                    style={{ opacity: ann.pinned ? 1 : 0.6 }}
                                                >
                                                    <IconPin />
                                                </button>
                                            )}
                                            {ann.cur_user_can_delete && (
                                                <>
                                                    <button onClick={() => handleEdit(ann)} className="icon-btn edit" title="Editar">
                                                        <IconEdit />
                                                    </button>
                                                    <button onClick={() => handleDelete(ann.id)} className="icon-btn delete" title="Eliminar">
                                                        <IconTrash />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Announcement Body */}
                                    <div className="mac-ann-body quill-content" dangerouslySetInnerHTML={{ __html: ann.content }} />

                                    {/* Images Grid */}
                                    {ann.images && ann.images.length > 0 && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: ann.images.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                                            gap: '0.75rem',
                                            marginTop: '1rem',
                                            marginBottom: '1rem'
                                        }}>
                                            {ann.images.map((src, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => setExpandedImage(src)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        borderRadius: '14px',
                                                        overflow: 'hidden',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
                                                        maxHeight: '260px'
                                                    }}
                                                >
                                                    <img
                                                        src={src}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Card Footer with Reaction Counter */}
                                    <div className="mac-ann-footer">
                                        <div
                                            className={`mac-reaction-pill ${ann.has_reacted ? 'reacted' : ''}`}
                                            onClick={() => toggleAnnouncementReaction(ann.id)}
                                            title={ann.reactions && ann.reactions.length > 0
                                                ? `${t('readBy')}:\n${ann.reactions.map(r => `• ${r.rango} ${r.nombre} ${r.apellido}`).join('\n')}`
                                                : t('noReactions')}
                                        >
                                            <IconCheck />
                                            <span>{ann.has_reacted ? 'Confirmado' : 'Marcar Leído'}</span>
                                            <span style={{
                                                background: 'rgba(255, 255, 255, 0.12)',
                                                borderRadius: '9999px',
                                                padding: '1px 7px',
                                                fontSize: '0.75rem'
                                            }}>
                                                {ann.reaction_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Events Sidebar Widget */}
                <div className="mac-sidebar-column">
                    <div className="mac-card-widget">
                        <div className="mac-card-widget-title">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <IconCalendar />
                                <span>{t('upcomingEventsTitle')}</span>
                            </div>
                            <button
                                onClick={handleOpenCalendar}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#007aff',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Ver Todo →
                            </button>
                        </div>

                        <div className="events-list">
                            {events.length === 0 ? (
                                <div style={{ textTransform: 'none', textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                                    {t('noUpcomingEvents')}
                                </div>
                            ) : (
                                events.map(ev => {
                                    const evDate = new Date(ev.event_date);
                                    const monthStr = evDate.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toUpperCase();
                                    const dayStr = evDate.getDate();
                                    const timeStr = evDate.toLocaleString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <div
                                            key={ev.id}
                                            className="apple-event-card"
                                            onClick={() => setSelectedEvent(ev)}
                                        >
                                            <div className="apple-date-chip">
                                                <span className="apple-date-month">{monthStr}</span>
                                                <span className="apple-date-day">{dayStr}</span>
                                            </div>

                                            <div className="apple-event-details">
                                                <h4 className="apple-event-title">{ev.title}</h4>
                                                <div className="apple-event-time" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <IconClock />
                                                    <span>{timeStr} hs</span>
                                                </div>

                                                <div className="apple-event-footer">
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <IconUsers />
                                                        <span>{ev.participant_count}</span>
                                                    </span>

                                                    <button
                                                        className={`mac-btn ${ev.is_participating ? 'mac-btn-secondary' : 'mac-btn-primary'}`}
                                                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (ev.user_status === 'ATTENDED' || ev.user_status === 'ABSENT') {
                                                                alert("No puedes abandonar este evento porque ya se ha pasado lista.");
                                                                return;
                                                            }
                                                            toggleEventRegistration(ev.id);
                                                        }}
                                                        disabled={ev.user_status === 'ATTENDED' || ev.user_status === 'ABSENT'}
                                                    >
                                                        {ev.user_status === 'ATTENDED' ? 'Asistió' :
                                                            ev.user_status === 'ABSENT' ? 'Ausente' :
                                                                ev.is_participating ? 'Inscrito' : 'Unirse'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Announcement Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '640px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={closeModal} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                {editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}
                            </span>
                        </div>

                        <form onSubmit={handleSaveAnnouncement} style={{ padding: '1.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Título del Comunicado</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newPost.title}
                                    onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                                    placeholder="Escribe un título descriptivo..."
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Contenido</label>
                                <ReactQuill
                                    theme="snow"
                                    modules={quillModules}
                                    formats={quillFormats}
                                    value={newPost.content}
                                    onChange={content => setNewPost(prev => ({ ...prev, content }))}
                                    style={{ marginBottom: '1rem', borderRadius: '12px' }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('imagesLabel')}</label>
                                <label htmlFor="ann-file-upload" className="mac-btn mac-btn-secondary" style={{ cursor: 'pointer' }}>
                                    <IconCamera />
                                    <span>{t('uploadImagesBtn')}</span>
                                </label>
                                <input
                                    id="ann-file-upload"
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />

                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                    {newPost.images && newPost.images.map((src, i) => (
                                        <div key={i} style={{ position: 'relative' }}>
                                            <img src={src} style={{ height: '64px', width: '64px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)' }} alt="" />
                                            <button
                                                type="button"
                                                onClick={() => setNewPost(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                                                style={{ position: 'absolute', top: -6, right: -6, background: '#ff3b30', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {canPin && (
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <input
                                        type="checkbox"
                                        id="pinCheck"
                                        checked={newPost.pinned}
                                        onChange={e => setNewPost({ ...newPost, pinned: e.target.checked })}
                                    />
                                    <label htmlFor="pinCheck" className="form-label" style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <IconPin />
                                        <span>Fijar este anuncio al inicio</span>
                                    </label>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" disabled={submitting}>
                                    {submitting ? 'Guardando...' : (editingId ? 'Actualizar Anuncio' : 'Publicar Anuncio')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Event Create Modal */}
            {showEventModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '580px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={closeEventModal} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                Programar Evento de la Unidad
                            </span>
                        </div>

                        <form onSubmit={handleSaveEvent} style={{ padding: '1.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Título del Evento</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    placeholder="Nombre de la reunión u operativo..."
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <textarea
                                    className="eval-textarea"
                                    rows="4"
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    placeholder="Detalles sobre el evento..."
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Fecha y Hora</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={newEvent.event_date}
                                    onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={closeEventModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" disabled={submittingEvent}>
                                    {submittingEvent ? 'Guardando...' : 'Crear Evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Full Calendar Modal */}
            {showCalendarModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content calendar-modal mac-modal-dialog" style={{ padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={handleCloseCalendar} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                Explorador de Calendario de Unidad
                            </span>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <button className="mac-btn mac-btn-secondary" onClick={prevMonth}>◀ Anterior</button>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', textTransform: 'capitalize' }}>
                                    {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button className="mac-btn mac-btn-secondary" onClick={nextMonth}>Siguiente ▶</button>
                            </div>

                            <div className="calendar-grid">
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                                    <div key={day} className="calendar-day-header">{day}</div>
                                ))}

                                {(() => {
                                    const year = currentMonth.getFullYear();
                                    const month = currentMonth.getMonth();

                                    let firstDay = new Date(year, month, 1).getDay();
                                    firstDay = firstDay === 0 ? 6 : firstDay - 1;

                                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                                    const days = [];
                                    for (let i = 0; i < firstDay; i++) {
                                        days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
                                    }

                                    for (let i = 1; i <= daysInMonth; i++) {
                                        const currentDate = new Date(year, month, i);

                                        const dayEvents = allEvents.filter(ev => {
                                            const evDate = new Date(ev.event_date);
                                            return evDate.getDate() === i && evDate.getMonth() === month && evDate.getFullYear() === year;
                                        });

                                        const isToday = new Date().toDateString() === currentDate.toDateString();

                                        days.push(
                                            <div key={i} className={`calendar-day ${isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}>
                                                <div className="day-number">{i}</div>
                                                <div className="day-events">
                                                    {dayEvents.map(ev => (
                                                        <div
                                                            key={ev.id}
                                                            className="day-event-chip"
                                                            title={`${ev.title}\n${ev.participant_count} Participantes`}
                                                            onClick={() => setSelectedEvent(ev)}
                                                        >
                                                            {ev.title}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return days;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Details Viewer Modal */}
            {selectedEvent && (
                <div className="cropper-modal-overlay" style={{ zIndex: 3000 }}>
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '580px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setSelectedEvent(null)} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                Detalle del Evento
                            </span>
                        </div>

                        <div style={{ padding: '1.75rem' }}>
                            <h3 style={{ color: '#ffffff', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>{selectedEvent.title}</h3>
                            <div style={{ color: '#007aff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <IconCalendar />
                                <span>{new Date(selectedEvent.event_date).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</span>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: '600' }}>
                                    Descripción
                                </div>
                                <p style={{ color: '#cbd5e1', lineHeight: '1.6', background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    {selectedEvent.description}
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    <div className="user-avatar-small" style={{ margin: 0, width: '40px', height: '40px' }}>
                                        {selectedEvent.author_image ? (
                                            <img src={selectedEvent.author_image} alt="" />
                                        ) : (
                                            <div className="mini-avatar-placeholder">{selectedEvent.author_name?.charAt(0)}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Organizado por</div>
                                        <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.9rem' }}>
                                            {selectedEvent.author_rank} {selectedEvent.author_name}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Inscripción</div>
                                    <div style={{
                                        fontWeight: '600',
                                        fontSize: '0.9rem',
                                        color: selectedEvent.user_status === 'ATTENDED' ? '#34c759' :
                                            selectedEvent.user_status === 'ABSENT' ? '#ff3b30' :
                                                selectedEvent.is_participating ? '#34c759' : '#94a3b8'
                                    }}>
                                        {selectedEvent.user_status === 'ATTENDED' ? 'Asistió' :
                                            selectedEvent.user_status === 'ABSENT' ? 'Ausente' :
                                                selectedEvent.is_participating ? 'Inscrito' : 'No inscrito'}
                                    </div>
                                </div>
                            </div>

                            {/* Participants List */}
                            <div style={{ marginTop: '1.5rem' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: '600' }}>
                                    Participantes Confirmados ({selectedEvent.participants ? selectedEvent.participants.length : 0})
                                </div>
                                {!selectedEvent.participants || selectedEvent.participants.length === 0 ? (
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.75rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                                        Sin participantes inscritos aún.
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.5rem 0.85rem' }}>
                                        {selectedEvent.participants.map(participant => (
                                            <div key={participant.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#f1f5f9', flexShrink: 0 }}>
                                                    {participant.profile_image ? (
                                                        <img src={participant.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        participant.nombre?.charAt(0)
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>
                                                    {participant.rango} {participant.nombre} {participant.apellido}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem' }}>
                                <button
                                    className={`mac-btn ${selectedEvent.is_participating ? 'mac-btn-secondary' : 'mac-btn-primary'}`}
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    disabled={selectedEvent.user_status === 'ATTENDED' || selectedEvent.user_status === 'ABSENT'}
                                    onClick={async () => {
                                        if (selectedEvent.user_status === 'ATTENDED' || selectedEvent.user_status === 'ABSENT') return;
                                        await toggleEventRegistration(selectedEvent.id);
                                        const newStatus = selectedEvent.is_participating ? null : 'REGISTERED';
                                        setSelectedEvent({
                                            ...selectedEvent,
                                            is_participating: !selectedEvent.is_participating,
                                            user_status: newStatus,
                                            participant_count: selectedEvent.is_participating ? parseInt(selectedEvent.participant_count) - 1 : parseInt(selectedEvent.participant_count) + 1
                                        });
                                    }}
                                >
                                    {selectedEvent.user_status === 'ATTENDED' ? 'ASISTIÓ' :
                                        selectedEvent.user_status === 'ABSENT' ? 'AUSENTE' :
                                            selectedEvent.is_participating ? 'Abandonar Evento' : 'Unirme a este Evento'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN LIGHTBOX IMAGE VIEWER */}
            {expandedImage && (
                <div
                    onClick={() => setExpandedImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.92)',
                        backdropFilter: 'blur(20px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <img src={expandedImage} alt="" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }} />
                </div>
            )}
        </div>
    );
}

export default Dashboard;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [events, setEvents] = useState([]); // New state for events
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    // Create/Edit Modal State
    const [showModal, setShowModal] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', pinned: false });
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Event Modal State
    const [showEventModal, setShowEventModal] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '' });
    const [submittingEvent, setSubmittingEvent] = useState(false);

    // Full Calendar State
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [allEvents, setAllEvents] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Event Viewer Modal State
    const [selectedEvent, setSelectedEvent] = useState(null);

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

            // Get User Profile
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (userError) throw userError;
            console.log("Current User:", userData);
            setUser(userData);

            // Get Announcements
            await fetchAnnouncements();

            // Get Events
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
            console.log("Fetched Announcements:", data);
            setAnnouncements(data || []);
        }
    };

    const fetchEvents = async (userId) => {
        const { data, error } = await supabase.rpc('get_upcoming_events', { p_user_id: userId || user?.id });
        if (error) {
            console.error('Error fetching events:', error);
        } else {
            console.log("Fetched Events:", data);
            setEvents(data || []);
        }
    };

    const fetchAllMonthEvents = async () => {
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1; // JS months are 0-11, postgres EXTRACT usually 1-12

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
        if (!newPost.title.trim() || !newPost.content.trim()) return;

        try {
            setSubmitting(true);

            if (editingId) {
                // Update existing
                const { error } = await supabase.rpc('update_announcement', {
                    p_id: editingId,
                    p_title: newPost.title,
                    p_content: newPost.content,
                    p_pinned: newPost.pinned
                });
                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase.rpc('create_announcement', {
                    p_title: newPost.title,
                    p_content: newPost.content,
                    p_pinned: newPost.pinned
                });
                if (error) throw error;
            }

            closeModal();
            fetchAnnouncements();
        } catch (err) {
            alert('Error saving post: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (ann) => {
        setNewPost({ title: ann.title, content: ann.content, pinned: ann.pinned });
        setEditingId(ann.id);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setNewPost({ title: '', content: '', pinned: false });
        setEditingId(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
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

    // --- EVENT HANDLERS ---
    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!newEvent.title.trim() || !newEvent.description.trim() || !newEvent.event_date) return;

        try {
            setSubmittingEvent(true);

            const { error } = await supabase.rpc('create_event', {
                p_title: newEvent.title,
                p_description: newEvent.description,
                p_event_date: newEvent.event_date
            });
            if (error) throw error;

            closeEventModal();
            fetchEvents();
        } catch (err) {
            alert('Error saving event: ' + err.message);
        } finally {
            setSubmittingEvent(false);
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm("Are you sure you want to delete this event?")) return;
        try {
            const { error } = await supabase.rpc('delete_event', { p_id: id });
            if (error) throw error;
            fetchEvents();
        } catch (err) {
            alert(err.message);
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
            fetchEvents(); // Refresh upcoming list
            if (showCalendarModal) {
                fetchAllMonthEvents(); // Refresh full calendar list if open
            }
        } catch (err) {
            alert('Error toggling registration: ' + err.message);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const canPost = user && ['Detective', 'Coordinador', 'Comisionado', 'Administrador'].includes(user.rol);
    const canPin = user && ['Coordinador', 'Comisionado', 'Administrador'].includes(user.rol);
    const canCreateEvent = user && ['Detective', 'Coordinador', 'Comisionado', 'Administrador', 'DOJ General', 'Fiscal General', 'Juez', 'Juez Supremo'].includes(user.rol);
    const canDeleteEvent = user && ['Coordinador', 'Comisionado', 'Administrador', 'Juez Supremo'].includes(user.rol);

    const isLSSD = document.body.classList.contains('theme-lssd');

    if (loading) return <div className="loading-container">{t('loadingDashboard')}</div>;

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="doc-header">
                <div>
                    <h2 className="page-title">{isLSSD ? 'SHERIFF CRIMINAL UNIT DASHBOARD' : 'DETECTIVE BUREAU DASHBOARD'}</h2>
                    <h4 style={{ color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {t('welcomeBack')} {user?.rango} {user?.apellido}
                    </h4>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="login-button btn-secondary" style={{ width: 'auto' }} onClick={handleLogout}>
                        {t('logOutBtn')}
                    </button>
                    {canPost && (
                        <button className="login-button" style={{ width: 'auto' }} onClick={() => { setEditingId(null); setNewPost({ title: '', content: '', pinned: false }); setShowModal(true); }}>
                            {t('newAnnouncementBtn')}
                        </button>
                    )}
                    {canCreateEvent && (
                        <button className="login-button" style={{ width: 'auto', backgroundColor: 'var(--accent-purple)' }} onClick={() => setShowEventModal(true)}>
                            {t('newEventBtn')}
                        </button>
                    )}
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Announcements Section */}
                <section className="announcements-section">
                    <h3 className="section-title">{t('announcementsTitle')}</h3>

                    <div className="announcements-list">
                        {announcements.length === 0 ? (
                            <div className="empty-list">{t('noAnnouncements')}</div>
                        ) : (
                            announcements.map(ann => (
                                <div key={ann.id} className={`announcement-card ${ann.pinned ? 'pinned' : ''}`}>
                                    {ann.pinned && <div className="pin-icon">{t('pinned')}</div>}

                                    <div className="ann-header">
                                        <h4 className="ann-title" style={{ margin: 0 }}>{ann.title}</h4>
                                        <div className="ann-actions">
                                            {canPin && (
                                                <button onClick={() => handlePin(ann.id)} className="icon-btn" title={ann.pinned ? t('unpin') : t('pin')}>
                                                    {ann.pinned ? t('unpin') : t('pin')}
                                                </button>
                                            )}
                                            {ann.cur_user_can_delete && (
                                                <>
                                                    <button onClick={() => handleEdit(ann)} className="icon-btn edit" title="Edit">
                                                        ✏️
                                                    </button>
                                                    <button onClick={() => handleDelete(ann.id)} className="icon-btn delete" title="Delete">
                                                        🗑️
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="ann-content">{ann.content}</div>

                                    <div className="ann-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="ann-author-info">
                                            {ann.author_image ? (
                                                <img src={ann.author_image} alt="Author" className="mini-avatar" />
                                            ) : (
                                                <div className="mini-avatar-placeholder">{ann.author_name?.charAt(0)}</div>
                                            )}
                                            <div>
                                                <span className="ann-author-name">{ann.author_rank} {ann.author_name}</span>
                                                <span className="ann-date">{new Date(ann.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Read Confirmation Badge */}
                                        <div 
                                            onClick={(e) => { e.stopPropagation(); toggleAnnouncementReaction(ann.id); }}
                                            title={ann.reactions && ann.reactions.length > 0 
                                                ? `${t('readBy')}:\n${ann.reactions.map(r => `• ${r.rango} ${r.nombre} ${r.apellido}`).join('\n')}` 
                                                : t('noReactions')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                background: ann.has_reacted ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                border: ann.has_reacted ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                color: ann.has_reacted ? '#4ade80' : 'var(--text-secondary)',
                                                transition: 'all 0.2s ease',
                                                fontWeight: ann.has_reacted ? 'bold' : 'normal'
                                            }}
                                        >
                                            <span>✓</span>
                                            <span>{ann.reaction_count || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Events Section */}
                <section className="events-section">
                    <div className="section-header-row">
                        <h3 className="section-title" style={{ borderBottom: 'none', margin: 0, padding: 0 }}>{t('upcomingEventsTitle')}</h3>
                        <button className="view-calendar-btn" onClick={handleOpenCalendar}>
                            <span className="calendar-icon">🗓️</span> {t('fullCalendar')}
                        </button>
                    </div>

                    <div className="events-list">
                        {events.length === 0 ? (
                            <div className="empty-list">{t('noUpcomingEvents')}</div>
                        ) : (
                            events.map(ev => (
                                <div key={ev.id} className="event-card" onClick={() => setSelectedEvent(ev)} style={{ cursor: 'pointer' }}>
                                    <div className="event-header">
                                        <h4 className="event-title">{ev.title}</h4>
                                        <div className="event-date">
                                            {new Date(ev.event_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </div>
                                    </div>
                                    <div className="event-content">{ev.description}</div>
                                    <div className="event-footer">
                                        <div 
                                            className="event-stats"
                                            title={ev.participants && ev.participants.length > 0 ? ev.participants.map(p => `${p.rango} ${p.nombre} ${p.apellido}`).join('\n') : t('noParticipants')}
                                        >
                                            👥 {ev.participant_count} {t('participantsCount')}
                                        </div>
                                        <div className="event-actions">
                                            <button
                                                className={`action-btn ${ev.is_participating ? 'danger' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent opening modal when clicking join/leave
                                                    if (ev.user_status === 'ATTENDED' || ev.user_status === 'ABSENT') {
                                                        alert("No puedes abandonar este evento porque ya se ha pasado lista.");
                                                        return;
                                                    }
                                                    toggleEventRegistration(ev.id);
                                                }}
                                                disabled={ev.user_status === 'ATTENDED' || ev.user_status === 'ABSENT'}
                                                style={{ opacity: (ev.user_status === 'ATTENDED' || ev.user_status === 'ABSENT') ? 0.5 : 1 }}
                                            >
                                                {ev.user_status === 'ATTENDED' ? t('attended') :
                                                    ev.user_status === 'ABSENT' ? t('absent') :
                                                        ev.is_participating ? t('leaveEvent') : t('joinEvent')}
                                            </button>

                                            {canDeleteEvent && (
                                                <button onClick={(e) => {
                                                    e.stopPropagation(); // Prevent opening modal when deleting
                                                    handleDeleteEvent(ev.id);
                                                }} className="icon-btn delete" title="Delete Event">
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', textAlign: 'left' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                            {editingId ? 'Edit Announcement' : 'New Announcement'}
                        </h3>
                        <form onSubmit={handleSaveAnnouncement}>
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newPost.title}
                                    onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Content</label>
                                <textarea
                                    className="eval-textarea"
                                    rows="10"
                                    value={newPost.content}
                                    onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                                    required
                                />
                            </div>
                            {canPin && (
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="pinCheck"
                                        checked={newPost.pinned}
                                        onChange={e => setNewPost({ ...newPost, pinned: e.target.checked })}
                                    />
                                    <label htmlFor="pinCheck" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Pin this announcement</label>
                                </div>
                            )}
                            <div className="cropper-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="login-button btn-secondary" onClick={closeModal} style={{ width: 'auto' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="login-button" disabled={submitting} style={{ width: 'auto' }}>
                                    {submitting ? 'Saving...' : (editingId ? 'Update Post' : 'Post Announcement')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Event Create Modal */}
            {showEventModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', textAlign: 'left' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Schedule New Event</h3>
                        <form onSubmit={handleSaveEvent}>
                            <div className="form-group">
                                <label className="form-label">Event Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="eval-textarea"
                                    rows="5"
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date and Time</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={newEvent.event_date}
                                    onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={closeEventModal} style={{ width: 'auto' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="login-button" disabled={submittingEvent} style={{ width: 'auto' }}>
                                    {submittingEvent ? 'Saving...' : 'Create Event'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Full Calendar Modal */}
            {showCalendarModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content calendar-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Calendar Explorer</h3>
                            <button className="icon-btn delete" onClick={handleCloseCalendar} style={{ fontSize: '1.2rem' }}>✖</button>
                        </div>

                        <div className="calendar-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <button className="action-btn" style={{ width: 'auto' }} onClick={prevMonth}>◀ Prev</button>
                            <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
                                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h4>
                            <button className="action-btn" style={{ width: 'auto' }} onClick={nextMonth}>Next ▶</button>
                        </div>

                        <div className="calendar-grid">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="calendar-day-header">{day}</div>
                            ))}

                            {/* Generation of days */}
                            {(() => {
                                const year = currentMonth.getFullYear();
                                const month = currentMonth.getMonth();

                                // Get first day of month (0 = Sunday, 1 = Monday ...)
                                let firstDay = new Date(year, month, 1).getDay();

                                // Convert to European formatting (0 = Monday, ..., 6 = Sunday)
                                firstDay = firstDay === 0 ? 6 : firstDay - 1;

                                const daysInMonth = new Date(year, month + 1, 0).getDate();

                                const days = [];
                                // Empty slots before the first day
                                for (let i = 0; i < firstDay; i++) {
                                    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
                                }

                                // Actual days
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const currentDate = new Date(year, month, i);

                                    // Filter events for this day
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
                                                        title={`${ev.title}\n👥 ${ev.participant_count} ${t('participantsCount')}${ev.participants && ev.participants.length > 0 ? `:\n${ev.participants.map(p => `• ${p.rango} ${p.nombre} ${p.apellido}`).join('\n')}` : ''}`} 
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
            )}

            {/* Event Details Viewer Modal */}
            {selectedEvent && (
                <div className="cropper-modal-overlay" style={{ zIndex: 3000 }}>
                    <div className="cropper-modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
                            <div>
                                <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{selectedEvent.title}</h3>
                                <div style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📅 {new Date(selectedEvent.event_date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                                </div>
                            </div>
                            <button className="icon-btn delete" onClick={() => setSelectedEvent(null)} style={{ fontSize: '1.2rem' }}>✖</button>
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Description</h4>
                            <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                {selectedEvent.description}
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="user-avatar-small" style={{ margin: 0, width: '45px', height: '45px' }}>
                                    {selectedEvent.author_image ? (
                                        <img src={selectedEvent.author_image} alt={selectedEvent.author_name} />
                                    ) : (
                                        <div className="mini-avatar-placeholder">{selectedEvent.author_name?.charAt(0)}</div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Organized by</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                        {selectedEvent.author_rank} {selectedEvent.author_name}
                                    </div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Participation Status</div>
                                <div style={{
                                    fontWeight: '600',
                                    color: selectedEvent.user_status === 'ATTENDED' ? '#10b981' :
                                        selectedEvent.user_status === 'ABSENT' ? '#ef4444' :
                                            selectedEvent.user_status === 'REGISTERED' ? 'var(--accent-gold)' :
                                                selectedEvent.is_participating ? '#10b981' : 'var(--text-secondary)'
                                }}>
                                    {selectedEvent.user_status === 'ATTENDED' ? '✓ Asistió' :
                                        selectedEvent.user_status === 'ABSENT' ? '❌ Ausente' :
                                            selectedEvent.user_status === 'REGISTERED' ? '⏳ Pendiente (Inscrito)' :
                                                selectedEvent.is_participating ? '✓ Inscrito' : 'No inscrito'}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginTop: '0.25rem' }}>
                                    👥 {selectedEvent.participant_count} Total Participants
                                </div>
                            </div>
                        </div>

                        {/* Participants List */}
                        <div style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {t('participantsList')} ({selectedEvent.participants ? selectedEvent.participants.length : 0})
                            </h4>
                            {!selectedEvent.participants || selectedEvent.participants.length === 0 ? (
                                <div style={{ 
                                    color: 'var(--text-secondary)', 
                                    fontSize: '0.9rem', 
                                    fontStyle: 'italic', 
                                    padding: '1rem',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    textAlign: 'center'
                                }}>
                                    {t('noParticipants')}
                                </div>
                            ) : (
                                <div style={{ 
                                    maxHeight: '180px', 
                                    overflowY: 'auto', 
                                    background: 'rgba(0, 0, 0, 0.2)', 
                                    borderRadius: '8px', 
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    padding: '0.5rem 1rem'
                                }}>
                                    {selectedEvent.participants.map(participant => (
                                        <div key={participant.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                            <div className="mini-avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>
                                                {participant.profile_image ? (
                                                    <img src={participant.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    participant.nombre?.charAt(0)
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                                {participant.rango} {participant.nombre} {participant.apellido}
                                            </div>
                                            {participant.status && participant.status !== 'REGISTERED' && (
                                                <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    padding: '0.1rem 0.4rem', 
                                                    borderRadius: '4px', 
                                                    marginLeft: 'auto',
                                                    background: participant.status === 'ATTENDED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                    color: participant.status === 'ATTENDED' ? '#10b981' : '#ef4444',
                                                    fontWeight: '600'
                                                }}>
                                                    {participant.status === 'ATTENDED' ? t('attended') : t('absent')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="cropper-actions" style={{ justifyContent: 'center', marginTop: '2rem' }}>
                            <button
                                className={`login-button ${selectedEvent.is_participating ? 'btn-secondary' : ''}`}
                                style={{
                                    width: '100%',
                                    borderColor: selectedEvent.is_participating ? '#ef4444' : 'var(--accent-gold)',
                                    color: selectedEvent.is_participating ? '#ef4444' : 'var(--accent-gold)',
                                    opacity: (selectedEvent.user_status === 'ATTENDED' || selectedEvent.user_status === 'ABSENT') ? 0.5 : 1
                                }}
                                disabled={selectedEvent.user_status === 'ATTENDED' || selectedEvent.user_status === 'ABSENT'}
                                onClick={async () => {
                                    if (selectedEvent.user_status === 'ATTENDED' || selectedEvent.user_status === 'ABSENT') {
                                        return;
                                    }

                                    await toggleEventRegistration(selectedEvent.id);
                                    // Update visual representation immediately
                                    const newStatus = selectedEvent.is_participating ? null : (selectedEvent.dtp_event ? 'REGISTERED' : null);
                                    
                                    // Update participants array locally
                                    let updatedParticipants = [...(selectedEvent.participants || [])];
                                    if (selectedEvent.is_participating) {
                                        // User is leaving, remove from list
                                        updatedParticipants = updatedParticipants.filter(p => p.user_id !== user.id);
                                    } else {
                                        // User is joining, add to list
                                        const isAlreadyIn = updatedParticipants.some(p => p.user_id === user.id);
                                        if (!isAlreadyIn) {
                                            updatedParticipants.push({
                                                user_id: user.id,
                                                nombre: user.nombre,
                                                apellido: user.apellido,
                                                rango: user.rango,
                                                profile_image: user.profile_image,
                                                status: newStatus || 'REGISTERED'
                                            });
                                        }
                                    }

                                    setSelectedEvent({
                                        ...selectedEvent,
                                        is_participating: !selectedEvent.is_participating,
                                        user_status: newStatus,
                                        participant_count: selectedEvent.is_participating ? parseInt(selectedEvent.participant_count) - 1 : parseInt(selectedEvent.participant_count) + 1,
                                        participants: updatedParticipants
                                    });
                                }}
                            >
                                {selectedEvent.user_status === 'ATTENDED' ? 'ASISTIÓ' :
                                    selectedEvent.user_status === 'ABSENT' ? 'AUSENTE' :
                                        selectedEvent.is_participating ? 'ABANDONAR EVENTO' : 'UNIRSE A ESTE EVENTO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;

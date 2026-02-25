import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [events, setEvents] = useState([]); // New state for events
    const [loading, setLoading] = useState(true);

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
            // Using Supabase JS to get all events, avoiding the need for a new SQL RPC
            const { data, error } = await supabase
                .from('events')
                .select(`
                    id, title, description, event_date, created_by, created_at,
                    users!events_created_by_fkey ( nombre, apellido, rango, profile_image ),
                    event_participants ( user_id )
                `)
                .order('event_date', { ascending: true });

            if (error) throw error;
            
            // Format to match the RPC structure
            const formattedEvents = data.map(e => ({
                id: e.id,
                title: e.title,
                description: e.description,
                event_date: e.event_date,
                created_by: e.created_by,
                created_at: e.created_at,
                participant_count: e.event_participants?.length || 0,
                is_participating: e.event_participants?.some(ep => ep.user_id === user?.id) || false,
                author_name: e.users ? `${e.users.nombre} ${e.users.apellido}` : 'Unknown',
                author_rank: e.users?.rango || '',
                author_image: e.users?.profile_image || ''
            }));
            
            setAllEvents(formattedEvents);
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

    if (loading) return <div className="loading-container">Loading Dashboard...</div>;

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="doc-header">
                <div>
                    <h2 className="page-title">DETECTIVE BUREAU DASHBOARD</h2>
                    <h4 style={{ color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Welcome back, {user?.rango} {user?.apellido}
                    </h4>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="login-button btn-secondary" style={{ width: 'auto' }} onClick={handleLogout}>
                        Log Out
                    </button>
                    {canPost && (
                        <button className="login-button" style={{ width: 'auto' }} onClick={() => { setEditingId(null); setNewPost({ title: '', content: '', pinned: false }); setShowModal(true); }}>
                            + New Announcement
                        </button>
                    )}
                    {canCreateEvent && (
                        <button className="login-button" style={{ width: 'auto', backgroundColor: 'var(--accent-purple)' }} onClick={() => setShowEventModal(true)}>
                            + New Event
                        </button>
                    )}
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Announcements Section */}
                <section className="announcements-section">
                    <h3 className="section-title">📢 Official Announcements & Notifications</h3>

                    <div className="announcements-list">
                        {announcements.length === 0 ? (
                            <div className="empty-list">No announcements yet.</div>
                        ) : (
                            announcements.map(ann => (
                                <div key={ann.id} className={`announcement-card ${ann.pinned ? 'pinned' : ''}`}>
                                    {ann.pinned && <div className="pin-icon">📌 PINNED</div>}

                                    <div className="ann-header">
                                        <h4 className="ann-title" style={{ margin: 0 }}>{ann.title}</h4>
                                        <div className="ann-actions">
                                            {canPin && (
                                                <button onClick={() => handlePin(ann.id)} className="icon-btn" title={ann.pinned ? "Unpin" : "Pin"}>
                                                    {ann.pinned ? "Unpin" : "Pin"}
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

                                    <div className="ann-footer">
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
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Events Section */}
                <section className="events-section">
                    <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem' }}>
                        <h3 className="section-title" style={{ borderBottom: 'none', margin: 0, padding: 0 }}>📅 Upcoming Events</h3>
                        <button className="action-btn" style={{ width: 'auto', padding: '0.4rem 0.8rem' }} onClick={handleOpenCalendar}>
                            🗓️ Full Calendar
                        </button>
                    </div>

                    <div className="events-list">
                        {events.length === 0 ? (
                            <div className="empty-list">No upcoming events scheduled.</div>
                        ) : (
                            events.map(ev => (
                                <div key={ev.id} className="event-card">
                                    <div className="event-header">
                                        <h4 className="event-title">{ev.title}</h4>
                                        <div className="event-date">
                                            {new Date(ev.event_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </div>
                                    </div>
                                    <div className="event-content">{ev.description}</div>
                                    <div className="event-footer">
                                        <div className="event-stats">
                                            👥 {ev.participant_count} participants
                                        </div>
                                        <div className="event-actions">
                                            <button 
                                                className={`action-btn ${ev.is_participating ? 'danger' : ''}`}
                                                onClick={() => toggleEventRegistration(ev.id)}
                                            >
                                                {ev.is_participating ? 'Leave Event' : 'Join Event'}
                                            </button>
             
                                            {canDeleteEvent && (
                                                <button onClick={() => handleDeleteEvent(ev.id)} className="icon-btn delete" title="Delete Event">
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
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="calendar-day-header">{day}</div>
                            ))}
                            
                            {/* Generation of days */}
                            {(() => {
                                const year = currentMonth.getFullYear();
                                const month = currentMonth.getMonth();
                                const firstDay = new Date(year, month, 1).getDay();
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
                                                    <div key={ev.id} className="day-event-chip" title={ev.title} onClick={() => alert(`Title: ${ev.title}\nDescription: ${ev.description}\nParticipants: ${ev.participant_count}\nParticipating: ${ev.is_participating ? 'Yes' : 'No'}`)}>
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
        </div>
    );
}

export default Dashboard;

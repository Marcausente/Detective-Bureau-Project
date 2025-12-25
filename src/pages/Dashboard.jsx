import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Modal State
    const [showModal, setShowModal] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', pinned: false });
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

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

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const canPost = user && ['Detective', 'Coordinador', 'Comisionado', 'Administrador'].includes(user.rol);
    const canPin = user && ['Coordinador', 'Comisionado', 'Administrador'].includes(user.rol);

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
        </div>
    );
}

export default Dashboard;

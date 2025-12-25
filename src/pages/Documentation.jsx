import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Documentation() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ title: '', description: '', url: '' });
    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Get User Role
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('rol')
                    .eq('id', user.id)
                    .single();
                if (profile) setUserRole(profile.rol);
            }

            // 2. Fetch Documentation
            const { data, error } = await supabase
                .from('documentation_posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPosts(data || []);

        } catch (err) {
            console.error('Error loading documentation:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);

        try {
            const { error } = await supabase.rpc('manage_documentation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_description: formData.description,
                p_url: formData.url
            });

            if (error) throw error;

            setShowModal(false);
            loadData(); // Refresh

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this documentation post?")) return;
        try {
            const { error } = await supabase.rpc('manage_documentation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    const openCreate = () => {
        setModalMode('create');
        setFormData({ title: '', description: '', url: '' });
        setShowModal(true);
    };

    const openEdit = (post) => {
        setModalMode('update');
        setEditingId(post.id);
        setFormData({ title: post.title, description: post.description || '', url: post.url });
        setShowModal(true);
    };

    const canManage = ['Coordinador', 'Comisionado', 'Administrador'].includes(userRole);

    return (
        <div className="documentation-container">
            <div className="doc-header">
                <h2 className="page-title">Documentation & Resources</h2>
                {canManage && (
                    <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={openCreate}>
                        + Add Document
                    </button>
                )}
            </div>

            {loading ? (
                <div className="loading-container">Loading Resources...</div>
            ) : (
                <div className="doc-grid">
                    {posts.length === 0 ? (
                        <div className="empty-list" style={{ gridColumn: '1/-1', textAlign: 'center' }}>No documentation found.</div>
                    ) : (
                        posts.map(post => (
                            <div key={post.id} className="doc-card">
                                {canManage && (
                                    <div className="doc-actions">
                                        <button onClick={(e) => { e.stopPropagation(); openEdit(post); }}>✏️</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}>🗑️</button>
                                    </div>
                                )}
                                <a href={post.url} target="_blank" rel="noopener noreferrer" className="doc-link-wrapper">
                                    <div className="doc-icon">
                                        📄
                                    </div>
                                    <h3 className="doc-title">{post.title}</h3>
                                    {post.description && <p className="doc-desc">{post.description}</p>}
                                    <span className="doc-click-hint">Click to open</span>
                                </a>
                            </div>
                        ))
                    )}
                </div>
            )}

            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3>{modalMode === 'create' ? 'New Document' : 'Edit Document'}</h3>
                        <form onSubmit={handleAction} style={{ textAlign: 'left', marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input className="form-input" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <textarea className="form-input" rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">External URL</label>
                                <input className="form-input" required type="url" placeholder="https://..." value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="login-button" disabled={submitLoading}>{submitLoading ? 'Saving...' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Documentation;

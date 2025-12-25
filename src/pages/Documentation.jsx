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
    const [targetCategory, setTargetCategory] = useState('documentation');
    const [inputType, setInputType] = useState('url'); // 'url' or 'file'
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
                p_url: formData.url,
                p_category: targetCategory
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
        if (!window.confirm("Delete this item?")) return;
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check size (e.g. limit to 5MB to avoid exploding the DB column too much, though TEXT can handle it)
            if (file.size > 5 * 1024 * 1024) {
                alert("File is too large. Please select an image under 5MB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, url: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const openCreate = (category) => {
        setModalMode('create');
        setTargetCategory(category);
        setInputType('url');
        setFormData({ title: '', description: '', url: '' });
        setShowModal(true);
    };

    const openEdit = (post) => {
        setModalMode('update');
        setEditingId(post.id);
        setTargetCategory(post.category || 'documentation');

        // Detect if it is a data url (file) or normal url
        const isDataUrl = post.url && post.url.startsWith('data:');
        setInputType(isDataUrl ? 'file' : 'url');

        setFormData({ title: post.title, description: post.description || '', url: post.url });
        setShowModal(true);
    };

    const canManage = ['Coordinador', 'Comisionado', 'Administrador'].includes(userRole);

    // Filter Posts
    const docs = posts.filter(p => !p.category || p.category === 'documentation');
    const resources = posts.filter(p => p.category === 'resource');

    const renderGrid = (items, emptyMsg) => (
        <div className="doc-grid">
            {items.length === 0 ? (
                <div className="empty-list" style={{ gridColumn: '1/-1', textAlign: 'center', background: 'transparent' }}>{emptyMsg}</div>
            ) : (
                items.map(post => {
                    const isImage = post.url && post.url.startsWith('data:image');
                    return (
                        <div key={post.id} className="doc-card">
                            {canManage && (
                                <div className="doc-actions">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(post); }}>✏️</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}>🗑️</button>
                                </div>
                            )}
                            <a href={post.url} target="_blank" rel="noopener noreferrer" className="doc-link-wrapper">
                                <div className="doc-icon" style={isImage ? { padding: 0, overflow: 'hidden', background: 'transparent', border: 'none' } : {}}>
                                    {isImage ? (
                                        <img src={post.url} alt="Resource" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                    ) : (
                                        post.category === 'resource' ? '🔗' : '📄'
                                    )}
                                </div>
                                <h3 className="doc-title">{post.title}</h3>
                                {post.description && <p className="doc-desc">{post.description}</p>}
                                <span className="doc-click-hint">{isImage ? 'Click to view image' : 'Click to open'}</span>
                            </a>
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div className="documentation-container">
            {loading ? (
                <div className="loading-container">Loading...</div>
            ) : (
                <>
                    {/* Documentation Section */}
                    <div className="doc-section">
                        <div className="doc-header">
                            <h2 className="page-title">Documentation</h2>
                            {canManage && (
                                <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => openCreate('documentation')}>
                                    + Add Document
                                </button>
                            )}
                        </div>
                        {renderGrid(docs, "No documentation found.")}
                    </div>

                    {/* Resources Section */}
                    <div className="doc-section" style={{ marginTop: '5rem' }}>
                        <div className="doc-header">
                            <h2 className="page-title">Resources</h2>
                            {canManage && (
                                <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => openCreate('resource')}>
                                    + Add Resource
                                </button>
                            )}
                        </div>
                        {renderGrid(resources, "No resources found.")}
                    </div>
                </>
            )}

            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3>{modalMode === 'create' ? `New ${targetCategory === 'resource' ? 'Resource' : 'Document'}` : 'Edit Item'}</h3>
                        <form onSubmit={handleAction} style={{ textAlign: 'left', marginTop: '1rem' }}>

                            {/* Toggle for Resources Only */}
                            {targetCategory === 'resource' && (
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                    <button
                                        type="button"
                                        className={`login-button ${inputType === 'url' ? '' : 'btn-secondary'}`}
                                        style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                        onClick={() => setInputType('url')}
                                    >
                                        External URL
                                    </button>
                                    <button
                                        type="button"
                                        className={`login-button ${inputType === 'file' ? '' : 'btn-secondary'}`}
                                        style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                        onClick={() => setInputType('file')}
                                    >
                                        Upload Image
                                    </button>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input className="form-input" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <textarea className="form-input" rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{inputType === 'file' ? 'Image File' : 'External URL'}</label>
                                {inputType === 'file' ? (
                                    <>
                                        <label className="custom-file-upload">
                                            <input type="file" accept="image/*" onChange={handleFileChange} />
                                            {formData.url && formData.url.startsWith('data:') ? 'Change Image' : 'Select Image'}
                                        </label>
                                        {formData.url && formData.url.startsWith('data:') && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#4ade80' }}>
                                                ✓ Image Selected
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <input
                                        className="form-input"
                                        required={inputType === 'url'}
                                        type="url"
                                        placeholder="https://..."
                                        value={formData.url.startsWith('data:') ? '' : formData.url}
                                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    />
                                )}
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

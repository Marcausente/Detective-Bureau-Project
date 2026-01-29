import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../index.css';

function IADocumentation() {
    const navigate = useNavigate();
    const [docs, setDocs] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [targetCategory, setTargetCategory] = useState('documentation');
    const [inputType, setInputType] = useState('url'); // 'url' or 'file'
    const [formData, setFormData] = useState({ title: '', description: '', url: '' });
    const [submitLoading, setSubmitLoading] = useState(false);

    // Image Viewer State
    const [viewImage, setViewImage] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ia_documentation')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading IA docs:', error);
        } else if (data) {
            setDocs(data.filter(d => !d.category || d.category === 'documentation'));
            setResources(data.filter(d => d.category === 'resource'));
        }

        setLoading(false);
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);

        try {
            const { error } = await supabase.rpc('manage_ia_documentation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_description: formData.description,
                p_url: formData.url,
                p_category: targetCategory
            });

            if (error) throw error;

            setShowModal(false);
            loadData();

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this document?")) return;
        try {
            const { error } = await supabase.rpc('manage_ia_documentation', {
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
            if (file.size > 10 * 1024 * 1024) {
                alert("File is too large (Max 10MB).");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1200;
                    if (width > MAX_WIDTH) {
                        height = Math.round(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    setFormData({ ...formData, url: dataUrl });
                };
                img.src = event.target.result;
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

    const openEdit = (doc) => {
        setModalMode('update');
        setEditingId(doc.id);
        setTargetCategory(doc.category || 'documentation');
        const isDataUrl = doc.url && doc.url.startsWith('data:');
        setInputType(isDataUrl ? 'file' : 'url');
        setFormData({ title: doc.title, description: doc.description || '', url: doc.url });
        setShowModal(true);
    };

    const renderSection = (items, title, category, emptyMsg) => (
        <div className="doc-section" style={{ marginBottom: '4rem' }}>
            <div className="doc-header" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>{title}</h3>
                <button className="login-button" style={{ width: 'auto', backgroundColor: '#7f1d1d', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => openCreate(category)}>
                    + Add {category === 'resource' ? 'Resource' : 'Document'}
                </button>
            </div>

            <div className="doc-grid">
                {items.length === 0 ? (
                    <div className="empty-list" style={{ gridColumn: '1/-1', textAlign: 'center', background: 'transparent' }}>{emptyMsg}</div>
                ) : (
                    items.map(doc => {
                        const isImage = doc.url && doc.url.startsWith('data:image');
                        return (
                            <div key={doc.id} className="doc-card" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="doc-actions">
                                    <button onClick={() => openEdit(doc)}>✏️</button>
                                    <button onClick={() => handleDelete(doc.id)}>🗑️</button>
                                </div>
                                <a
                                    href={doc.url}
                                    target={isImage ? undefined : "_blank"}
                                    rel={isImage ? undefined : "noopener noreferrer"}
                                    className="doc-link-wrapper"
                                    onClick={(e) => {
                                        if (isImage) {
                                            e.preventDefault();
                                            setViewImage(doc.url);
                                        }
                                    }}
                                >
                                    <div className="doc-icon">
                                        {isImage ? (
                                            <img src={doc.url} alt="Doc" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                        ) : (category === 'resource' ? '🔗' : '📄')}
                                    </div>
                                    <h3 className="doc-title">{doc.title}</h3>
                                    {doc.description && <p className="doc-desc">{doc.description}</p>}
                                </a>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <button onClick={() => navigate('/internal-affairs')} style={{ display: 'block', marginBottom: '1rem', background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer' }}>← Back to Dashboard</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className="page-title" style={{ color: '#f87171', margin: 0 }}>IA CLASSIFIED RECORDS</h2>
                    <span style={{ background: '#7f1d1d', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>TOP SECRET</span>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">Loading Classified Records...</div>
            ) : (
                <>
                    {renderSection(docs, "Documentation", "documentation", "No classified documents found.")}
                    {renderSection(resources, "Resources", "resource", "No classified resources found.")}
                </>
            )}

            {/* Image Viewer Modal */}
            {viewImage && (
                <div
                    className="cropper-modal-overlay"
                    onClick={() => setViewImage(null)}
                    style={{ zIndex: 3000, cursor: 'zoom-out' }}
                >
                    <div
                        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()} // Allow clicking image without closing
                    >
                        <img
                            src={viewImage}
                            alt="Full View"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '90vh',
                                objectFit: 'contain',
                                borderRadius: '8px',
                                boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                                cursor: 'default'
                            }}
                        />
                        <button
                            className="login-button"
                            style={{
                                position: 'absolute',
                                top: '-40px',
                                right: '0',
                                width: 'auto',
                                padding: '0.5rem 1rem',
                                background: 'rgba(0,0,0,0.7)'
                            }}
                            onClick={() => setViewImage(null)}
                        >
                            Close ✕
                        </button>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3>{modalMode === 'create' ? `New ${targetCategory === 'resource' ? 'Resource' : 'Document'}` : 'Edit Item'}</h3>
                        <form onSubmit={handleAction} style={{ textAlign: 'left', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <button type="button" className={`login-button ${inputType === 'url' ? '' : 'btn-secondary'}`} style={{ padding: '0.5rem', fontSize: '0.9rem' }} onClick={() => setInputType('url')}>External URL</button>
                                <button type="button" className={`login-button ${inputType === 'file' ? '' : 'btn-secondary'}`} style={{ padding: '0.5rem', fontSize: '0.9rem' }} onClick={() => setInputType('file')}>Upload Image</button>
                            </div>

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
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#4ade80' }}>✓ Image Selected</div>
                                        )}
                                    </>
                                ) : (
                                    <input className="form-input" required={inputType === 'url'} type="url" placeholder="https://..." value={formData.url.startsWith('data:') ? '' : formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
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

export default IADocumentation;

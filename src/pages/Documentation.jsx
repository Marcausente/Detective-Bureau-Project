import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Documentation() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const { t } = useLanguage();

    // Active Category Filter & Search Query State
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'documentation', 'resource', 'information'
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [targetCategory, setTargetCategory] = useState('documentation');
    const [inputType, setInputType] = useState('url'); // 'url' or 'file'
    const [formData, setFormData] = useState({ title: '', description: '', url: '' });
    const [submitLoading, setSubmitLoading] = useState(false);

    // Lightbox & Reader Modals
    const [viewImage, setViewImage] = useState(null);
    const [viewText, setViewText] = useState(null);

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
            let docUrl = formData.url;
            if (targetCategory === 'information') {
                docUrl = null;
            } else if (docUrl && docUrl.startsWith('data:')) {
                docUrl = await uploadImageToStorage(docUrl, 'documentation');
            }

            const { error } = await supabase.rpc('manage_documentation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_description: formData.description,
                p_url: docUrl,
                p_category: targetCategory
            });

            if (error) {
                // Direct fallback in case RPC constraint or signature requires direct update
                const { data: { user } } = await supabase.auth.getUser();
                if (modalMode === 'create') {
                    const { error: insErr } = await supabase.from('documentation_posts').insert({
                        title: formData.title,
                        description: formData.description,
                        url: docUrl,
                        category: targetCategory,
                        author_id: user ? user.id : null
                    });
                    if (insErr) throw insErr;
                } else if (modalMode === 'update') {
                    const { error: updErr } = await supabase.from('documentation_posts').update({
                        title: formData.title,
                        description: formData.description,
                        url: docUrl,
                        category: targetCategory
                    }).eq('id', editingId);
                    if (updErr) throw updErr;
                }
            }

            setShowModal(false);
            loadData();

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar este elemento permanentemente?")) return;
        try {
            const { error } = await supabase.rpc('manage_documentation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert("El archivo es demasiado grande (Máx 10MB).");
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

    const openEdit = (post) => {
        setModalMode('update');
        setEditingId(post.id);
        setTargetCategory(post.category || 'documentation');

        const isDataUrl = post.url && post.url.startsWith('data:');
        setInputType(isDataUrl ? 'file' : 'url');

        setFormData({ title: post.title, description: post.description || '', url: post.url });
        setShowModal(true);
    };

    const canManage = ['Coordinador', 'Comisionado', 'Administrador'].includes(userRole);

    // Filter Posts by search query
    const filteredPosts = posts.filter(post => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return post.title.toLowerCase().includes(q) || (post.description && post.description.toLowerCase().includes(q));
    });

    const docs = filteredPosts.filter(p => !p.category || p.category === 'documentation');
    const resources = filteredPosts.filter(p => p.category === 'resource');
    const information = filteredPosts.filter(p => p.category === 'information');

    const handleCardClick = (e, post) => {
        const isImage = post.url && (post.url.startsWith('data:image') || post.url.match(/\.(jpeg|jpg|gif|png|webp)/i));
        if (isImage) {
            e.preventDefault();
            setViewImage(post.url);
        } else if (post.category === 'information') {
            e.preventDefault();
            setViewText(post);
        }
    };

    const renderCardGrid = (items, emptyMsg, categoryType) => (
        <div className="mac-doc-cards-grid">
            {items.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '0.5rem', opacity: 0.5 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>{emptyMsg}</div>
                </div>
            ) : (
                items.map(post => {
                    const isImage = post.url && (post.url.startsWith('data:image') || post.url.match(/\.(jpeg|jpg|gif|png|webp)/i));
                    return (
                        <div key={post.id} className="mac-doc-card" onClick={(e) => handleCardClick(e, post)} style={{ cursor: 'pointer' }}>
                            {canManage && (
                                <div className="mac-doc-card-actions">
                                    <button
                                        className="mac-doc-action-icon-btn"
                                        title="Editar"
                                        onClick={(e) => { e.stopPropagation(); openEdit(post); }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="mac-doc-action-icon-btn delete"
                                        title="Eliminar"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            <a
                                href={post.category === 'information' ? undefined : post.url}
                                target={isImage || post.category === 'information' ? undefined : "_blank"}
                                rel={isImage || post.category === 'information' ? undefined : "noopener noreferrer"}
                                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}
                                onClick={(e) => (isImage || post.category === 'information') && e.preventDefault()}
                            >
                                <div>
                                    <div className={`mac-doc-card-badge ${categoryType}`}>
                                        {isImage ? (
                                            <img src={post.url} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                        ) : categoryType === 'resource' ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                            </svg>
                                        ) : categoryType === 'info' ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" />
                                                <line x1="16" y1="17" x2="8" y2="17" />
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                        )}
                                    </div>
                                    <h3 className="mac-doc-card-title">{post.title}</h3>
                                    {post.description && (
                                        <p className="mac-doc-card-desc" style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {post.description}
                                        </p>
                                    )}
                                </div>

                                <div className="mac-doc-card-footer">
                                    <span>
                                        {isImage ? t('clickViewImage') : post.category === 'information' ? t('clickToRead') : t('clickToOpen')}
                                    </span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </div>
                            </a>
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div className="mac-doc-container">
            {/* macOS Banner Header */}
            <div className="mac-doc-banner">
                <div>
                    <h1 className="mac-title-text" style={{ fontSize: '1.85rem' }}>{t('documentation')}</h1>
                    <div className="mac-subtitle-text" style={{ marginTop: '0.35rem' }}>
                        Manuales policiales, recursos operativos y guías informativas del departamento.
                    </div>
                </div>

                <div className="mac-action-bar">
                    {/* Live Search Input */}
                    <div className="mac-doc-search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#64748b' }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="mac-doc-search-input"
                            placeholder="Buscar en la documentación..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <span onClick={() => setSearchQuery('')} style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>✕</span>
                        )}
                    </div>

                    {canManage && (
                        <button className="mac-btn mac-btn-primary" onClick={() => openCreate(activeTab === 'all' ? 'documentation' : activeTab)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Añadir Nuevo
                        </button>
                    )}
                </div>
            </div>

            {/* Apple Segmented Control Category Filter */}
            <div className="mac-doc-category-bar">
                <div className="mac-segmented-control">
                    <button
                        className={`mac-segment-btn ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        Todos ({posts.length})
                    </button>
                    <button
                        className={`mac-segment-btn ${activeTab === 'documentation' ? 'active' : ''}`}
                        onClick={() => setActiveTab('documentation')}
                    >
                        📄 Documentación ({docs.length})
                    </button>
                    <button
                        className={`mac-segment-btn ${activeTab === 'resource' ? 'active' : ''}`}
                        onClick={() => setActiveTab('resource')}
                    >
                        🔗 Recursos ({resources.length})
                    </button>
                    <button
                        className={`mac-segment-btn ${activeTab === 'information' ? 'active' : ''}`}
                        onClick={() => setActiveTab('information')}
                    >
                        📝 {t('informationTitle') || 'Plantillas'} ({information.length})
                    </button>
                </div>
            </div>

            {/* Content Sections */}
            {loading ? (
                <div className="mac-doc-empty">
                    <div className="loading-container">{t('loadingDocs')}</div>
                </div>
            ) : error ? (
                <div className="mac-doc-empty" style={{ color: '#ef4444' }}>
                    Error al cargar los datos: {error}
                </div>
            ) : (
                <>
                    {/* Documentation Section */}
                    {(activeTab === 'all' || activeTab === 'documentation') && (
                        <div>
                            <div className="mac-doc-section-header">
                                <h2 className="mac-doc-section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    {t('documentation')}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span className="mac-doc-section-count">{docs.length} elementos</span>
                                    {canManage && (
                                        <button 
                                            className="mac-btn mac-btn-secondary" 
                                            style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px' }}
                                            onClick={() => openCreate('documentation')}
                                        >
                                            + Añadir Documento
                                        </button>
                                    )}
                                </div>
                            </div>
                            {renderCardGrid(docs, t('noDocs'), 'doc')}
                        </div>
                    )}

                    {/* Resources Section */}
                    {(activeTab === 'all' || activeTab === 'resource') && (
                        <div>
                            <div className="mac-doc-section-header">
                                <h2 className="mac-doc-section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2">
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                    </svg>
                                    {t('resourcesTitle')}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span className="mac-doc-section-count">{resources.length} elementos</span>
                                    {canManage && (
                                        <button 
                                            className="mac-btn mac-btn-secondary" 
                                            style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px' }}
                                            onClick={() => openCreate('resource')}
                                        >
                                            + Añadir Recurso
                                        </button>
                                    )}
                                </div>
                            </div>
                            {renderCardGrid(resources, t('noResources'), 'resource')}
                        </div>
                    )}

                    {/* Information Section */}
                    {(activeTab === 'all' || activeTab === 'information') && (
                        <div>
                            <div className="mac-doc-section-header">
                                <h2 className="mac-doc-section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    {t('informationTitle') || 'Plantillas'}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span className="mac-doc-section-count">{information.length} elementos</span>
                                    {canManage && (
                                        <button 
                                            className="mac-btn mac-btn-secondary" 
                                            style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px' }}
                                            onClick={() => openCreate('information')}
                                        >
                                            + Añadir Plantilla
                                        </button>
                                    )}
                                </div>
                            </div>
                            {renderCardGrid(information, t('noInfo'), 'info')}
                        </div>
                    )}
                </>
            )}

            {/* Image Viewer Lightbox Modal */}
            {viewImage && (
                <div className="mac-modal-backdrop" onClick={() => setViewImage(null)} style={{ cursor: 'zoom-out' }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <img
                            src={viewImage}
                            alt="Full View"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '88vh',
                                objectFit: 'contain',
                                borderRadius: '16px',
                                boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
                                border: '1px solid rgba(255,255,255,0.15)'
                            }}
                        />
                        <button
                            className="mac-btn mac-btn-secondary"
                            style={{
                                position: 'absolute',
                                top: '-48px',
                                right: '0',
                                padding: '0.4rem 1rem'
                            }}
                            onClick={() => setViewImage(null)}
                        >
                            ✕ {t('closeBtn')}
                        </button>
                    </div>
                </div>
            )}

            {/* Text Viewer Modal */}
            {viewText && (
                <div className="mac-modal-backdrop" onClick={() => setViewText(null)}>
                    <div className="mac-modal-container" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 className="mac-modal-title" style={{ margin: 0 }}>{viewText.title}</h3>
                            <button className="mac-btn mac-btn-secondary" onClick={() => setViewText(null)}>
                                ✕ {t('closeBtnText')}
                            </button>
                        </div>
                        <div style={{
                            maxHeight: '60vh',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            color: '#cbd5e1',
                            fontSize: '0.95rem',
                            lineHeight: '1.65',
                            padding: '1.25rem',
                            background: 'rgba(0,0,0,0.4)',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            {viewText.description}
                        </div>
                        <div className="mac-modal-actions">
                            <button
                                className="mac-btn mac-btn-primary"
                                onClick={() => {
                                    navigator.clipboard.writeText(viewText.description);
                                    alert(t('copiedAlert'));
                                }}
                            >
                                📋 {t('copyClipboard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Form Modal */}
            {showModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="mac-modal-container" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mac-modal-title" style={{ marginBottom: '1rem' }}>
                            {modalMode === 'create' ? (
                                targetCategory === 'resource' ? (t('newResourceTitle') || 'Nuevo Recurso') :
                                targetCategory === 'information' ? (t('newInfoTitle') || 'Nueva Plantilla') :
                                (t('newDocTitle') || 'Nuevo Documento')
                            ) : (t('editItemTitle') || 'Editar Elemento')}
                        </h3>

                        {/* Interactive Category Selector */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label className="mac-form-label" style={{ marginBottom: '0.45rem', display: 'block', fontSize: '0.8rem', color: '#94a3b8' }}>
                                Tipo de publicación:
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                                <button
                                    type="button"
                                    className={`mac-btn ${targetCategory === 'documentation' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '0.65rem 0.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: targetCategory === 'documentation' ? 700 : 500,
                                        borderColor: targetCategory === 'documentation' ? 'var(--accent-primary, #38bdf8)' : 'rgba(255,255,255,0.1)'
                                    }}
                                    onClick={() => setTargetCategory('documentation')}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>📄</span>
                                    <span>Documentación</span>
                                </button>

                                <button
                                    type="button"
                                    className={`mac-btn ${targetCategory === 'resource' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '0.65rem 0.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: targetCategory === 'resource' ? 700 : 500,
                                        borderColor: targetCategory === 'resource' ? 'var(--accent-primary, #38bdf8)' : 'rgba(255,255,255,0.1)'
                                    }}
                                    onClick={() => setTargetCategory('resource')}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>🔗</span>
                                    <span>Recurso</span>
                                </button>

                                <button
                                    type="button"
                                    className={`mac-btn ${targetCategory === 'information' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '0.65rem 0.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: targetCategory === 'information' ? 700 : 500,
                                        borderColor: targetCategory === 'information' ? 'var(--accent-primary, #38bdf8)' : 'rgba(255,255,255,0.1)'
                                    }}
                                    onClick={() => setTargetCategory('information')}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>📝</span>
                                    <span>Plantilla</span>
                                </button>
                            </div>
                            <div style={{ marginTop: '0.45rem', fontSize: '0.74rem', color: '#64748b' }}>
                                {targetCategory === 'documentation' && 'Manuales, guías y documentos departamentales.'}
                                {targetCategory === 'resource' && 'Logos, enlaces externos, imágenes y utilidades operativas.'}
                                {targetCategory === 'information' && 'Plantillas de texto reutilizables para copiar al portapapeles con un clic.'}
                            </div>
                        </div>

                        <form onSubmit={handleAction}>
                            {(targetCategory === 'resource' || targetCategory === 'documentation') && (
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                    <button
                                        type="button"
                                        className={`mac-btn ${inputType === 'url' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem' }}
                                        onClick={() => setInputType('url')}
                                    >
                                        {t('externalUrlBtn') || 'URL Externa / Enlace'}
                                    </button>
                                    <button
                                        type="button"
                                        className={`mac-btn ${inputType === 'file' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem' }}
                                        onClick={() => setInputType('file')}
                                    >
                                        {t('uploadImageBtn') || 'Subir Imagen / Archivo'}
                                    </button>
                                </div>
                            )}

                            <div className="mac-form-group">
                                <label className="mac-form-label">{t('titleLabel') || 'Título'}</label>
                                <input
                                    className="mac-form-input"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder={
                                        targetCategory === 'information'
                                            ? "Ej: Formato de Notificación de Allanamiento..."
                                            : targetCategory === 'resource'
                                            ? "Ej: Logo SCUB / Roster Operativo..."
                                            : "Ej: Manual Balística / Guía de Procedimientos..."
                                    }
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {targetCategory === 'information' 
                                        ? (t('descRequired') || 'Contenido de la Plantilla (Obligatorio)') 
                                        : (t('descOptional') || 'Descripción (Opcional)')}
                                </label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows={targetCategory === 'information' ? 8 : 3}
                                    required={targetCategory === 'information'}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={
                                        targetCategory === 'information'
                                            ? "Escribe aquí la plantilla de texto que los agentes podrán leer y copiar con un clic..."
                                            : "Breve resumen o notas sobre este elemento..."
                                    }
                                />
                            </div>

                            {targetCategory !== 'information' && (
                                <div className="mac-form-group">
                                    <label className="mac-form-label">
                                        {inputType === 'file' ? (t('imageFileLabel') || 'Archivo / Imagen') : (t('extUrlLabel') || 'URL Externa')}
                                    </label>
                                    {inputType === 'file' ? (
                                        <div>
                                            <label className="mac-btn mac-btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                                                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                                📁 {formData.url && formData.url.startsWith('data:') ? (t('changeImage') || 'Cambiar Imagen') : (t('selectImage') || 'Seleccionar Imagen')}
                                            </label>
                                            {formData.url && formData.url.startsWith('data:') && (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#34d399' }}>
                                                    ✓ {t('imageSelected') || 'Imagen Seleccionada'}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            className="mac-form-input"
                                            required={inputType === 'url'}
                                            type="url"
                                            placeholder="https://..."
                                            value={formData.url.startsWith('data:') ? '' : formData.url}
                                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="mac-modal-actions">
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={() => setShowModal(false)}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" disabled={submitLoading}>
                                    {submitLoading ? (t('savingBtn') || 'Guardando...') : (t('saveBtn') || 'Guardar')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Documentation;

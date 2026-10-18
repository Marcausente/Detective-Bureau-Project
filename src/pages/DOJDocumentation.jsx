import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function DOJDocumentation() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [docs, setDocs] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'documentation', 'resource'

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [targetCategory, setTargetCategory] = useState('documentation');
    const [inputType, setInputType] = useState('url'); // 'url' or 'file'
    const [formData, setFormData] = useState({ title: '', description: '', url: '' });
    const [submitLoading, setSubmitLoading] = useState(false);

    // Image Viewer Lightbox
    const [viewImage, setViewImage] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('doj_documentation')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading DOJ docs:', error);
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
            let docUrl = formData.url;
            if (docUrl && docUrl.startsWith('data:')) {
                docUrl = await uploadImageToStorage(docUrl, 'documentation');
            }

            // Try RPC first
            let { error } = await supabase.rpc('manage_doj_documentation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_description: formData.description,
                p_url: docUrl,
                p_category: targetCategory
            });

            // If RPC fails (e.g. parameter mismatch), fallback to direct table operation
            if (error) {
                console.warn('RPC failed, falling back to direct table operation:', error);
                const { data: { user } } = await supabase.auth.getUser();
                if (modalMode === 'create') {
                    const fallback = await supabase
                        .from('doj_documentation')
                        .insert([{
                            title: formData.title,
                            description: formData.description,
                            url: docUrl,
                            category: targetCategory,
                            created_by: user ? user.id : null
                        }]);
                    if (fallback.error) throw fallback.error;
                } else if (modalMode === 'update') {
                    const fallback = await supabase
                        .from('doj_documentation')
                        .update({
                            title: formData.title,
                            description: formData.description,
                            url: docUrl,
                            category: targetCategory
                        })
                        .eq('id', editingId);
                    if (fallback.error) throw fallback.error;
                }
            }

            setShowModal(false);
            setFormData({ title: '', description: '', url: '' });
            loadData();

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(language === 'es' ? "¿Eliminar este documento legal?" : "Delete this document?")) return;
        try {
            const { error } = await supabase.rpc('manage_doj_documentation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) {
                const fallback = await supabase.from('doj_documentation').delete().eq('id', id);
                if (fallback.error) throw fallback.error;
            }
            loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert(language === 'es' ? "El archivo es demasiado grande (Máx 10MB)." : "File is too large (Max 10MB).");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                    canvas.width = img.width * scaleSize;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    setFormData({ ...formData, url: dataUrl });
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const openCreate = (category = 'documentation') => {
        setModalMode('create');
        setEditingId(null);
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

        setFormData({ title: doc.title, description: doc.description || '', url: doc.url || '' });
        setShowModal(true);
    };

    // Filter items based on activeTab and search
    const allItems = [...docs, ...resources];
    const filteredItems = (activeTab === 'all' ? allItems : (activeTab === 'documentation' ? docs : resources)).filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    });

    const filteredDocs = docs.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    });

    const filteredResources = resources.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    });

    return (
        <div className="mac-doc-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* macOS Documentation Command Banner */}
            <div 
                className="mac-doc-banner" 
                style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <img
                        src="/logowebp/doj-logo.webp"
                        alt="DOJ Logo"
                        style={{ height: '62px', width: 'auto', filter: 'drop-shadow(0 4px 14px rgba(245, 158, 11, 0.35))' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/logowebp/dojlogo.webp";
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/doj')}
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
                                    gap: '4px'
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al DOJ' : 'DOJ Hub'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'Repositorio Legal & Protocolos' : 'Legal Repository & Protocols'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.1rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'DOCUMENTACIÓN DEL DEPARTAMENTO DE JUSTICIA' : 'DOJ DOCUMENTATION & RESOURCES'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <div className="mac-doc-search-box">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                            type="text"
                            className="mac-doc-search-input"
                            placeholder={language === 'es' ? "Buscar protocolo o recurso..." : "Search legal document..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Add Document Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={() => openCreate('documentation')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.6rem 1.1rem',
                            background: 'rgba(245, 158, 11, 0.25)',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            color: '#fde68a',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Añadir Entrada' : 'New Document'}</span>
                    </button>
                </div>
            </div>

            {/* Segmented Filter Bar */}
            <div className="mac-doc-tabs" style={{ marginBottom: '2rem' }}>
                {[
                    { id: 'all', label: language === 'es' ? 'Todos los Registros' : 'All Records', count: allItems.length },
                    { id: 'documentation', label: language === 'es' ? 'Protocolos & Normativas' : 'Protocols & Codes', count: docs.length },
                    { id: 'resource', label: language === 'es' ? 'Enlaces & Recursos' : 'External Resources', count: resources.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`mac-doc-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            borderColor: activeTab === tab.id ? 'rgba(245, 158, 11, 0.4)' : 'transparent',
                            backgroundColor: activeTab === tab.id ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                            color: activeTab === tab.id ? '#ffffff' : '#94a3b8'
                        }}
                    >
                        <span>{tab.label}</span>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Documentation Cards Grid */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#f59e0b', width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginBottom: '0.5rem' }}></span>
                    <div>{language === 'es' ? 'Cargando biblioteca jurídica...' : 'Loading DOJ repository...'}</div>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                        {language === 'es' ? 'No se encontraron documentos' : 'No documents found'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Use el botón superior para publicar una nueva directriz' : 'Use the button above to add legal entries'}
                    </div>
                </div>
            ) : (
                <div className="mac-doc-cards-grid">
                    {filteredItems.map(item => {
                        const isImage = item.url && (item.url.startsWith('data:image') || item.url.match(/\.(jpeg|jpg|gif|png|webp)/i));
                        const isResource = item.category === 'resource';

                        return (
                            <div
                                key={item.id}
                                className="mac-doc-card"
                                onClick={(e) => {
                                    if (isImage) {
                                        e.preventDefault();
                                        setViewImage(item.url);
                                    }
                                }}
                                style={{
                                    cursor: isImage ? 'zoom-in' : 'pointer',
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}
                            >
                                {/* Floating actions on hover */}
                                <div className="mac-doc-card-actions">
                                    <button
                                        className="mac-doc-action-icon-btn"
                                        title={language === 'es' ? 'Editar' : 'Edit'}
                                        onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="mac-doc-action-icon-btn delete"
                                        title={language === 'es' ? 'Eliminar' : 'Delete'}
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>

                                <a
                                    href={isImage ? undefined : item.url}
                                    target={isImage ? undefined : "_blank"}
                                    rel={isImage ? undefined : "noopener noreferrer"}
                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}
                                    onClick={(e) => isImage && e.preventDefault()}
                                >
                                    <div>
                                        <div className={`mac-doc-card-badge ${isResource ? 'resource' : 'doc'}`} style={{
                                            background: isResource ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.05))' : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))',
                                            borderColor: isResource ? 'rgba(168, 85, 247, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                                            color: isResource ? '#c084fc' : '#fbbf24'
                                        }}>
                                            {isImage ? (
                                                <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                            ) : isResource ? (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                                </svg>
                                            ) : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                    <polyline points="14 2 14 8 20 8"/>
                                                </svg>
                                            )}
                                        </div>

                                        <h3 className="mac-doc-card-title">{item.title}</h3>
                                        {item.description && (
                                            <p className="mac-doc-card-desc">{item.description}</p>
                                        )}
                                    </div>

                                    <div className="mac-doc-card-footer" style={{ color: isResource ? '#c084fc' : '#fbbf24', marginTop: 'auto' }}>
                                        <span>
                                            {isImage 
                                                ? (language === 'es' ? 'Ver Imagen Completa ↗' : 'View Image ↗') 
                                                : (isResource ? (language === 'es' ? 'Abrir Enlace Externo ↗' : 'Open Link ↗') : (language === 'es' ? 'Consultar Documento ↗' : 'Read Protocol ↗'))}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <line x1="7" y1="17" x2="17" y2="7"/>
                                            <polyline points="7 7 17 7 17 17"/>
                                        </svg>
                                    </div>
                                </a>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* macOS Modal for Adding / Editing Document */}
            {showModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="mac-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                DOJ • LEGAL PROTOCOL
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                            {modalMode === 'create' 
                                ? (language === 'es' ? 'Añadir Entrada Legal' : 'New Legal Document') 
                                : (language === 'es' ? 'Modificar Registro' : 'Edit Document')}
                        </h2>
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
                            {language === 'es' 
                                ? 'Complete los campos para publicar documentación procesal o enlaces periciales.' 
                                : 'Fill in the fields to publish protocol manuals or external references.'}
                        </p>

                        <form onSubmit={handleAction}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Categoría *' : 'Category *'}</label>
                                <select
                                    className="mac-form-select"
                                    value={targetCategory}
                                    onChange={(e) => setTargetCategory(e.target.value)}
                                >
                                    <option value="documentation">{language === 'es' ? 'Documentación / Protocolo Legal' : 'Legal Protocol / Directive'}</option>
                                    <option value="resource">{language === 'es' ? 'Recurso / Enlace Externo' : 'External Resource / Tool'}</option>
                                </select>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Título *' : 'Title *'}</label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    required
                                    placeholder={language === 'es' ? "Ej: Código Penal Art. 21 — Procedimiento de Arresto" : "e.g. Penal Code Protocol - Search Warrants"}
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Descripción o Resumen' : 'Description'}</label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows="3"
                                    placeholder={language === 'es' ? "Breve sinopsis del contenido o alcance de la directriz..." : "Brief summary of the document contents..."}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Tipo de Contenido / Enlace' : 'Source Type'}</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setInputType('url')}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            background: inputType === 'url' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.06)',
                                            border: `1px solid ${inputType === 'url' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                                            color: inputType === 'url' ? '#fde68a' : '#cbd5e1'
                                        }}
                                    >
                                        🔗 {language === 'es' ? 'URL Web' : 'Web Link'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputType('file')}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            background: inputType === 'file' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.06)',
                                            border: `1px solid ${inputType === 'file' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                                            color: inputType === 'file' ? '#fde68a' : '#cbd5e1'
                                        }}
                                    >
                                        📷 {language === 'es' ? 'Subir Imagen' : 'Upload Image'}
                                    </button>
                                </div>

                                {inputType === 'url' ? (
                                    <input
                                        type="url"
                                        className="mac-form-input"
                                        placeholder="https://..."
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    />
                                ) : (
                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0.85rem',
                                            border: '1px dashed rgba(255, 255, 255, 0.2)',
                                            borderRadius: '12px',
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            color: '#cbd5e1',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}>
                                            <span>{formData.url ? (language === 'es' ? 'Imagen Seleccionada (Clic para cambiar)' : 'Photo Ready (Click to change)') : (language === 'es' ? 'Seleccionar Imagen (PNG, JPG, WebP)' : 'Choose Image')}</span>
                                            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                        </label>
                                        {formData.url && formData.url.startsWith('data:') && (
                                            <div style={{ marginTop: '0.75rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', maxHeight: '160px' }}>
                                                <img src={formData.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitLoading}
                                    style={{
                                        background: 'linear-gradient(135deg, #d97706, #b45309)',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        cursor: submitLoading ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)'
                                    }}
                                >
                                    {submitLoading ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar' : 'Save Document')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {viewImage && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.88)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        zIndex: 999999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'zoom-out',
                        padding: '1.5rem'
                    }}
                    onClick={() => setViewImage(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }}>
                        <img
                            src={viewImage}
                            alt="Full View"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '90vh',
                                objectFit: 'contain',
                                borderRadius: '16px',
                                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.15)'
                            }}
                        />
                        <button
                            onClick={() => setViewImage(null)}
                            style={{
                                position: 'absolute',
                                top: '-42px',
                                right: '0',
                                background: 'rgba(255, 255, 255, 0.15)',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                color: '#ffffff',
                                borderRadius: '9999px',
                                padding: '0.35rem 0.85rem',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            ✕ {language === 'es' ? 'Cerrar' : 'Close'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJDocumentation;

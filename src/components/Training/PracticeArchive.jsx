import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { dtpService } from '../../services/dtpService';
import '../../pages/Training/Training.css'; // Use shared styles

function PracticeArchive({ userProfile }) {
    const [practices, setPractices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    // View state
    const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'details', 'edit'
    const [selectedPractice, setSelectedPractice] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserProfile, setCurrentUserProfile] = useState(userProfile || null);
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        documentUrl: '' 
    });
    const [documentUrls, setDocumentUrls] = useState([]);
    const [allowedUsers, setAllowedUsers] = useState([]);
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user);
                if (!currentUserProfile) {
                    try {
                        const { data: profile, error } = await supabase
                            .from('users')
                            .select('id, nombre, apellido, rango, no_placa, rol')
                            .eq('id', session.user.id)
                            .single();
                        if (!error && profile) {
                            setCurrentUserProfile(profile);
                        }
                    } catch (err) {
                        console.error('Error fetching profile in PracticeArchive:', err);
                    }
                }
            }
        };
        fetchInitialData();
    }, [userProfile]);

    useEffect(() => {
        if (viewMode === 'list') {
            loadPractices();
        }
    }, [viewMode]);

    const loadPractices = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await dtpService.getPractices();
            setPractices(data);
        } catch (err) {
            console.error('Error loading practices:', err);
            setError('Error al cargar las prácticas.');
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, nombre, apellido, rango, no_placa, rol')
                .order('nombre', { ascending: true });
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error loading users list:', err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddUrl = () => {
        if (formData.documentUrl.trim() !== '') {
            setDocumentUrls([...documentUrls, formData.documentUrl.trim()]);
            setFormData(prev => ({ ...prev, documentUrl: '' }));
        }
    };

    const handleRemoveUrl = (indexToRemove) => {
        setDocumentUrls(documentUrls.filter((_, index) => index !== indexToRemove));
    };

    const handleToggleUser = (userId) => {
        setAllowedUsers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const isAlwaysAllowedRole = (roleName) => {
        if (!roleName) return false;
        const r = roleName.toLowerCase();
        return ['coordinador', 'comisionado', 'administrador', 'superadmin'].includes(r);
    };

    const canViewDocuments = (practice) => {
        if (!practice) return false;
        if (!currentUserProfile) return false;
        
        const role = currentUserProfile.rol ? currentUserProfile.rol.toLowerCase() : '';
        if (['coordinador', 'comisionado', 'administrador', 'superadmin'].includes(role)) {
            return true;
        }
        
        if (practice.author_id === currentUserProfile.id) {
            return true;
        }
        
        if (practice.allowed_users && Array.isArray(practice.allowed_users)) {
            return practice.allowed_users.includes(currentUserProfile.id);
        }
        
        return false;
    };

    const prepareCreate = () => {
        setFormData({ title: '', description: '', documentUrl: '' });
        setDocumentUrls([]);
        setAllowedUsers([]);
        setUserSearch('');
        setViewMode('create');
        loadUsers();
    };

    const prepareEdit = (practice) => {
        setSelectedPractice(practice);
        setFormData({
            title: practice.title,
            description: practice.description || '',
            documentUrl: ''
        });
        setDocumentUrls(practice.documents_urls || []);
        setAllowedUsers(practice.allowed_users || []);
        setUserSearch('');
        setViewMode('edit');
        loadUsers();
    };

    const viewDetails = (practice) => {
        setSelectedPractice(practice);
        setViewMode('details');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        
        if (!formData.title.trim()) {
            setError('El título es obligatorio.');
            setLoading(false);
            return;
        }

        // Si el usuario escribió un enlace pero olvidó darle a "+ Añadir Link", lo añadimos automáticamente
        let finalUrls = [...documentUrls];
        if (formData.documentUrl && formData.documentUrl.trim() !== '') {
            finalUrls.push(formData.documentUrl.trim());
        }

        try {
            const practiceData = {
                title: formData.title,
                description: formData.description,
                documents_urls: finalUrls,
                allowed_users: allowedUsers
            };

            if (viewMode === 'create') {
                if (currentUser) practiceData.author_id = currentUser.id;
                await dtpService.createPractice(practiceData);
                setSuccessMessage('Práctica creada con éxito.');
            } else if (viewMode === 'edit') {
                await dtpService.updatePractice(selectedPractice.id, practiceData);
                setSuccessMessage('Práctica actualizada con éxito.');
            }
            
            setFormData({ title: '', description: '', documentUrl: '' });
            setDocumentUrls([]);
            setAllowedUsers([]);
            
            setTimeout(() => {
                setSuccessMessage(null);
                setViewMode('list');
            }, 1500);
            
        } catch (err) {
            console.error('Error saving practice:', err);
            setError('Error al guardar la práctica.');
            setLoading(false);
        }
    };

    const handleDelete = async (id, skipConfirm = false) => {
        const isHighCmd = currentUserProfile && ['coordinador', 'comisionado', 'administrador', 'superadmin'].includes(currentUserProfile.rol?.toLowerCase());
        if (!isHighCmd) {
            setError('No tienes permisos para eliminar prácticas del archivo.');
            return;
        }
        if (!skipConfirm && !window.confirm('¿Seguro que quieres eliminar esta práctica? Esto eliminará también los eventos programados para esta práctica.')) {
            return;
        }
        
        try {
            await dtpService.deletePractice(id);
            if (viewMode === 'details' || viewMode === 'edit') {
                setViewMode('list');
            } else {
                loadPractices();
            }
            setSuccessMessage('Práctica eliminada.');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error deleting practice:', err);
            setError('Error al eliminar la práctica.');
        }
    };

    return (
        <div style={{ animation: 'macFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {error && (
                <div style={{ color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {error}
                </div>
            )}
            {successMessage && (
                <div style={{ color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '0.85rem 1rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {successMessage}
                </div>
            )}

            {viewMode === 'list' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div className="dtp-search-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar en archivo de prácticas..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                            />
                            {userSearch && (
                                <button type="button" onClick={() => setUserSearch('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                            )}
                        </div>

                        <button className="dtp-btn-primary" onClick={prepareCreate}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Nueva Práctica
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                                Cargando archivo de prácticas DTP...
                            </div>
                        </div>
                    ) : practices.length === 0 ? (
                        <div className="dtp-glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <p style={{ color: '#cbd5e1', fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.4rem 0' }}>No hay prácticas registradas en el archivo.</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Crea plantillas para usarlas en futuras programaciones.</p>
                        </div>
                    ) : (
                        <div className="dtp-grid">
                            {practices.filter(p => {
                                if (!userSearch.trim()) return true;
                                const term = userSearch.toLowerCase();
                                return p.title?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term);
                            }).map(practice => (
                                <div key={practice.id} className="dtp-glass-card" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => viewDetails(practice)}>
                                    <h3 className="dtp-card-title">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        {practice.title}
                                    </h3>
                                    
                                    <p className="dtp-card-desc" style={{ flex: 1 }}>
                                        {practice.description ? (practice.description.length > 100 ? practice.description.substring(0, 100) + '...' : practice.description) : 'Sin descripción especificada.'}
                                    </p>
                                    
                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                                        <span>Subido por: <strong style={{ color: '#f8fafc' }}>{practice.author ? `${practice.author.rango} ${practice.author.apellido}` : 'Desconocido'}</strong></span>
                                    </div>
                                    
                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '1rem' }}>
                                        {practice.documents_urls && practice.documents_urls.length > 0 ? (
                                            canViewDocuments(practice) ? (
                                                <span style={{ color: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                                    {practice.documents_urls.length} documento(s) adjunto(s)
                                                </span>
                                            ) : (
                                                <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                                    Documentos (Restringido)
                                                </span>
                                            )
                                        ) : (
                                            <span>No hay documentos</span>
                                        )}
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <button className="dtp-btn-secondary" style={{ padding: '0.38rem 0.85rem', fontSize: '0.78rem' }} onClick={(e) => { e.stopPropagation(); viewDetails(practice); }}>
                                            Ver Detalles
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {(viewMode === 'create' || viewMode === 'edit') && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{ maxWidth: '720px', width: '92vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', background: 'rgba(30, 41, 59, 0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '1.5rem', boxSizing: 'border-box' }}>
                        {/* Titlebar with window dots */}
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => viewMode === 'edit' ? setViewMode('details') : setViewMode('list')} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {viewMode === 'create' ? 'Cargar Nueva Práctica al Archivo' : 'Editar Práctica'}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="dtp-input-group" style={{ marginBottom: '1rem' }}>
                                <label className="dtp-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Título de la Práctica *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Ej: Operativo Anti-Pandillas Nivel 1"
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem', boxSizing: 'border-box' }}
                                />
                            </div>
                            
                            <div className="dtp-input-group" style={{ marginBottom: '1rem' }}>
                                <label className="dtp-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Descripción Detallada</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows="5"
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
                                    placeholder="Objetivos, alcance y metodología..."
                                />
                            </div>

                            <div className="dtp-input-group" style={{ marginBottom: '1rem' }}>
                                <label className="dtp-label" style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Añadir Documentos (GDocs, PDFs, etc.)</label>
                                <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
                                    <input
                                        type="url"
                                        name="documentUrl"
                                        value={formData.documentUrl}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddUrl();
                                            }
                                        }}
                                        placeholder="https://docs.google.com/..."
                                        style={{ flex: 1, background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                    />
                                    <button type="button" onClick={handleAddUrl} className="dtp-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                                        + Añadir Link
                                    </button>
                                </div>
                                
                                {documentUrls.length > 0 && (
                                    <div style={{ background: 'rgba(15, 23, 42, 0.65)', borderRadius: '10px', padding: '0.85rem', border: '1px solid rgba(255,255,255,0.12)' }}>
                                        <h5 style={{ margin: '0 0 0.6rem 0', color: '#94a3b8', fontSize: '0.82rem' }}>Enlaces Adjuntos:</h5>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                            {documentUrls.map((url, idx) => (
                                                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: idx < documentUrls.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none' }}>
                                                    <span style={{ color: '#93c5fd', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                                        {url}
                                                    </span>
                                                    <button type="button" onClick={() => handleRemoveUrl(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', padding: '0 0.5rem' }}>
                                                        ✕
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="dtp-input-group" style={{ marginTop: '1.25rem' }}>
                                <label className="dtp-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fde047', fontWeight: 700, marginBottom: '0.35rem' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Control de Acceso al Documento
                                </label>
                                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0 0 0.75rem 0' }}>
                                    Por defecto, mandos y administradores tienen acceso automático. Marca a los agentes adicionales que deben poder ver los documentos adjuntos.
                                </p>
                                
                                <input
                                    type="text"
                                    placeholder="Buscar agente por nombre, rango o rol..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.82rem', padding: '0.55rem 0.85rem', marginBottom: '0.6rem', boxSizing: 'border-box' }}
                                />

                                <div style={{ 
                                    background: 'rgba(15, 23, 42, 0.65)', 
                                    border: '1px solid rgba(255, 255, 255, 0.12)', 
                                    borderRadius: '10px', 
                                    maxHeight: '200px', 
                                    overflowY: 'auto', 
                                    padding: '0.65rem' 
                                }} className="custom-scrollbar">
                                    {users.filter(u => {
                                        if (!userSearch.trim()) return true;
                                        const search = userSearch.toLowerCase();
                                        const nombreFull = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
                                        const rango = (u.rango || '').toLowerCase();
                                        const placa = (u.no_placa || '').toLowerCase();
                                        const rol = (u.rol || '').toLowerCase();
                                        return nombreFull.includes(search) || rango.includes(search) || placa.includes(search) || rol.includes(search);
                                    }).map(u => {
                                        const isAlways = isAlwaysAllowedRole(u.rol);
                                        const isChecked = isAlways || allowedUsers.includes(u.id);
                                        
                                        return (
                                            <label key={u.id} style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between', 
                                                padding: '0.45rem 0.75rem', 
                                                marginBottom: '0.35rem', 
                                                background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                                                border: isChecked ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255,255,255,0.04)',
                                                borderRadius: '8px', 
                                                cursor: isAlways ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s ease',
                                                opacity: isAlways ? 0.75 : 1
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        disabled={isAlways}
                                                        onChange={() => handleToggleUser(u.id)}
                                                        style={{ width: '15px', height: '15px', cursor: isAlways ? 'not-allowed' : 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '0.85rem', color: isChecked ? '#fff' : '#cbd5e1' }}>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginRight: '0.4rem' }}>[{u.rango || 'Rango N/A'}]</span>
                                                        {u.nombre} {u.apellido}
                                                        {u.no_placa && <span style={{ color: '#fbbf24', fontSize: '0.75rem', marginLeft: '0.4rem', fontFamily: 'monospace' }}>#{u.no_placa}</span>}
                                                    </span>
                                                </div>
                                                
                                                <span style={{ 
                                                    fontSize: '0.72rem', 
                                                    fontWeight: 600,
                                                    padding: '2px 7px', 
                                                    borderRadius: '6px',
                                                    background: isAlways ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                    color: isAlways ? '#4ade80' : '#94a3b8',
                                                    border: isAlways ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                                                }}>
                                                    {u.rol || 'Agente'}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="dtp-btn-secondary" onClick={() => viewMode === 'edit' ? setViewMode('details') : setViewMode('list')} disabled={loading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="dtp-btn-primary" disabled={loading}>
                                    {viewMode === 'create' ? 'Guardar Práctica' : 'Actualizar Práctica'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewMode === 'details' && selectedPractice && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{ maxWidth: '840px', width: '92vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', background: 'rgba(30, 41, 59, 0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '1.5rem', boxSizing: 'border-box' }}>
                        {/* Titlebar with window dots */}
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setViewMode('list')} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    Detalle de la Práctica
                                </h3>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {canViewDocuments(selectedPractice) && (
                                    <button className="dtp-btn-secondary" onClick={() => prepareEdit(selectedPractice)}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        Editar
                                    </button>
                                )}
                                {currentUserProfile && ['coordinador', 'comisionado', 'administrador', 'superadmin'].includes(currentUserProfile.rol?.toLowerCase()) && (
                                    <button className="dtp-btn-danger" onClick={() => handleDelete(selectedPractice.id)}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: '0 0 0.4rem 0', color: '#f8fafc', fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {selectedPractice.title}
                                </h2>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                                    Subido por: <strong style={{ color: '#f8fafc' }}>{selectedPractice.author ? `${selectedPractice.author.rango} ${selectedPractice.author.nombre} ${selectedPractice.author.apellido}` : 'Agente Desconocido'}</strong> • Creado el: {new Date(selectedPractice.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>

                            <div>
                                <h4 style={{ color: '#93c5fd', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                    Descripción de la Práctica
                                </h4>
                                <div style={{ color: '#f8fafc', fontSize: '0.92rem', lineHeight: '1.7', background: 'rgba(15, 23, 42, 0.65)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'pre-wrap' }}>
                                    {selectedPractice.description || <span style={{ color: '#64748b', fontStyle: 'italic' }}>No hay descripción proporcionada para esta práctica.</span>}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ color: '#a5b4fc', marginBottom: '0.65rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                    Documentos de la Práctica
                                </h4>
                                
                                {canViewDocuments(selectedPractice) ? (
                                    selectedPractice.documents_urls && selectedPractice.documents_urls.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
                                            {selectedPractice.documents_urls.map((url, idx) => (
                                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                    <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.85rem', transition: 'all 0.2s', cursor: 'pointer' }}>
                                                        <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '0.6rem', borderRadius: '8px', color: '#93c5fd' }}>
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                                        </div>
                                                        <div style={{ overflow: 'hidden', flex: 1 }}>
                                                            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem', marginBottom: '2px' }}>Documento {idx + 1}</div>
                                                            <div style={{ color: '#93c5fd', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</div>
                                                        </div>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            Esta práctica no contiene documentos adjuntos adicionales.
                                        </div>
                                    )
                                ) : (
                                    <div style={{ 
                                        background: 'rgba(239, 68, 68, 0.08)', 
                                        padding: '1.75rem 1.5rem', 
                                        borderRadius: '12px', 
                                        border: '1px dashed rgba(239, 68, 68, 0.3)', 
                                        textAlign: 'center', 
                                        color: '#f87171',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.6rem'
                                    }}>
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>Acceso Restringido</div>
                                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', maxWidth: '480px', lineHeight: '1.5' }}>
                                            Los documentos adjuntos de esta práctica son de carácter confidencial. Solo están visibles para mandos, administradores o personal autorizado.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PracticeArchive;

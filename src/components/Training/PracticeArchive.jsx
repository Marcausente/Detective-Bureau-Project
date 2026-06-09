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
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {error && <div className="error-message" style={{ marginBottom: '1rem', borderRadius: '8px' }}>{error}</div>}
            {successMessage && <div className="success-message" style={{ marginBottom: '1rem', borderRadius: '8px' }}>{successMessage}</div>}

            {viewMode === 'list' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                        <button className="dtp-btn-primary" onClick={prepareCreate}>
                            <span>+</span> Nueva Práctica
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>Cargando archivo...</div>
                    ) : practices.length === 0 ? (
                        <div className="dtp-glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📁</div>
                            <p style={{ color: '#a0aec0', fontSize: '1.1rem' }}>No hay prácticas registradas en el archivo.</p>
                            <p style={{ color: '#718096', fontSize: '0.9rem' }}>Crea plantillas para usarlas en futuras programaciones.</p>
                        </div>
                    ) : (
                        <div className="dtp-grid">
                            {practices.map(practice => (
                                <div key={practice.id} className="dtp-glass-card" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => viewDetails(practice)}>
                                    <h3 className="dtp-card-title">
                                        <span style={{ color: '#cbd5e0' }}>📄</span> {practice.title}
                                    </h3>
                                    
                                    <p className="dtp-card-desc" style={{ flex: 1 }}>
                                        {practice.description ? (practice.description.length > 100 ? practice.description.substring(0, 100) + '...' : practice.description) : 'Sin descripción especificada.'}
                                    </p>
                                    
                                    <div style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                        <span>Subido por: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{practice.author ? `${practice.author.rango} ${practice.author.apellido}` : 'Desconocido'}</span></span>
                                    </div>
                                    
                                    <div style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                        {practice.documents_urls && practice.documents_urls.length > 0 ? (
                                            canViewDocuments(practice) ? (
                                                <span>📎 {practice.documents_urls.length} documento(s) adjunto(s)</span>
                                            ) : (
                                                <span style={{ color: '#a0aec0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <span style={{ color: '#cbd5e0' }}>🔒</span> Documentos (Restringido)
                                                </span>
                                            )
                                        ) : (
                                            <span>No hay documentos</span>
                                        )}
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button className="dtp-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); viewDetails(practice); }}>
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
                <div className="dtp-form-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 600 }}>
                            {viewMode === 'create' ? 'Cargar Nueva Práctica al Archivo' : 'Editar Práctica'}
                        </h3>
                        <button className="dtp-btn-secondary" onClick={() => viewMode === 'edit' ? setViewMode('details') : setViewMode('list')}>
                            Cancelar
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="dtp-input-group">
                            <label className="dtp-label">Título de la Práctica *</label>
                            <input
                                type="text"
                                className="dtp-input"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                placeholder="Ej: Operativo Anti-Pandillas Nivel 1"
                            />
                        </div>
                        
                        <div className="dtp-input-group">
                            <label className="dtp-label">Descripción Detallada</label>
                            <textarea
                                className="dtp-input"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="8"
                                style={{ resize: 'vertical' }}
                                placeholder="Objetivos, alcance y metodología..."
                            />
                        </div>

                        <div className="dtp-input-group">
                            <label className="dtp-label">Añadir Documentos (GDocs, PDFs, etc.)</label>
                            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem' }}>
                                <input
                                    type="url"
                                    className="dtp-input"
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
                                />
                                <button type="button" onClick={handleAddUrl} className="dtp-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                                    + Añadir Link
                                </button>
                            </div>
                            
                            {documentUrls.length > 0 && (
                                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <h5 style={{ margin: '0 0 0.8rem 0', color: '#a0aec0', fontSize: '0.9rem' }}>Enlaces Adjuntos:</h5>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {documentUrls.map((url, idx) => (
                                            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: idx < documentUrls.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none' }}>
                                                <span style={{ color: '#63b3ed', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                                    {url}
                                                </span>
                                                <button type="button" onClick={() => handleRemoveUrl(idx)} style={{ background: 'none', border: 'none', color: '#fc8181', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>
                                                    &times;
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="dtp-input-group" style={{ marginTop: '2rem' }}>
                            <label className="dtp-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🔒</span> Control de Acceso al Documento
                            </label>
                            <p style={{ color: '#a0aec0', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                                Por defecto, coordinadores, comisionados y administradores tienen acceso automático. Marca a los agentes adicionales que deben poder ver los documentos adjuntos de esta práctica.
                            </p>
                            
                            <input
                                type="text"
                                className="dtp-input"
                                placeholder="Buscar agente por nombre, rango o rol..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                style={{ marginBottom: '0.8rem', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                            />

                            <div style={{ 
                                background: 'rgba(0, 0, 0, 0.25)', 
                                border: '1px solid rgba(255, 255, 255, 0.08)', 
                                borderRadius: '10px', 
                                maxHeight: '220px', 
                                overflowY: 'auto', 
                                padding: '0.8rem' 
                            }}>
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
                                            padding: '0.5rem 0.8rem', 
                                            marginBottom: '0.4rem', 
                                            background: isChecked ? 'rgba(66, 153, 225, 0.08)' : 'rgba(255,255,255,0.02)',
                                            border: isChecked ? '1px solid rgba(66, 153, 225, 0.25)' : '1px solid rgba(255,255,255,0.03)',
                                            borderRadius: '6px', 
                                            cursor: isAlways ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            opacity: isAlways ? 0.7 : 1
                                        }}
                                        onMouseOver={(e) => { if (!isAlways) e.currentTarget.style.background = 'rgba(66, 153, 225, 0.15)'; }}
                                        onMouseOut={(e) => { if (!isAlways) e.currentTarget.style.background = isChecked ? 'rgba(66, 153, 225, 0.08)' : 'rgba(255,255,255,0.02)'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={isAlways}
                                                    onChange={() => handleToggleUser(u.id)}
                                                    style={{ width: '16px', height: '16px', cursor: isAlways ? 'not-allowed' : 'pointer' }}
                                                />
                                                <span style={{ fontSize: '0.9rem', color: isChecked ? '#fff' : '#cbd5e0' }}>
                                                    <span style={{ color: '#a0aec0', fontSize: '0.8rem', marginRight: '0.4rem' }}>[{u.rango || 'Rango N/A'}]</span>
                                                    {u.nombre} {u.apellido}
                                                    {u.no_placa && <span style={{ color: '#718096', fontSize: '0.8rem', marginLeft: '0.4rem' }}>(Placa {u.no_placa})</span>}
                                                </span>
                                            </div>
                                            
                                            <span style={{ 
                                                fontSize: '0.75rem', 
                                                padding: '0.15rem 0.5rem', 
                                                borderRadius: '4px',
                                                background: isAlways ? 'rgba(72, 187, 120, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                color: isAlways ? '#68d391' : '#a0aec0',
                                                border: isAlways ? '1px solid rgba(72, 187, 120, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                                            }}>
                                                {u.rol || 'Agente'}
                                            </span>
                                        </label>
                                    );
                                })}
                                {users.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#718096', padding: '1rem', fontSize: '0.9rem' }}>
                                        No hay usuarios disponibles en el sistema.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button type="submit" className="dtp-btn-primary" disabled={loading}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                {viewMode === 'create' ? 'Guardar Práctica' : 'Actualizar Práctica'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {viewMode === 'details' && selectedPractice && (
                <div className="dtp-glass-card" style={{ padding: '2.5rem', maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ margin: '0 0 0.8rem 0', color: '#e2e8f0', fontSize: '2.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <span style={{ color: '#4299e1' }}>📄</span> {selectedPractice.title}
                            </h2>
                            <p style={{ margin: 0, color: '#718096', fontSize: '0.95rem' }}>
                                Subido por: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedPractice.author ? `${selectedPractice.author.rango} ${selectedPractice.author.nombre} ${selectedPractice.author.apellido}` : 'Agente Desconocido'}</span> • Creado el: {new Date(selectedPractice.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            {canViewDocuments(selectedPractice) && (
                                <>
                                    <button className="dtp-btn-secondary" onClick={() => prepareEdit(selectedPractice)}>
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '6px'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        Editar
                                    </button>
                                    <button className="dtp-btn-danger" onClick={() => handleDelete(selectedPractice.id)}>
                                        Eliminar
                                    </button>
                                </>
                            )}
                            <button className="dtp-btn-secondary" onClick={() => setViewMode('list')} style={{ marginLeft: '1rem' }}>
                                Volver al Archivo
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        <div>
                            <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="22" height="22" fill="none" stroke="#63b3ed" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Descripción de la Práctica
                            </h4>
                            <div style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: '1.8', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap' }}>
                                {selectedPractice.description || <span style={{ color: '#718096', fontStyle: 'italic' }}>No hay descripción proporcionada para esta práctica.</span>}
                            </div>
                        </div>

                        <div>
                            <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="22" height="22" fill="none" stroke="#9f7aea" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                Documentos de la Práctica
                            </h4>
                            
                            {canViewDocuments(selectedPractice) ? (
                                selectedPractice.documents_urls && selectedPractice.documents_urls.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                        {selectedPractice.documents_urls.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                                <div style={{ background: 'rgba(159, 122, 234, 0.1)', border: '1px solid rgba(159, 122, 234, 0.3)', padding: '1.2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s', cursor: 'pointer' }}
                                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                                    
                                                    <div style={{ background: 'rgba(159, 122, 234, 0.2)', padding: '0.8rem', borderRadius: '8px', color: '#d6bcfa' }}>
                                                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                                    </div>
                                                    <div style={{ overflow: 'hidden' }}>
                                                        <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '0.2rem' }}>Documento {idx + 1}</div>
                                                        <div style={{ color: '#9fa6b2', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</div>
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: '#a0aec0' }}>
                                        Esta práctica no contiene documentos adjuntos adicionales.
                                    </div>
                                )
                            ) : (
                                <div style={{ 
                                    background: 'rgba(229, 62, 62, 0.05)', 
                                    padding: '2.5rem 2rem', 
                                    borderRadius: '12px', 
                                    border: '1px dashed rgba(229, 62, 62, 0.3)', 
                                    textAlign: 'center', 
                                    color: '#feb2b2',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.8rem'
                                }}>
                                    <span style={{ fontSize: '2rem' }}>🔒</span>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#fff' }}>Acceso Restringido</div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e0', maxWidth: '500px', lineHeight: '1.5' }}>
                                        Los documentos adjuntos de esta práctica son de carácter confidencial. Solo están visibles para coordinadores, comisionados, administradores o personal expresamente autorizado al momento de crear la práctica.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PracticeArchive;

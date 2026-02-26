import React, { useState, useEffect } from 'react';
import { dtpService } from '../../services/dtpService';
import '../../pages/Training/Training.css'; // Use shared styles

function PracticeArchive() {
    const [practices, setPractices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    // View state
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'create'
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        documentUrl: '' 
    });
    const [documentUrls, setDocumentUrls] = useState([]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        
        if (!formData.title.trim()) {
            setError('El título es obligatorio.');
            return;
        }

        try {
            const newPractice = {
                title: formData.title,
                description: formData.description,
                documents_urls: documentUrls
            };
            
            await dtpService.createPractice(newPractice);
            setSuccessMessage('Práctica creada con éxito.');
            
            setFormData({ title: '', description: '', documentUrl: '' });
            setDocumentUrls([]);
            
            setTimeout(() => {
                setSuccessMessage(null);
                setViewMode('list');
            }, 1500);
            
        } catch (err) {
            console.error('Error creating practice:', err);
            setError('Error al crear la práctica.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Seguro que quieres eliminar esta práctica? Esto eliminará también los eventos programados para esta práctica.')) {
            return;
        }
        
        try {
            await dtpService.deletePractice(id);
            loadPractices();
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
                        <button className="dtp-btn-primary" onClick={() => setViewMode('create')}>
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
                                <div key={practice.id} className="dtp-glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h3 className="dtp-card-title">
                                        <span style={{ color: '#cbd5e0' }}>📄</span> {practice.title}
                                    </h3>
                                    
                                    <p className="dtp-card-desc" style={{ flex: 1 }}>
                                        {practice.description || 'Sin descripción especificada.'}
                                    </p>
                                    
                                    {practice.documents_urls && practice.documents_urls.length > 0 && (
                                        <div style={{ margin: '1rem 0' }}>
                                            <h4 style={{ color: '#e2e8f0', fontSize: '0.9rem', marginBottom: '0.8rem', fontWeight: 600 }}>Material de Estudio:</h4>
                                            <ul className="dtp-docs-list">
                                                {practice.documents_urls.map((url, idx) => (
                                                    <li key={idx} className="dtp-doc-item">
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="dtp-doc-link">
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                            Documento de Apoyo {idx + 1}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button className="dtp-btn-danger" onClick={() => handleDelete(practice.id)}>
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {viewMode === 'create' && (
                <div className="dtp-form-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 600 }}>Cargar Nueva Práctica al Archivo</h3>
                        <button className="dtp-btn-secondary" onClick={() => setViewMode('list')}>
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
                                rows="5"
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

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button type="submit" className="dtp-btn-primary" disabled={loading}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                Guardar Práctica
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default PracticeArchive;

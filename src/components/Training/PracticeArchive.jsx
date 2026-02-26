import React, { useState, useEffect } from 'react';
import { dtpService } from '../../services/dtpService';
import '../../index.css';

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
        documentUrl: '' // Temporary string for one url, will be added to array
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
            setError('Error al cargar las prácticas. Asegúrate de haber ejecutado el SQL de creación de tablas.');
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
            
            // Reset form
            setFormData({ title: '', description: '', documentUrl: '' });
            setDocumentUrls([]);
            
            // Go back to list after a short delay
            setTimeout(() => {
                setSuccessMessage(null);
                setViewMode('list');
            }, 1500);
            
        } catch (err) {
            console.error('Error creating practice:', err);
            setError('Error al crear la práctica. Revisa la consola para más detalles.');
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
        <div className="practice-archive-container">
            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            {viewMode === 'list' && (
                <>
                    <div className="archive-header" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="primary-btn" onClick={() => setViewMode('create')}>
                            + Nueva Práctica
                        </button>
                    </div>

                    {loading ? (
                        <div className="loading-spinner">Cargando...</div>
                    ) : practices.length === 0 ? (
                        <div className="empty-state">
                            <p>No hay prácticas registradas en el archivo.</p>
                        </div>
                    ) : (
                        <div className="practice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                            {practices.map(practice => (
                                <div key={practice.id} className="practice-card" style={{ backgroundColor: '#1a1d24', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2d3748' }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0' }}>{practice.title}</h3>
                                    <p style={{ color: '#a0aec0', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                        {practice.description || 'Sin descripción'}
                                    </p>
                                    
                                    {practice.documents_urls && practice.documents_urls.length > 0 && (
                                        <div className="practice-docs" style={{ marginBottom: '1rem' }}>
                                            <h4 style={{ color: '#cbd5e0', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Documentos Adjuntos:</h4>
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                {practice.documents_urls.map((url, idx) => (
                                                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1', textDecoration: 'none', fontSize: '0.85rem' }}>
                                                            📄 Documento {idx + 1}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    
                                    <div className="practice-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                        <button className="danger-btn" onClick={() => handleDelete(practice.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
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
                <div className="create-practice-form" style={{ backgroundColor: '#1a1d24', padding: '2rem', borderRadius: '8px', border: '1px solid #2d3748', maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Crear Nueva Práctica</h3>
                        <button className="secondary-btn" onClick={() => setViewMode('list')} style={{ padding: '0.4rem 0.8rem' }}>
                            Volver al Archivo
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Título de la Práctica *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                                placeholder="Ej: Negociación de Rehenes"
                            />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Descripción</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="4"
                                style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px', resize: 'vertical' }}
                                placeholder="Objetivos y metodología de la práctica..."
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Documentos (URLs)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input
                                    type="url"
                                    name="documentUrl"
                                    value={formData.documentUrl}
                                    onChange={handleInputChange}
                                    style={{ flex: 1, padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                                    placeholder="https://docs.google.com/..."
                                />
                                <button type="button" onClick={handleAddUrl} className="secondary-btn" style={{ padding: '0 1rem' }}>
                                    Añadir URL
                                </button>
                            </div>
                            
                            {documentUrls.length > 0 && (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, backgroundColor: '#2d3748', borderRadius: '4px' }}>
                                    {documentUrls.map((url, idx) => (
                                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: idx < documentUrls.length - 1 ? '1px solid #4a5568' : 'none' }}>
                                            <span style={{ color: '#4299e1', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                                {url}
                                            </span>
                                            <button type="button" onClick={() => handleRemoveUrl(idx)} style={{ background: 'none', border: 'none', color: '#fc8181', cursor: 'pointer', fontSize: '1.2rem' }}>
                                                &times;
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button type="submit" className="primary-btn" disabled={loading}>
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

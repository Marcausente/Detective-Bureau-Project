import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function IAReceptorDenuncias() {
    const navigate = useNavigate();

    // Data states
    const [complaints, setComplaints] = useState([]);
    const [iaCases, setIaCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal / Action states
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [linkingComplaintId, setLinkingComplaintId] = useState(null);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch complaints
            const { data: complaintsData, error: complaintsError } = await supabase
                .from('ia_complaints')
                .select('*, case:ia_cases(id, title, case_number)')
                .order('created_at', { ascending: false });

            if (complaintsError) throw complaintsError;
            setComplaints(complaintsData || []);

            // Fetch IA cases for association dropdown
            const { data: casesData, error: casesError } = await supabase
                .from('ia_cases')
                .select('id, title, case_number')
                .order('case_number', { ascending: false });

            if (casesError) throw casesError;
            setIaCases(casesData || []);

        } catch (err) {
            console.error("Error loading IA complaints data:", err);
            alert("Error al cargar denuncias de IA: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus, caseId = null) => {
        setUpdatingId(id);
        try {
            const updates = { status: newStatus };
            
            // If we are explicitly linking a case, or if we move out of 'With Case' we clear the case_id
            if (newStatus === 'With Case') {
                updates.case_id = caseId;
            } else if (newStatus !== 'With Case') {
                updates.case_id = null;
            }

            const { error } = await supabase
                .from('ia_complaints')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Reset modal state
            setLinkingComplaintId(null);
            setSelectedCaseId('');
            if (selectedComplaint && selectedComplaint.id === id) {
                setSelectedComplaint(null);
            }

            // Reload data
            await loadData();
        } catch (err) {
            console.error("Error updating complaint status:", err);
            alert("Error al actualizar estado: " + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDeleteComplaint = async (id) => {
        if (!window.confirm("¿Está seguro de que desea eliminar esta denuncia permanentemente de los registros de Asuntos Internos?")) return;
        
        try {
            const { error } = await supabase
                .from('ia_complaints')
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (selectedComplaint && selectedComplaint.id === id) {
                setSelectedComplaint(null);
            }
            await loadData();
        } catch (err) {
            console.error("Error deleting complaint:", err);
            alert("Error al eliminar la denuncia: " + err.message);
        }
    };

    const openLinkCaseModal = (e, id) => {
        e.stopPropagation();
        setLinkingComplaintId(id);
        const currentComplaint = complaints.find(c => c.id === id);
        setSelectedCaseId(currentComplaint?.case_id || '');
    };

    // Filter complaints based on search input
    const filteredComplaints = complaints.filter(c =>
        c.denunciante_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.denunciado_nombre_placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.motivo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Columns
    const incomingComplaints = filteredComplaints.filter(c => c.status === 'Incoming');
    const withCaseComplaints = filteredComplaints.filter(c => c.status === 'With Case');
    const closedComplaints = filteredComplaints.filter(c => c.status === 'Closed');

    const renderPruebas = (pruebas) => {
        if (!pruebas) return <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>Ninguna prueba adjunta</p>;

        if (pruebas.includes('Imagen adjunta:')) {
            const parts = pruebas.split('Imagen adjunta:');
            const linkPart = parts[0].replace('Enlace: ', '').trim();
            const imagePart = parts[1].trim();
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                    {linkPart && (
                        <div>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Enlace de video/evidencia:</span><br />
                            <a href={linkPart} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.9rem' }}>{linkPart}</a>
                        </div>
                    )}
                    {imagePart && (
                        <div>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Captura adjunta:</span><br />
                            <img src={imagePart} alt="Evidencia" style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', maxHeight: '300px', objectFit: 'contain' }} />
                        </div>
                    )}
                </div>
            );
        }

        if (pruebas.startsWith('data:image')) {
            return (
                <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Captura adjunta:</span><br />
                    <img src={pruebas} alt="Evidencia" style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', maxHeight: '300px', objectFit: 'contain' }} />
                </div>
            );
        }

        if (pruebas.startsWith('http://') || pruebas.startsWith('https://')) {
            return (
                <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>Enlace de video/evidencia:</span><br />
                    <a href={pruebas} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.9rem' }}>{pruebas}</a>
                </div>
            );
        }

        return (
            <div style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', marginTop: '0.5rem', fontSize: '0.9rem' }}>{pruebas}</div>
        );
    };

    const renderComplaintCard = (complaint) => {
        return (
            <div
                key={complaint.id}
                onClick={() => setSelectedComplaint(complaint)}
                style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '1.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem',
                    position: 'relative'
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.borderColor = complaint.status === 'Incoming' ? '#ef4444' : complaint.status === 'With Case' ? '#3b82f6' : '#10b981';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: complaint.status === 'Incoming' ? 'rgba(239, 68, 68, 0.1)' : complaint.status === 'With Case' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: complaint.status === 'Incoming' ? '#ef4444' : complaint.status === 'With Case' ? '#3b82f6' : '#10b981',
                            border: `1px solid ${complaint.status === 'Incoming' ? 'rgba(239, 68, 68, 0.2)' : complaint.status === 'With Case' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                            fontWeight: '600'
                        }}>
                            {complaint.status === 'Incoming' ? 'Entrante' : complaint.status === 'With Case' ? 'Con Caso' : 'Cerrada'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {new Date(complaint.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <h4 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: '700', marginTop: '0.6rem', marginBottom: '0.2rem' }}>
                        {complaint.motivo}
                    </h4>
                    <p style={{ color: '#e2e8f0', fontSize: '0.85rem', margin: 0 }}>
                        <strong style={{ color: '#94a3b8' }}>Acusado:</strong> {complaint.denunciado_nombre_placa}
                    </p>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 0.3rem 0' }}>
                        <strong style={{ color: '#cbd5e1' }}>Denunciante:</strong> {complaint.denunciante_nombre}
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                        <strong style={{ color: '#cbd5e1' }}>Teléfono:</strong> {complaint.denunciante_telefono}
                    </p>
                </div>

                {complaint.status === 'With Case' && complaint.case && (
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '6px',
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.8rem',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        📁 Caso #{complaint.case.case_number}: {complaint.case.title}
                    </div>
                )}

                {/* Card Quick Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }} onClick={e => e.stopPropagation()}>
                    {complaint.status !== 'Incoming' && (
                        <button
                            onClick={() => handleUpdateStatus(complaint.id, 'Incoming')}
                            className="login-button btn-secondary"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(255,255,255,0.05)' }}
                            title="Mover a Entrantes"
                            disabled={updatingId === complaint.id}
                        >
                            📥
                        </button>
                    )}
                    {complaint.status !== 'With Case' && (
                        <button
                            onClick={(e) => openLinkCaseModal(e, complaint.id)}
                            className="login-button"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto', backgroundColor: '#2563eb' }}
                            title="Vincular con Caso IA"
                            disabled={updatingId === complaint.id}
                        >
                            📁 Vincular
                        </button>
                    )}
                    {complaint.status !== 'Closed' && (
                        <button
                            onClick={() => handleUpdateStatus(complaint.id, 'Closed')}
                            className="login-button"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto', backgroundColor: '#16a34a' }}
                            title="Mover a Cerradas"
                            disabled={updatingId === complaint.id}
                        >
                            ✓ Cerrar
                        </button>
                    )}
                    <button
                        onClick={() => handleDeleteComplaint(complaint.id)}
                        className="login-button"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto', backgroundColor: '#dc2626' }}
                        title="Eliminar Denuncia"
                        disabled={updatingId === complaint.id}
                    >
                        🗑️
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="documentation-container" style={{ 
            padding: '1.5rem 2rem', 
            maxWidth: '100%', 
            height: 'calc(100vh - 180px)', 
            display: 'flex', 
            flexDirection: 'column' 
        }}>
            {/* Header / Search Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexShrink: 0 }}>
                <div>
                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                        <button
                            onClick={() => navigate('/internal-affairs')}
                            className="login-button btn-secondary"
                            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                            ← Volver
                        </button>
                        <h2 className="page-title" style={{ margin: 0, color: '#f8fafc', fontSize: '1.8rem', fontWeight: '800' }}>
                            Receptor de Denuncias
                        </h2>
                    </div>
                    <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Administrador de reportes y denuncias recibidas confidencialmente.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', maxWidth: '350px' }}>
                    <input
                        type="text"
                        placeholder="Buscar denunciante, acusado o motivo..."
                        className="form-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flex: 1 }}>
                    <div className="loading-container" style={{ fontSize: '1.2rem', color: '#3b82f6' }}>Cargando Denuncias...</div>
                </div>
            ) : (
                /* Kanban flex row */
                <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    overflowX: 'auto',
                    flex: 1,
                    alignItems: 'stretch',
                    paddingBottom: '1rem'
                }}>
                    
                    {/* Column 1: Denuncias Entrantes */}
                    <div style={{
                        flex: '1 0 320px',
                        maxWidth: '450px',
                        background: 'rgba(30, 41, 59, 0.25)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '1.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        height: '100%'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '2px solid #ef4444',
                            paddingBottom: '0.5rem',
                            marginBottom: '0.5rem',
                            flexShrink: 0
                        }}>
                            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📥 Denuncias Entrantes
                            </h3>
                            <span style={{ fontSize: '0.85rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                {incomingComplaints.length}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, padding: '0.2rem' }}>
                            {incomingComplaints.length === 0 ? (
                                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                    Ninguna denuncia entrante.
                                </div>
                            ) : (
                                incomingComplaints.map(renderComplaintCard)
                            )}
                        </div>
                    </div>

                    {/* Column 2: Denuncias con Caso */}
                    <div style={{
                        flex: '1 0 320px',
                        maxWidth: '450px',
                        background: 'rgba(30, 41, 59, 0.25)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '1.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        height: '100%'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '2px solid #3b82f6',
                            paddingBottom: '0.5rem',
                            marginBottom: '0.5rem',
                            flexShrink: 0
                        }}>
                            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📁 Denuncias con Caso
                            </h3>
                            <span style={{ fontSize: '0.85rem', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                {withCaseComplaints.length}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, padding: '0.2rem' }}>
                            {withCaseComplaints.length === 0 ? (
                                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                    Ninguna denuncia con caso.
                                </div>
                            ) : (
                                withCaseComplaints.map(renderComplaintCard)
                            )}
                        </div>
                    </div>

                    {/* Column 3: Denuncias Cerradas */}
                    <div style={{
                        flex: '1 0 320px',
                        maxWidth: '450px',
                        background: 'rgba(30, 41, 59, 0.25)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '1.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        height: '100%'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '2px solid #10b981',
                            paddingBottom: '0.5rem',
                            marginBottom: '0.5rem',
                            flexShrink: 0
                        }}>
                            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ✓ Denuncias Cerradas
                            </h3>
                            <span style={{ fontSize: '0.85rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                {closedComplaints.length}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, padding: '0.2rem' }}>
                            {closedComplaints.length === 0 ? (
                                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                    Ninguna denuncia cerrada.
                                </div>
                            ) : (
                                closedComplaints.map(renderComplaintCard)
                            )}
                        </div>
                    </div>

                </div>
            )}

            {/* Modal: View Details */}
            {selectedComplaint && (
                <div className="cropper-modal-overlay" onClick={() => setSelectedComplaint(null)}>
                    <div className="cropper-modal-content" style={{ maxWidth: '650px', width: '90%', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem', color: '#ef4444', fontSize: '1.4rem' }}>
                            Detalle de Denuncia Confidencial
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0' }}>
                            <div>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Denunciante:</span>
                                <p style={{ color: '#f8fafc', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.denunciante_nombre}</p>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Nº Teléfono:</span>
                                <p style={{ color: '#f8fafc', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.denunciante_telefono}</p>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Denunciado (Nombre/Placa):</span>
                                <p style={{ color: '#ef4444', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.denunciado_nombre_placa}</p>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Fecha de los hechos:</span>
                                <p style={{ color: '#f8fafc', fontSize: '0.95rem', margin: '0.1rem 0 0 0' }}>{selectedComplaint.fecha_hechos}</p>
                            </div>
                        </div>

                        <div style={{ margin: '1rem 0' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Motivo de la denuncia:</span>
                            <p style={{ color: '#f8fafc', fontSize: '1.05rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.motivo}</p>
                        </div>

                        <div style={{ margin: '1rem 0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Declaración de los hechos:</span>
                            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0.3rem 0 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                {selectedComplaint.declaracion}
                            </p>
                        </div>

                        <div style={{ margin: '1rem 0' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Pruebas aportadas:</span>
                            {renderPruebas(selectedComplaint.pruebas)}
                        </div>

                        {selectedComplaint.status === 'With Case' && selectedComplaint.case && (
                            <div style={{
                                marginTop: '1rem',
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '6px',
                                padding: '0.6rem',
                                color: '#60a5fa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.9rem'
                            }}>
                                📁 Vinculado al Caso Asuntos Internos #{selectedComplaint.case.case_number}: <strong>{selectedComplaint.case.title}</strong>
                            </div>
                        )}

                        <div className="cropper-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setSelectedComplaint(null)}>
                                Cerrar Detalles
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Link Case */}
            {linkingComplaintId && (
                <div className="cropper-modal-overlay" onClick={() => setLinkingComplaintId(null)}>
                    <div className="cropper-modal-content" style={{ maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '1rem', color: '#3b82f6' }}>Vincular con Caso Asuntos Internos</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Seleccione el caso de Asuntos Internos con el que desea relacionar esta denuncia.
                        </p>
                        
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label className="form-label">Caso de IA Asociado</label>
                            <select
                                className="form-input"
                                value={selectedCaseId}
                                onChange={(e) => setSelectedCaseId(e.target.value)}
                                style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc' }}
                            >
                                <option value="">-- Seleccionar Caso IA --</option>
                                {iaCases.map(c => (
                                    <option key={c.id} value={c.id}>
                                        Caso #{c.case_number}: {c.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="cropper-actions" style={{ marginTop: '1.5rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setLinkingComplaintId(null)}>
                                Cancelar
                            </button>
                            <button
                                className="login-button"
                                style={{ backgroundColor: '#2563eb' }}
                                onClick={() => handleUpdateStatus(linkingComplaintId, 'With Case', selectedCaseId || null)}
                                disabled={!selectedCaseId}
                            >
                                Vincular y Mover
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IAReceptorDenuncias;

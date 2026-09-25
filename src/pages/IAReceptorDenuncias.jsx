import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
    getDiscordIAComplaintsWebhookConfig, 
    saveDiscordIAComplaintsWebhookConfig, 
    testIAComplaintsDiscordWebhook,
    DEFAULT_IA_COMPLAINTS_BOT_NAME,
    DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
} from '../utils/discordWebhook';
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

    // Discord Webhook Modal State
    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [complaintWebhook, setComplaintWebhook] = useState({
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_IA_COMPLAINTS_BOT_NAME,
        botAvatar: '',
        customMsg: DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
    });
    const [savingWebhook, setSavingWebhook] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [webhookNotice, setWebhookNotice] = useState(null);
    const [webhookError, setWebhookError] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load webhook config
            getDiscordIAComplaintsWebhookConfig().then(cfg => setComplaintWebhook(cfg));

            // Fetch complaints
            const { data: complaintsData, error: complaintsError } = await supabase
                .from('ia_complaints')
                .select('*, case:ia_cases(id, title, case_number)')
                .order('created_at', { ascending: false });

            if (complaintsError) throw complaintsError;
            setComplaints(complaintsData || []);

            // Fetch IA cases for association dropdown
            const { data: casesData, error: casesError } = await supabase.rpc('get_ia_cases_dropdown');

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

    const handleSaveWebhook = async (e) => {
        e.preventDefault();
        setSavingWebhook(true);
        setWebhookNotice(null);
        setWebhookError(null);
        try {
            const res = await saveDiscordIAComplaintsWebhookConfig(complaintWebhook);
            if (res.success) {
                setWebhookNotice("Configuración guardada exitosamente.");
                setTimeout(() => setWebhookNotice(null), 4000);
            } else {
                setWebhookError("Error al guardar: " + res.error);
            }
        } catch (err) {
            setWebhookError(err.message);
        } finally {
            setSavingWebhook(false);
        }
    };

    const handleTestWebhook = async () => {
        setTestingWebhook(true);
        setWebhookNotice(null);
        setWebhookError(null);
        try {
            const res = await testIAComplaintsDiscordWebhook(complaintWebhook);
            if (res.success) {
                setWebhookNotice("¡Mensaje de prueba enviado con éxito a Discord!");
                setTimeout(() => setWebhookNotice(null), 4500);
            } else {
                setWebhookError(res.error || "Error al conectar con Discord");
            }
        } catch (err) {
            setWebhookError(err.message);
        } finally {
            setTestingWebhook(false);
        }
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
                            <a href={linkPart} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.9rem' }}>{linkPart}</a>
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
                    <a href={pruebas} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.9rem' }}>{pruebas}</a>
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
                    e.currentTarget.style.borderColor = complaint.status === 'Incoming' ? '#ef4444' : complaint.status === 'With Case' ? 'var(--color-blue)' : '#10b981';
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
                            background: complaint.status === 'Incoming' ? 'rgba(239, 68, 68, 0.1)' : complaint.status === 'With Case' ? 'rgba(var(--color-blue-rgb), 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: complaint.status === 'Incoming' ? '#ef4444' : complaint.status === 'With Case' ? 'var(--color-blue)' : '#10b981',
                            border: `1px solid ${complaint.status === 'Incoming' ? 'rgba(239, 68, 68, 0.2)' : complaint.status === 'With Case' ? 'rgba(var(--color-blue-rgb), 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
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
                        background: 'rgba(var(--color-blue-rgb), 0.08)',
                        border: '1px solid rgba(var(--color-blue-rgb), 0.2)',
                        borderRadius: '6px',
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.8rem',
                        color: 'var(--color-blue-light)',
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
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto', backgroundColor: 'var(--color-blue-dark)' }}
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
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowWebhookModal(true)}
                        className="login-button btn-secondary"
                        style={{
                            width: 'auto',
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: complaintWebhook.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            borderColor: complaintWebhook.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                            color: complaintWebhook.enabled ? '#34d399' : '#cbd5e1'
                        }}
                    >
                        <span>🔔</span>
                        <span>{complaintWebhook.enabled ? 'Discord Conectado' : 'Configurar Discord'}</span>
                    </button>
                    <div style={{ width: '260px' }}>
                        <input
                            type="text"
                            placeholder="Buscar denunciante, acusado o motivo..."
                            className="form-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flex: 1 }}>
                    <div className="loading-container" style={{ fontSize: '1.2rem', color: 'var(--color-blue)' }}>Cargando Denuncias...</div>
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
                        background: 'rgba(var(--secondary-rgb), 0.25)',
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
                        background: 'rgba(var(--secondary-rgb), 0.25)',
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
                            borderBottom: '2px solid var(--color-blue)',
                            paddingBottom: '0.5rem',
                            marginBottom: '0.5rem',
                            flexShrink: 0
                        }}>
                            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📁 Denuncias con Caso
                            </h3>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-blue)', background: 'rgba(var(--color-blue-rgb), 0.1)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
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
                        background: 'rgba(var(--secondary-rgb), 0.25)',
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
                    <div className="cropper-modal-content" style={{ maxWidth: '650px', width: '90%', textAlign: 'left', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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
                            <p style={{ color: '#f8fafc', fontSize: '1.05rem', margin: '0.1rem 0 0 0', fontWeight: 'bold', wordBreak: 'break-word' }}>{selectedComplaint.motivo}</p>
                        </div>

                        <div style={{ margin: '1rem 0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Declaración de los hechos:</span>
                            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '0.3rem 0 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.6', wordBreak: 'break-word' }}>
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
                                background: 'rgba(var(--color-blue-rgb), 0.08)',
                                border: '1px solid rgba(var(--color-blue-rgb), 0.2)',
                                borderRadius: '6px',
                                padding: '0.6rem',
                                color: 'var(--color-blue-light)',
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
                    <div className="cropper-modal-content" style={{ maxWidth: '400px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--color-blue)' }}>Vincular con Caso Asuntos Internos</h3>
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
                                style={{ backgroundColor: 'var(--color-blue-dark)' }}
                                onClick={() => handleUpdateStatus(linkingComplaintId, 'With Case', selectedCaseId || null)}
                                disabled={!selectedCaseId}
                            >
                                Vincular y Mover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIGURACIÓN WEBHOOK DISCORD */}
            {showWebhookModal && (
                <div className="modal-overlay" onClick={() => setShowWebhookModal(false)}>
                    <div 
                        className="modal-container" 
                        style={{ maxWidth: '640px', width: '90%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.25rem 0', color: '#38bdf8', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🔔</span> Configurar Webhook de Discord
                                </h3>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                                    Alertas automáticas en Discord para nuevas denuncias de IA.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowWebhookModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveWebhook}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                                {/* Estado Activo */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                                        Activar Notificaciones en Discord
                                    </span>
                                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={complaintWebhook.enabled} 
                                            onChange={e => setComplaintWebhook({ ...complaintWebhook, enabled: e.target.checked })} 
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span className="slider round" style={{ 
                                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                            backgroundColor: complaintWebhook.enabled ? '#059669' : '#334155', 
                                            transition: '.3s', borderRadius: '26px'
                                        }}>
                                            <span style={{
                                                position: 'absolute', content: '""', height: '18px', width: '18px', left: '4px', bottom: '4px',
                                                backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                                                transform: complaintWebhook.enabled ? 'translateX(20px)' : 'translateX(0)'
                                            }}></span>
                                        </span>
                                    </label>
                                </div>

                                {/* Webhook URL */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        URL del Webhook de Discord <span style={{ color: '#f87171' }}>*</span>
                                    </label>
                                    <input
                                        type="url"
                                        required={complaintWebhook.enabled}
                                        value={complaintWebhook.webhookUrl}
                                        onChange={e => setComplaintWebhook({ ...complaintWebhook, webhookUrl: e.target.value })}
                                        placeholder="https://discord.com/api/webhooks/..."
                                        className="form-input"
                                        style={{ width: '100%', padding: '0.55rem 0.8rem' }}
                                    />
                                </div>

                                {/* Role Ping */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        Mención de Rol / Notificación
                                    </label>
                                    <input
                                        type="text"
                                        value={complaintWebhook.rolePing}
                                        onChange={e => setComplaintWebhook({ ...complaintWebhook, rolePing: e.target.value })}
                                        placeholder="Ej: @everyone, @here, o ID de rol"
                                        className="form-input"
                                        style={{ width: '100%', padding: '0.55rem 0.8rem' }}
                                    />
                                </div>

                                {/* Bot Name */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        Nombre del Bot
                                    </label>
                                    <input
                                        type="text"
                                        value={complaintWebhook.botName}
                                        onChange={e => setComplaintWebhook({ ...complaintWebhook, botName: e.target.value })}
                                        placeholder="Ej: IA • Notificaciones de Denuncias"
                                        className="form-input"
                                        style={{ width: '100%', padding: '0.55rem 0.8rem' }}
                                    />
                                </div>

                                {/* Bot Avatar */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        Logo / Avatar del Bot (URL)
                                    </label>
                                    <input
                                        type="text"
                                        value={complaintWebhook.botAvatar}
                                        onChange={e => setComplaintWebhook({ ...complaintWebhook, botAvatar: e.target.value })}
                                        placeholder="/logowebp/IALSSD.webp o URL"
                                        className="form-input"
                                        style={{ width: '100%', padding: '0.55rem 0.8rem' }}
                                    />
                                </div>

                                {/* Custom Message */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                        Mensaje de Aviso
                                    </label>
                                    <textarea
                                        value={complaintWebhook.customMsg}
                                        onChange={e => setComplaintWebhook({ ...complaintWebhook, customMsg: e.target.value })}
                                        placeholder="Ej: ⚠️ **Nueva Denuncia Ciudadana Recibida**. Por favor, revisad la Base de Datos para verificarla y asignarla."
                                        className="form-input"
                                        rows={2}
                                        style={{ width: '100%', padding: '0.55rem 0.8rem', resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            {/* Notices */}
                            {webhookNotice && (
                                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem', color: '#34d399', fontSize: '0.85rem' }}>
                                    ✅ {webhookNotice}
                                </div>
                            )}
                            {webhookError && (
                                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem' }}>
                                    ❌ {webhookError}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={handleTestWebhook}
                                    disabled={testingWebhook || !complaintWebhook.webhookUrl}
                                    className="login-button btn-secondary"
                                    style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                                >
                                    {testingWebhook ? 'Probando...' : '🧪 Probar'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingWebhook}
                                    className="login-button"
                                    style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.82rem', background: '#0284c7' }}
                                >
                                    {savingWebhook ? 'Guardando...' : '💾 Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IAReceptorDenuncias;

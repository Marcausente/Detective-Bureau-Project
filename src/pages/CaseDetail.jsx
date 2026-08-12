import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, processHtmlImages } from '../utils/imageStorage';
import '../index.css';
import CaseTodoList from '../components/CaseTodoList';
import CaseWhiteboard from '../components/cases/CaseWhiteboard';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { makeQuillModules, quillFormats } from '../utils/quillConfig';
import { useLanguage } from '../contexts/LanguageContext';

function CaseDetail() {
    const { t, language } = useLanguage();
    const { id } = useParams();
    const navigate = useNavigate();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('updates'); // updates, todo, board

    // Quill config
    const quillModules = useMemo(() => makeQuillModules(), []);

    // New Update State
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [newUpdateImages, setNewUpdateImages] = useState([]);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);
    const [feedbackNotice, setFeedbackNotice] = useState(null);

    // Image Viewer Modal State
    const [expandedImage, setExpandedImage] = useState(null);

    // Modals Data
    const [users, setUsers] = useState([]);
    const [availableInterrogations, setAvailableInterrogations] = useState([]);
    const [availableIncidents, setAvailableIncidents] = useState([]);

    // Modals Visibility
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showLinkIncidentModal, setShowLinkIncidentModal] = useState(false);

    // Temp Selection State
    const [selectedAssignments, setSelectedAssignments] = useState([]);
    const [selectedInterrogation, setSelectedInterrogation] = useState('');
    const [selectedIncident, setSelectedIncident] = useState('');

    // Edit/Delete Permissions State
    const [currentUser, setCurrentUser] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [editImages, setEditImages] = useState([]);
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Case Info Edit State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [editOccurredAt, setEditOccurredAt] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editInitialImage, setEditInitialImage] = useState(null);

    const handleGoToUpdate = (updateId) => {
        setActiveTab('updates');
        setTimeout(() => {
            const el = document.getElementById(`update-${updateId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.transition = 'box-shadow 0.3s, border-color 0.3s';
                el.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';
                el.style.borderColor = '#10b981';
                setTimeout(() => {
                    el.style.boxShadow = 'none';
                    el.style.borderColor = 'rgba(255,255,255,0.12)';
                }, 2500);
            }
        }, 100);
    };

    useEffect(() => {
        loadCaseDetails();
        loadCurrentUser();
    }, [id]);

    const loadCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
            setCurrentUser(profile);
        }
    };

    const loadCaseDetails = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        const { data, error } = await supabase.rpc('get_case_details', { p_case_id: id });
        if (error) {
            console.error('Error loading case:', error);
        } else {
            setCaseData(data);
            const currentIds = data.assignments ? data.assignments.map(a => a.user_id) : [];
            setSelectedAssignments(currentIds);
        }
        setLoading(false);
    };

    const openAssignModal = async () => {
        if (users.length === 0) {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango').order('rango');
            setUsers(data || []);
        }
        if (caseData?.assignments) {
            setSelectedAssignments(caseData.assignments.map(a => a.user_id));
        }
        setShowAssignModal(true);
    };

    const openLinkModal = async () => {
        const { data, error } = await supabase.rpc('get_available_interrogations_to_link');
        if (error) console.error(error);
        else setAvailableInterrogations(data || []);
        setSelectedInterrogation('');
        setShowLinkModal(true);
    };

    const openLinkIncidentModal = async () => {
        const { data, error } = await supabase.rpc('get_available_incidents_to_link', { p_case_id: id });
        if (error) console.error(error);
        else setAvailableIncidents(data || []);
        setSelectedIncident('');
        setShowLinkIncidentModal(true);
    };

    const handleUpdateRole = async (userId, newRole) => {
        setCaseData(prev => {
            const newAssignments = prev.assignments.map(a => a.user_id === userId ? { ...a, role: newRole } : a);
            return { ...prev, assignments: newAssignments };
        });

        try {
            const { error } = await supabase.rpc('update_case_assignment_role', {
                p_case_id: id,
                p_user_id: userId,
                p_role: newRole
            });
            if (error) throw error;
        } catch (err) {
            console.error('Error updating role:', err);
            loadCaseDetails(false);
        }
    };

    const handleSaveAssignments = async () => {
        try {
            const { error } = await supabase.rpc('update_case_assignments', {
                p_case_id: id,
                p_assigned_ids: selectedAssignments
            });
            if (error) throw error;
            setShowAssignModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error updating assignments: ' + err.message);
        }
    };

    const handleLinkInterrogation = async () => {
        if (!selectedInterrogation) return;
        try {
            const { error } = await supabase.rpc('link_interrogation_to_case', {
                p_interrogation_id: selectedInterrogation,
                p_case_id: id
            });
            if (error) throw error;
            setShowLinkModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error linking interrogation: ' + err.message);
        }
    };

    const handleLinkIncident = async () => {
        if (!selectedIncident) return;
        try {
            const { error } = await supabase.rpc('link_incident_to_case', {
                p_incident_id: selectedIncident,
                p_case_id: id
            });
            if (error) throw error;
            setShowLinkIncidentModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error linking incident: ' + err.message);
        }
    };

    const toggleAssignmentSelection = (status, userId) => {
        if (status) {
            setSelectedAssignments(prev => [...prev, userId]);
        } else {
            setSelectedAssignments(prev => prev.filter(uid => uid !== userId));
        }
    };

    const canPinCase = () => {
        if (!currentUser?.rol) return false;
        const r = currentUser.rol.toLowerCase().trim();
        return r === 'administrador' || r === 'coordinador' || r === 'comisionado' || r.includes('detective') || r.includes('admin');
    };

    const handleTogglePin = async () => {
        if (!canPinCase()) return;
        try {
            const currentPinned = caseData.info.is_pinned;
            const { error } = await supabase.rpc('toggle_case_pin', { p_case_id: id, p_pinned: !currentPinned });
            if (error) throw error;
            setCaseData(prev => ({
                ...prev,
                info: { ...prev.info, is_pinned: !currentPinned }
            }));
        } catch (err) {
            console.error('Error toggling pin:', err);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            const { error } = await supabase.rpc('update_case_status', {
                p_case_id: id,
                p_status: newStatus
            });
            if (error) throw error;

            setCaseData(prev => ({
                ...prev,
                info: { ...prev.info, status: newStatus }
            }));
        } catch (err) {
            alert("Error updating status: " + err.message);
        }
    };

    const handlePostUpdate = async (e) => {
        e.preventDefault();
        const isTextEmpty = newUpdateContent.replace(/<[^>]*>/g, '').trim() === '';
        if (isTextEmpty && newUpdateImages.length === 0) {
            alert(language === 'es' ? "Por favor ingrese texto o adjunte una imagen para publicar la actualización." : "Please enter text or attach an image to post an update.");
            return;
        }

        setSubmittingUpdate(true);
        setFeedbackNotice(null);
        try {
            let uploadedImages = [];
            if (newUpdateImages.length > 0) {
                uploadedImages = await Promise.all(
                    newUpdateImages.map(async img => {
                        if (img && img.startsWith('data:')) {
                            return await uploadImageToStorage(img, 'cases');
                        }
                        return img;
                    })
                );
            }

            const finalContent = await processHtmlImages(newUpdateContent, 'cases');

            const { error } = await supabase.rpc('add_case_update', {
                p_case_id: id,
                p_content: finalContent,
                p_images: uploadedImages
            });

            if (error) throw error;

            setNewUpdateContent('');
            setNewUpdateImages([]);
            setFeedbackNotice(language === 'es' ? '✓ Actualización registrada correctamente.' : '✓ Update logged successfully.');
            setTimeout(() => setFeedbackNotice(null), 3000);

            loadCaseDetails(false);

        } catch (err) {
            alert("Error posting update: " + err.message);
        } finally {
            setSubmittingUpdate(false);
        }
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                    canvas.width = img.width * scaleSize;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    setNewUpdateImages(prev => [...prev, dataUrl]);
                };
            };
        });
    };

    const handleStartEdit = (update) => {
        setEditingId(update.id);
        setEditContent(update.content || "");
        let existingImgs = [];
        if (update.images && update.images.length > 0) existingImgs = [...update.images];
        else if (update.image) existingImgs = [update.image];
        setEditImages(existingImgs);
    };

    const handleDeleteUpdate = async (updateId) => {
        if (!window.confirm(language === 'es' ? "¿Estás seguro de eliminar esta actualización?" : "Are you sure you want to delete this update?")) return;
        try {
            const { error } = await supabase.rpc('delete_case_update', { p_update_id: updateId });
            if (error) throw error;
            loadCaseDetails(false);
        } catch (err) {
            alert("Error deleting update: " + err.message);
        }
    };

    const handleDeleteCase = async () => {
        if (!window.confirm("¿Estás seguro de eliminar PERMANENTEMENTE este caso? Esta acción no se puede deshacer.")) return;
        try {
            setLoading(true);
            const { error } = await supabase.rpc('delete_case_fully', { p_case_id: id });
            if (error) throw error;
            navigate('/cases');
        } catch (err) {
            alert('Error deleting case: ' + err.message);
            setLoading(false);
        }
    };

    const handleSaveInfo = async () => {
        try {
            const finalDescription = await processHtmlImages(editDescription, 'cases');
            const { error } = await supabase.rpc('update_case_details', {
                p_case_id: id,
                p_title: editTitle,
                p_location: editLocation,
                p_occurred_at: editOccurredAt,
                p_description: finalDescription
            });
            if (error) throw error;

            if (editInitialImage !== null) {
                let finalInitialImage = editInitialImage;
                if (finalInitialImage && finalInitialImage.startsWith('data:')) {
                    finalInitialImage = await uploadImageToStorage(finalInitialImage, 'cases');
                }
                await supabase
                    .from('cases')
                    .update({ initial_image_url: finalInitialImage || null })
                    .eq('id', id);
            }

            setIsEditingInfo(false);
            setEditInitialImage(null);
            loadCaseDetails();
        } catch (err) {
            alert('Error updating case details: ' + err.message);
        }
    };

    if (loading) return (
        <div className="mac-doc-empty">
            <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite' }}></span>
            <span>Cargando expediente policial...</span>
        </div>
    );
    
    if (!caseData) return (
        <div className="mac-doc-empty">
            <span>No se encontró el expediente solicitado.</span>
        </div>
    );

    const { info, assignments, updates, interrogations, incidents: linkedIncidents } = caseData;

    const isHighCommand = currentUser && ['Coordinador', 'Administrador', 'Comisionado'].includes(currentUser.rol);
    const isCreator = currentUser && info.created_by === currentUser.id;
    const isAssignedEncargado = currentUser && assignments && assignments.some(a => a.user_id === currentUser.id && a.role === 'Encargado');
    const isAyudante = currentUser && currentUser.rol === 'Ayudante';
    const canEditCase = (isHighCommand || isCreator || isAssignedEncargado) && !isAyudante;

    const startEditingInfo = () => {
        setEditTitle(info.title);
        setEditLocation(info.location || '');
        const dt = new Date(info.occurred_at);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        setEditOccurredAt(dt.toISOString().slice(0, 16));
        setEditDescription(info.description || '');
        setEditInitialImage(null);
        setIsEditingInfo(true);
    };

    const statusColor = info.status === 'Open' ? '#10b981' : info.status === 'Closed' ? '#ef4444' : '#64748b';
    const statusText = info.status === 'Open' ? 'ABIERTO' : info.status === 'Closed' ? 'CERRADO' : 'ARCHIVADO';

    return (
        <div className="mac-dashboard-container">
            {/* Top Compact Navigation Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <button 
                    onClick={() => navigate('/cases')}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#94a3b8', 
                        fontSize: '0.8rem', 
                        fontWeight: 600,
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.35rem',
                        padding: 0 
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Volver a Casos</span>
                </button>

                {/* Header Action Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {canPinCase() && (
                        <button 
                            className="mac-btn mac-btn-secondary"
                            onClick={handleTogglePin}
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: info.is_pinned ? 1 : 0.75, borderRadius: '6px' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="17" x2="12" y2="22" />
                                <path d="M5 17h14l-1.5-6h2L18 3H6L4.5 11h2z" />
                            </svg>
                            <span>{info.is_pinned ? 'Anclado' : 'Anclar'}</span>
                        </button>
                    )}

                    {canEditCase && !isEditingInfo && (
                        <button 
                            className="mac-btn mac-btn-secondary"
                            onClick={startEditingInfo}
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '6px' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Editar Detalles</span>
                        </button>
                    )}

                    {info.status === 'Open' && (
                        <>
                            <button 
                                className="mac-btn mac-btn-secondary"
                                onClick={() => handleStatusChange('Closed')}
                                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#f87171' }}
                            >
                                Cerrar Caso
                            </button>
                            <button 
                                className="mac-btn mac-btn-secondary"
                                onClick={() => handleStatusChange('Archived')}
                                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#94a3b8' }}
                            >
                                Archivar
                            </button>
                        </>
                    )}

                    {(currentUser?.rol === 'Administrador' || currentUser?.rol === 'Coordinador') && (
                        <button 
                            className="mac-btn"
                            onClick={handleDeleteCase}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <span>Eliminar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Title & Metadata Compact Line */}
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.015em' }}>
                        #{String(info.case_number).padStart(3, '0')} {info.title}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33`, padding: '0.15rem 0.5rem', borderRadius: '6px', textTransform: 'uppercase' }}>
                        {statusText}
                    </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem', display: 'flex', gap: '0.8rem' }}>
                    <span>📍 {info.location || 'Ubicación no especificada'}</span>
                    <span>📅 {new Date(info.occurred_at).toLocaleString()}</span>
                </div>
            </div>

            {/* Editing Form when Active */}
            {isEditingInfo && (
                <div className="mac-widget-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#ffffff', fontSize: '0.9rem' }}>Editar Detalles</h4>
                    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('caseTitle')}</label>
                            <input type="text" className="mac-form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{t('location')}</label>
                                <input type="text" className="mac-form-input" value={editLocation} onChange={e => setEditLocation(e.target.value)} />
                            </div>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{t('dateTime')}</label>
                                <input type="datetime-local" className="mac-form-input" value={editOccurredAt} onChange={e => setEditOccurredAt(e.target.value)} />
                            </div>
                        </div>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('initialReport')}</label>
                            <ReactQuill
                                theme="snow"
                                modules={quillModules}
                                formats={quillFormats}
                                value={editDescription}
                                onChange={setEditDescription}
                                style={{ marginBottom: '0.5rem' }}
                            />
                        </div>
                    </div>
                    <div className="mac-modal-actions" style={{ marginTop: '0.75rem' }}>
                        <button className="mac-btn mac-btn-secondary" onClick={() => setIsEditingInfo(false)}>{t('cancelBtn')}</button>
                        <button className="mac-btn mac-btn-primary" onClick={handleSaveInfo}>{t('saveChangesBtn')}</button>
                    </div>
                </div>
            )}

            {/* Compact Initial Report Box */}
            {!isEditingInfo && (
                <div className="mac-widget-card" style={{ padding: '0.85rem 1.1rem', marginBottom: '1.25rem', borderLeft: '3px solid var(--accent-gold)' }}>
                    <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--accent-gold)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        CLAVES DEL CASO
                    </h4>
                    {info.initial_image_url && (
                        <div 
                            style={{ marginBottom: '0.6rem', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', maxWidth: '320px', border: '1px solid rgba(255,255,255,0.12)' }} 
                            onClick={() => setExpandedImage(info.initial_image_url)}
                        >
                            <img src={info.initial_image_url} alt="Initial Evidence" style={{ width: '100%', display: 'block' }} />
                        </div>
                    )}
                    <div
                        className="quill-content"
                        style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: '1.5' }}
                        dangerouslySetInnerHTML={{ __html: info.description }}
                    />
                </div>
            )}

            {/* Layout Grid: Main Tabs Content + Compact Sidebar */}
            <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'board' ? '1fr' : '2.2fr 1fr', gap: '1.25rem' }}>
                {/* Left Main Section */}
                <div>
                    {/* Compact SVG Segmented Tabs */}
                    <div className="mac-doc-tabs" style={{ marginBottom: '1rem', padding: '0.25rem' }}>
                        <button
                            className={`mac-doc-tab ${activeTab === 'updates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('updates')}
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Actualizaciones y Evidencias</span>
                        </button>
                        <button
                            className={`mac-doc-tab ${activeTab === 'todo' ? 'active' : ''}`}
                            onClick={() => setActiveTab('todo')}
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 11l3 3L22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                            <span>Lista de Tareas</span>
                        </button>
                        <button
                            className={`mac-doc-tab ${activeTab === 'board' ? 'active' : ''}`}
                            onClick={() => setActiveTab('board')}
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                            <span>Pizarra</span>
                        </button>
                    </div>

                    {activeTab === 'updates' ? (
                        <>
                            {/* Compact New Update Card */}
                            {info.status !== 'Archived' && (
                                <div className="mac-widget-card" style={{ marginBottom: '1rem', padding: '0.9rem 1.1rem' }}>
                                    <h4 style={{ margin: '0 0 0.6rem 0', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700 }}>Registrar Nueva Actualización / Evidencia</h4>
                                    {feedbackNotice && (
                                        <div style={{
                                            padding: '0.5rem 0.75rem',
                                            marginBottom: '0.75rem',
                                            borderRadius: '6px',
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            border: '1px solid rgba(16, 185, 129, 0.35)',
                                            color: '#34d399',
                                            fontSize: '0.78rem',
                                            fontWeight: '600'
                                        }}>
                                            {feedbackNotice}
                                        </div>
                                    )}
                                    <form onSubmit={handlePostUpdate}>
                                        <ReactQuill 
                                            theme="snow"
                                            modules={quillModules}
                                            formats={quillFormats}
                                            placeholder="Registrar nueva actualización, desarrollo o evidencia..."
                                            value={newUpdateContent}
                                            onChange={setNewUpdateContent}
                                            style={{ marginBottom: '0.75rem' }}
                                        />

                                        {/* Image Previews */}
                                        {newUpdateImages.length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                                {newUpdateImages.map((imgSrc, idx) => (
                                                    <div key={idx} style={{ position: 'relative' }}>
                                                        <img src={imgSrc} alt="" style={{ height: '64px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }} />
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewUpdateImages(prev => prev.filter((_, i) => i !== idx))}
                                                            style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                padding: '0.35rem 0.75rem',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.78rem',
                                                color: '#cbd5e1'
                                            }}>
                                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                    <circle cx="12" cy="13" r="4" />
                                                </svg>
                                                <span>Adjuntar Fotografías</span>
                                            </label>

                                            <button type="submit" className="mac-btn mac-btn-primary" style={{ padding: '0.38rem 0.9rem', fontSize: '0.78rem' }} disabled={submittingUpdate}>
                                                {submittingUpdate ? 'Publicando...' : 'Publicar Actualización'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Compact Feed */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {updates.length === 0 ? (
                                    <div className="mac-doc-empty">
                                        <span>No se han registrado actualizaciones en este expediente.</span>
                                    </div>
                                ) : (
                                    updates.map(update => {
                                        const isAuthor = currentUser && update.author_id === currentUser.id;
                                        const canEditThisUpdate = (isAuthor || isHighCommand) && !isAyudante;

                                        return (
                                            <div 
                                                key={update.id} 
                                                id={`update-${update.id}`}
                                                className="mac-widget-card" 
                                                style={{ position: 'relative', padding: '0.9rem 1.1rem' }}
                                            >
                                                {/* Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', paddingBottom: '0.45rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <img 
                                                            src={update.author_avatar || '/logowebp/anon.webp'} 
                                                            alt="Avatar" 
                                                            style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} 
                                                        />
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>
                                                                {update.author_rank} {update.author_name}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                {new Date(update.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {canEditThisUpdate && (
                                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                            <button 
                                                                onClick={() => handleStartEdit(update)}
                                                                className="mac-btn mac-btn-secondary"
                                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                                            >
                                                                Editar
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteUpdate(update.id)}
                                                                className="mac-btn"
                                                                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                                            >
                                                                Borrar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div 
                                                    className="quill-content"
                                                    style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: '1.5' }}
                                                    dangerouslySetInnerHTML={{ __html: update.content }}
                                                />

                                                {/* Images */}
                                                {update.images && update.images.length > 0 && (
                                                    <div style={{ marginTop: '0.6rem', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                        {update.images.map((imgSrc, i) => (
                                                            <div 
                                                                key={i} 
                                                                style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
                                                                onClick={() => setExpandedImage(imgSrc)}
                                                            >
                                                                <img src={imgSrc} alt="Evidence" style={{ display: 'block', maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : activeTab === 'todo' ? (
                        <CaseTodoList caseId={id} />
                    ) : (
                        <CaseWhiteboard caseId={id} isIA={false} caseData={caseData} onGoToUpdate={handleGoToUpdate} />
                    )}
                </div>

                {/* Right Compact Sidebar */}
                {activeTab !== 'board' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {/* Assigned Detectives */}
                        <div className="mac-widget-card" style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                    <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>DETECTIVES ASIGNADOS</h4>
                                </div>
                                {info.status === 'Open' && !isAyudante && (
                                    <button onClick={openAssignModal} className="mac-btn mac-btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                        Gestionar
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {assignments.length === 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sin detectives asignados</span>
                                ) : (
                                    assignments.map(user => (
                                        <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                            <img src={user.avatar || '/logowebp/anon.webp'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', objectFit: 'cover' }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {user.rank} {user.full_name}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                                {user.role || 'Investigador'}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Linked Interrogations */}
                        <div className="mac-widget-card" style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>INTERROGATORIOS</h4>
                                </div>
                                {info.status === 'Open' && (
                                    <button onClick={openLinkModal} className="mac-btn mac-btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                        Vincular
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {interrogations.length === 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sin interrogatorios</span>
                                ) : (
                                    interrogations.map(inv => (
                                        <div key={inv.id} onClick={() => navigate(`/interrogations?id=${inv.id}`)} style={{ padding: '0.45rem 0.55rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', cursor: 'pointer', borderLeft: '2px solid #10b981' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#ffffff' }}>{inv.title}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Linked Incidents */}
                        <div className="mac-widget-card" style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>INFORMES VINCULADOS</h4>
                                </div>
                                {info.status === 'Open' && (
                                    <button onClick={openLinkIncidentModal} className="mac-btn mac-btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                        Vincular
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {linkedIncidents.length === 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sin informes vinculados</span>
                                ) : (
                                    linkedIncidents.map(inc => (
                                        <div key={inc.id} onClick={() => navigate(`/incidents?id=${inc.id}`)} style={{ padding: '0.45rem 0.55rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', cursor: 'pointer', borderLeft: '2px solid #60a5fa' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#ffffff' }}>{inc.title}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals for Links */}
            {showAssignModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '460px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowAssignModal(false)}></div>
                            </div>
                            <span className="mac-modal-title">Asignar Detectives al Caso</span>
                            <div style={{ width: 52 }} />
                        </div>
                        <div className="mac-modal-body">
                            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.85rem' }}>
                                {users.map(u => (
                                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem', cursor: 'pointer', borderRadius: '6px' }}>
                                        <input type="checkbox" checked={selectedAssignments.includes(u.id)} onChange={e => toggleAssignmentSelection(e.target.checked, u.id)} style={{ marginRight: '8px' }} />
                                        <span style={{ color: '#ffffff', fontSize: '0.82rem' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mac-modal-actions">
                                <button className="mac-btn mac-btn-secondary" onClick={() => setShowAssignModal(false)}>Cancelar</button>
                                <button className="mac-btn mac-btn-primary" onClick={handleSaveAssignments}>Guardar Asignaciones</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN LIGHTBOX */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.92)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out',
                        backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img src={expandedImage} alt="Evidence" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '12px' }} />
                </div>
            )}
        </div>
    );
}

export default CaseDetail;

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, processHtmlImages } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';
import IACaseTodoList from '../components/IACaseTodoList';
import IASanctionVoting from '../components/IASanctionVoting';
import CaseWhiteboard from '../components/cases/CaseWhiteboard';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { makeQuillModules, quillFormats } from '../utils/quillConfig';

function IACaseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('updates');

    // Update State
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [newUpdateImages, setNewUpdateImages] = useState([]);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);

    // Edit/Delete Permissions State
    const [currentUser, setCurrentUser] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [editImages, setEditImages] = useState([]);
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Case Info Edit State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editOccurredAt, setEditOccurredAt] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editInitialImage, setEditInitialImage] = useState(null);

    // Quill config
    const quillModules = useMemo(() => makeQuillModules(), []);

    // Image Viewer
    const [expandedImage, setExpandedImage] = useState(null);

    // Modals
    const [users, setUsers] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignments, setSelectedAssignments] = useState([]);

    // Privacy Modal State
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [selectedHiddenUsers, setSelectedHiddenUsers] = useState([]);
    const [isHiddenFromAll, setIsHiddenFromAll] = useState(false);
    const [savingPrivacy, setSavingPrivacy] = useState(false);

    const [complaints, setComplaints] = useState([]);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [showLinkComplaintModal, setShowLinkComplaintModal] = useState(false);
    const [availableComplaints, setAvailableComplaints] = useState([]);

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [availableInterrogations, setAvailableInterrogations] = useState([]);

    // Full-screen Whiteboard Modal State
    const [showBoardModal, setShowBoardModal] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showBoardModal) {
                setShowBoardModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showBoardModal]);

    useEffect(() => {
        loadCaseDetails();
        loadCurrentUser();
        loadComplaints();
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
        const { data, error } = await supabase.rpc('get_ia_case_details', { p_case_id: id });
        if (error) {
            console.error('Error loading IA case:', error);
            alert('Failed to load investigation details.');
        } else {
            setCaseData(data);
            const currentIds = data.assignments ? data.assignments.map(a => a.user_id) : [];
            setSelectedAssignments(currentIds);
        }
        setLoading(false);
    };

    const loadComplaints = async () => {
        try {
            const { data, error } = await supabase
                .from('ia_complaints')
                .select('*')
                .eq('case_id', id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setComplaints(data || []);
        } catch (err) {
            console.error("Error loading linked complaints:", err);
        }
    };

    const openLinkComplaintModal = async () => {
        try {
            const { data, error } = await supabase
                .from('ia_complaints')
                .select('*')
                .or('case_id.is.null,status.neq.With Case')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setAvailableComplaints(data || []);
            setShowLinkComplaintModal(true);
        } catch (err) {
            alert('Error al cargar denuncias disponibles: ' + err.message);
        }
    };

    const handleLinkComplaint = async (complaintId) => {
        try {
            const { error } = await supabase
                .from('ia_complaints')
                .update({ case_id: id, status: 'With Case' })
                .eq('id', complaintId);
            if (error) throw error;
            setShowLinkComplaintModal(false);
            loadComplaints();
        } catch (err) {
            alert('Error al vincular la denuncia: ' + err.message);
        }
    };

    const handleUnlinkComplaint = async (complaintId) => {
        if (!window.confirm(language === 'es' ? "¿Desvincular esta denuncia del caso? Volverá al receptor de denuncias como 'Entrante'." : "Unlink this complaint from the case?")) return;
        try {
            const { error } = await supabase
                .from('ia_complaints')
                .update({ case_id: null, status: 'Incoming' })
                .eq('id', complaintId);
            if (error) throw error;
            loadComplaints();
        } catch (err) {
            alert('Error al desvincular la denuncia: ' + err.message);
        }
    };

    const loadAvailableInterrogations = async () => {
        try {
            const { data, error } = await supabase.rpc('get_available_ia_interrogations_to_link');
            if (!error && data) {
                setAvailableInterrogations(data);
            } else {
                const { data: invData } = await supabase
                    .from('ia_interrogations')
                    .select('*')
                    .is('case_id', null)
                    .order('created_at', { ascending: false });
                setAvailableInterrogations(invData || []);
            }
        } catch (err) {
            try {
                const { data: invData } = await supabase
                    .from('ia_interrogations')
                    .select('*')
                    .is('case_id', null)
                    .order('created_at', { ascending: false });
                setAvailableInterrogations(invData || []);
            } catch (e) {
                setAvailableInterrogations([]);
            }
        }
        setShowLinkModal(true);
    };

    const handleLinkInterrogation = async (interrogationId) => {
        try {
            const { error } = await supabase.rpc('manage_ia_interrogation', {
                p_action: 'link',
                p_id: interrogationId,
                p_case_id: id
            });
            if (error) {
                const { error: updErr } = await supabase
                    .from('ia_interrogations')
                    .update({ case_id: id })
                    .eq('id', interrogationId);
                if (updErr) throw updErr;
            }
            setShowLinkModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error linking interrogation: ' + err.message);
        }
    };

    const handleUnlinkInterrogation = async (interrogationId) => {
        if (!window.confirm(language === 'es' ? "¿Desvincular este interrogatorio?" : "Unlink this interrogation?")) return;
        try {
            const { error } = await supabase.rpc('manage_ia_interrogation', {
                p_action: 'unlink',
                p_id: interrogationId
            });
            if (error) {
                const { error: updErr } = await supabase
                    .from('ia_interrogations')
                    .update({ case_id: null })
                    .eq('id', interrogationId);
                if (updErr) throw updErr;
            }
            loadCaseDetails();
        } catch (err) {
            alert('Error unlinking: ' + err.message);
        }
    };

    const openAssignModal = async () => {
        if (users.length === 0) {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, divisions, profile_image').order('rango');
            if (data) {
                const iaUsers = data.filter(u =>
                    (u.divisions && u.divisions.includes('Internal Affairs')) ||
                    u.rol === 'Administrador'
                );
                setUsers(iaUsers);
            }
        }
        if (caseData?.assignments) {
            setSelectedAssignments(caseData.assignments.map(a => a.user_id));
        }
        setShowAssignModal(true);
    };

    const toggleAssignmentSelection = (isAdding, userId) => {
        if (isAdding) {
            setSelectedAssignments(prev => [...prev, userId]);
        } else {
            setSelectedAssignments(prev => prev.filter(id => id !== userId));
        }
    };

    const handleUpdateAssignments = async () => {
        try {
            const { error } = await supabase.rpc('update_ia_case_assignments', {
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

    const handleUpdateRole = async (userId, newRole) => {
        try {
            const { error } = await supabase.rpc('update_ia_case_assignment_role', {
                p_case_id: id,
                p_user_id: userId,
                p_role: newRole
            });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert('Error updating role: ' + err.message);
        }
    };

    const openPrivacyModal = async () => {
        if (users.length === 0) {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, divisions, profile_image').order('rango');
            if (data) {
                const iaUsers = data.filter(u =>
                    (u.divisions && u.divisions.includes('Internal Affairs')) ||
                    u.rol === 'Administrador'
                );
                setUsers(iaUsers);
            }
        }
        setSelectedHiddenUsers(caseData?.info?.hidden_user_ids || []);
        setIsHiddenFromAll(caseData?.info?.is_hidden_from_all || false);
        setShowPrivacyModal(true);
    };

    const togglePrivacyHiddenUser = (userId) => {
        if (selectedHiddenUsers.includes(userId)) {
            setSelectedHiddenUsers(prev => prev.filter(uId => uId !== userId));
        } else {
            setSelectedHiddenUsers(prev => [...prev, userId]);
        }
    };

    const handleSavePrivacy = async () => {
        setSavingPrivacy(true);
        try {
            const { error } = await supabase.rpc('update_ia_case_privacy', {
                p_case_id: id,
                p_hidden_user_ids: selectedHiddenUsers,
                p_is_hidden_from_all: isHiddenFromAll
            });
            if (error) throw error;
            setShowPrivacyModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error saving privacy settings: ' + err.message);
        } finally {
            setSavingPrivacy(false);
        }
    };

    const handlePostUpdate = async (e) => {
        e.preventDefault();
        if (!newUpdateContent || newUpdateContent === '<p><br></p>') return;
        setSubmittingUpdate(true);
        try {
            const finalContent = await processHtmlImages(newUpdateContent, 'cases');

            let uploadedImages = [];
            if (newUpdateImages.length > 0) {
                uploadedImages = await Promise.all(
                    newUpdateImages.map(img => img.startsWith('data:') ? uploadImageToStorage(img, 'cases') : img)
                );
            }

            const { error } = await supabase.rpc('add_ia_case_update', {
                p_case_id: id,
                p_content: finalContent,
                p_images: uploadedImages
            });
            if (error) throw error;

            setNewUpdateContent('');
            setNewUpdateImages([]);
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

    const handleEditImageUpload = (e) => {
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
                    setEditImages(prev => [...prev, dataUrl]);
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

    const handleSaveEdit = async (updateId) => {
        if (!editContent || editContent === '<p><br></p>') return;
        setSubmittingEdit(true);
        try {
            const finalContent = await processHtmlImages(editContent, 'cases');

            let finalImages = [];
            if (editImages.length > 0) {
                finalImages = await Promise.all(
                    editImages.map(img => img.startsWith('data:') ? uploadImageToStorage(img, 'cases') : img)
                );
            }

            const { error } = await supabase.rpc('update_ia_case_update_content', {
                p_update_id: updateId,
                p_content: finalContent,
                p_images: finalImages
            });
            if (error) throw error;

            setEditingId(null);
            setEditContent("");
            setEditImages([]);
            loadCaseDetails(false);
        } catch (err) {
            alert("Error saving edit: " + err.message);
        } finally {
            setSubmittingEdit(false);
        }
    };

    const handleDeleteUpdate = async (updateId) => {
        if (!window.confirm(language === 'es' ? "¿Eliminar esta actualización?" : "Delete this update?")) return;
        try {
            const { error } = await supabase.rpc('delete_ia_case_update', { p_update_id: updateId });
            if (error) throw error;
            loadCaseDetails(false);
        } catch (err) {
            alert("Error deleting update: " + err.message);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            const { error } = await supabase.rpc('update_ia_case_status', { p_case_id: id, p_status: newStatus });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert('Error updating status: ' + err.message);
        }
    };

    const handleDeleteCase = async () => {
        const confirmMsg = language === 'es'
            ? "¿Estás seguro de eliminar PERMANENTEMENTE este caso de Asuntos Internos? Esta acción no se puede deshacer."
            : "Are you sure you want to PERMANENTLY DELETE this IA case?";
        if (!window.confirm(confirmMsg)) return;

        try {
            setLoading(true);
            const { data: result, error } = await supabase.rpc('delete_ia_case_fully', { p_case_id: id });
            if (error) throw error;

            if (result === 'NOT_FOUND') {
                alert(language === 'es' ? "Caso no encontrado durante la eliminación." : "Case ID not found during deletion.");
            }
            navigate('/internal-affairs/cases');
        } catch (err) {
            alert('Error deleting case: ' + err.message);
            setLoading(false);
        }
    };

    const startEditingInfo = () => {
        setEditTitle(caseData.info.title);
        setEditLocation(caseData.info.location || '');
        const dt = new Date(caseData.info.occurred_at);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        setEditOccurredAt(dt.toISOString().slice(0, 16));
        setEditDescription(caseData.info.description || '');
        setEditInitialImage(null);
        setIsEditingInfo(true);
    };

    const handleSaveInfo = async () => {
        try {
            const finalDescription = await processHtmlImages(editDescription, 'cases');
            const { error } = await supabase.rpc('update_ia_case_details', {
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
                    .from('ia_cases')
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

    const handleGoToUpdate = (updateId) => {
        const element = document.getElementById(`ia-update-${updateId}`);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    if (loading) return (
        <div className="mac-doc-empty">
            <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#ef4444' }}></span>
            <span>{language === 'es' ? 'Cargando investigación de Asuntos Internos...' : 'Loading IA investigation...'}</span>
        </div>
    );

    if (!caseData) return (
        <div className="mac-doc-empty">
            <span>{language === 'es' ? 'No se encontró la investigación solicitada.' : 'Requested IA case not found.'}</span>
        </div>
    );

    const { info, assignments = [], updates = [], interrogations = [] } = caseData;

    const userIsHighCommand = currentUser && (
        ['Coordinador', 'Administrador', 'Comisionado', 'Director', 'Fundador'].includes(currentUser.rol) ||
        ['Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief', 'Comandante', 'Capitan', 'Teniente'].includes(currentUser.rango)
    );

    const userIsIAUser = currentUser && (
        (currentUser.divisions && currentUser.divisions.includes('Internal Affairs')) ||
        currentUser.rol === 'Administrador'
    );

    const isAssigned = currentUser && assignments && assignments.some(a => a.user_id === currentUser.id);
    const canEditCase = userIsIAUser && (userIsHighCommand || info.created_by === currentUser?.id || isAssigned);
    const isCaseOpen = !info || !info.status || info.status.toLowerCase() === 'open' || info.status.toLowerCase() === 'abierto';

    const statusColor = isCaseOpen ? '#10b981' : info.status === 'Closed' || info.status === 'Cerrado' ? '#ef4444' : '#64748b';
    const statusText = isCaseOpen ? (language === 'es' ? 'ABIERTO' : 'OPEN') : info.status === 'Closed' || info.status === 'Cerrado' ? (language === 'es' ? 'CERRADO' : 'CLOSED') : (language === 'es' ? 'ARCHIVADO' : 'ARCHIVED');
    const isRestricted = info.is_hidden_from_all || (info.hidden_user_ids && info.hidden_user_ids.length > 0);

    return (
        <div className="mac-dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <button
                    onClick={() => navigate('/internal-affairs/cases')}
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
                    <span>{language === 'es' ? 'Volver a Investigaciones' : 'Back to IA Cases'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={() => setShowBoardModal(true)}
                        style={{
                            padding: '0.3rem 0.8rem',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #d97706, #b45309)',
                            borderColor: '#f59e0b',
                            color: '#ffffff',
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="17" x2="12" y2="22" />
                            <path d="M5 17h14l-1.5-6h2L18 3H6L4.5 11h2z" />
                        </svg>
                        <span>📌 {language === 'es' ? 'Pizarra del Caso' : 'Case Board'}</span>
                    </button>

                    {canEditCase && (
                        <button
                            className="mac-btn mac-btn-secondary"
                            onClick={openPrivacyModal}
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '6px', color: '#f87171' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span>{language === 'es' ? 'Privacidad' : 'Privacy'}</span>
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
                            <span>{language === 'es' ? 'Editar Detalles' : 'Edit Details'}</span>
                        </button>
                    )}

                    {isCaseOpen && userIsIAUser && (
                        <>
                            <button
                                className="mac-btn mac-btn-secondary"
                                onClick={() => handleStatusChange('Closed')}
                                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#f87171' }}
                            >
                                {language === 'es' ? 'Cerrar Caso' : 'Close Case'}
                            </button>
                            <button
                                className="mac-btn mac-btn-secondary"
                                onClick={() => handleStatusChange('Archived')}
                                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#94a3b8' }}
                            >
                                {language === 'es' ? 'Archivar' : 'Archive'}
                            </button>
                        </>
                    )}

                    {!isCaseOpen && userIsIAUser && (
                        <button
                            className="mac-btn mac-btn-secondary"
                            onClick={() => handleStatusChange('Open')}
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', color: '#10b981' }}
                        >
                            {language === 'es' ? 'Reabrir Caso' : 'Reopen Case'}
                        </button>
                    )}

                    {userIsHighCommand && (
                        <button
                            className="mac-btn"
                            onClick={handleDeleteCase}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <span>{language === 'es' ? 'Eliminar' : 'Delete'}</span>
                        </button>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.015em' }}>
                        CASO-IA #{String(info.case_number).padStart(3, '0')} {info.title}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33`, padding: '0.15rem 0.5rem', borderRadius: '6px', textTransform: 'uppercase' }}>
                        {statusText}
                    </span>
                    {isRestricted && (
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span>{language === 'es' ? 'Restringido' : 'Restricted'}</span>
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem', display: 'flex', gap: '0.8rem' }}>
                    <span>📍 {info.location || (language === 'es' ? 'Ubicación no especificada' : 'Unspecified location')}</span>
                    <span>📅 {new Date(info.occurred_at).toLocaleString()}</span>
                </div>
            </div>

            {isEditingInfo && (
                <div className="mac-widget-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#ffffff', fontSize: '0.9rem' }}>{language === 'es' ? 'Editar Detalles' : 'Edit Details'}</h4>
                    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{language === 'es' ? 'Título del Caso' : 'Case Title'}</label>
                            <input type="text" className="mac-form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Ubicación' : 'Location'}</label>
                                <input type="text" className="mac-form-input" value={editLocation} onChange={e => setEditLocation(e.target.value)} />
                            </div>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Fecha y Hora' : 'Date & Time'}</label>
                                <input type="datetime-local" className="mac-form-input" value={editOccurredAt} onChange={e => setEditOccurredAt(e.target.value)} />
                            </div>
                        </div>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{language === 'es' ? 'Reporte Inicial' : 'Initial Report'}</label>
                            <textarea
                                className="eval-textarea"
                                rows="5"
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', padding: '0.65rem' }}
                            />
                        </div>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{language === 'es' ? 'Imagen Inicial de Evidencia' : 'Initial Evidence Image'}</label>
                            {(editInitialImage || (editInitialImage === null && info.initial_image_url)) && (
                                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
                                    <img src={editInitialImage || info.initial_image_url} alt="" style={{ maxHeight: '140px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }} />
                                    <button type="button" onClick={() => setEditInitialImage('')} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                            )}
                            <label className="mac-btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', height: '40px', borderStyle: 'dashed' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </svg>
                                <span>{language === 'es' ? 'Cambiar Imagen' : 'Change Image'}</span>
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.readAsDataURL(file);
                                    reader.onload = (ev) => setEditInitialImage(ev.target.result);
                                }} />
                            </label>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button className="mac-btn mac-btn-secondary" onClick={() => setIsEditingInfo(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                        <button className="mac-btn mac-btn-primary" onClick={handleSaveInfo}>{language === 'es' ? 'Guardar Cambios' : 'Save Changes'}</button>
                    </div>
                </div>
            )}

            {!isEditingInfo && (
                <div className="mac-widget-card" style={{ padding: '0.85rem 1.1rem', marginBottom: '1.25rem', borderLeft: '3px solid #ef4444' }}>
                    <h4 style={{ margin: '0 0 0.4rem 0', color: '#f87171', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                        {language === 'es' ? 'CLAVES DE LA INVESTIGACIÓN' : 'CASE KEYS'}
                    </h4>
                    {info.initial_image_url && (
                        <div
                            style={{ marginBottom: '0.6rem', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', maxWidth: '320px', border: '1px solid rgba(255,255,255,0.12)' }}
                            onClick={() => setExpandedImage(info.initial_image_url)}
                        >
                            <img src={info.initial_image_url} alt="Initial Evidence" style={{ width: '100%', display: 'block' }} />
                        </div>
                    )}
                    <div style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                        {info.description}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '1.25rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div className="mac-doc-tabs" style={{ margin: 0, padding: '0.25rem' }}>
                            <button
                                className={`mac-doc-tab ${activeTab === 'updates' ? 'active' : ''}`}
                                onClick={() => setActiveTab('updates')}
                                style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>{language === 'es' ? 'Bitácora de Investigación' : 'Investigation Log'}</span>
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
                                <span>{language === 'es' ? 'Lista de Tareas' : 'To-Do List'}</span>
                            </button>
                            <button
                                className={`mac-doc-tab ${activeTab === 'sanction_votes' ? 'active' : ''}`}
                                onClick={() => setActiveTab('sanction_votes')}
                                style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3v18"/>
                                    <path d="M5 8l7-5 7 5"/>
                                    <path d="M5 12h14"/>
                                </svg>
                                <span>{language === 'es' ? 'Votación de Sanción' : 'Sanction Voting'}</span>
                            </button>
                        </div>

                        <button
                            className="mac-btn"
                            onClick={() => setShowBoardModal(true)}
                            style={{
                                padding: '0.4rem 0.9rem',
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                borderRadius: '10px',
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: '#fbbf24',
                                fontWeight: 700
                            }}
                        >
                            <span>📌 {language === 'es' ? 'Abrir Pizarra Completa' : 'Open Full Board'}</span>
                        </button>
                    </div>

                    {activeTab === 'updates' && (
                        <>
                            {info.status === 'Open' && (
                                <div className="mac-widget-card" style={{ marginBottom: '1rem', padding: '0.9rem 1.1rem' }}>
                                    <h4 style={{ margin: '0 0 0.6rem 0', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {language === 'es' ? 'Registrar Nueva Novedad / Evidencia' : 'Log New Update / Evidence'}
                                    </h4>
                                    <form onSubmit={handlePostUpdate}>
                                        <ReactQuill
                                            theme="snow"
                                            modules={quillModules}
                                            formats={quillFormats}
                                            placeholder={language === 'es' ? 'Registrar un nuevo hallazgo, evidencia o declaración...' : 'Log a new finding, evidence or statement...'}
                                            value={newUpdateContent}
                                            onChange={setNewUpdateContent}
                                            style={{ marginBottom: '0.75rem' }}
                                        />

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
                                                <span>{language === 'es' ? 'Adjuntar Evidencia' : 'Attach Evidence'}</span>
                                            </label>

                                            <button type="submit" className="mac-btn mac-btn-primary" style={{ padding: '0.38rem 0.9rem', fontSize: '0.78rem', background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.5)', color: '#f87171' }} disabled={submittingUpdate}>
                                                {submittingUpdate ? (language === 'es' ? 'Publicando...' : 'Posting...') : (language === 'es' ? 'Publicar Novedad' : 'Post Update')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {updates.length === 0 ? (
                                    <div className="mac-doc-empty">
                                        <span>{language === 'es' ? 'No se han registrado novedades en esta investigación.' : 'No updates recorded yet.'}</span>
                                    </div>
                                ) : (
                                    updates.map(update => {
                                        const isAuthor = currentUser && (currentUser.id === update.user_id || currentUser.id === update.author_id);
                                        const isAssignedEncargado = currentUser && assignments && assignments.some(a => a.user_id === currentUser.id && (a.role === 'Encargado' || a.role === 'Supervisor'));
                                        const isCreator = currentUser && info.created_by === currentUser.id;
                                        const canEditThisUpdate = isAuthor || userIsHighCommand || isAssignedEncargado || isCreator;
                                        const isEditing = editingId === update.id;

                                        return (
                                            <div
                                                key={update.id}
                                                id={`ia-update-${update.id}`}
                                                className="mac-widget-card"
                                                style={{ position: 'relative', padding: '0.9rem 1.1rem' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', paddingBottom: '0.45rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <img src={update.author_avatar || '/logowebp/anon.webp'} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>{update.author_rank} {update.author_name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(update.created_at).toLocaleString()}</div>
                                                        </div>
                                                    </div>

                                                    {canEditThisUpdate && !isEditing && (
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button onClick={() => handleStartEdit(update)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }} title="Editar">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteUpdate(update.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px 4px' }} title="Eliminar">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {isEditing ? (
                                                    <div>
                                                        <ReactQuill
                                                            theme="snow"
                                                            modules={quillModules}
                                                            formats={quillFormats}
                                                            value={editContent}
                                                            onChange={setEditContent}
                                                            style={{ marginBottom: '0.5rem' }}
                                                        />

                                                        {/* Edit Image Previews & Deletion */}
                                                        {editImages.length > 0 && (
                                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
                                                                {editImages.map((imgSrc, idx) => (
                                                                    <div key={idx} style={{ position: 'relative' }}>
                                                                        <img src={imgSrc} alt="" style={{ height: '64px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }} />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                                                                            style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}
                                                                            title="Eliminar foto"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
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
                                                                <input type="file" accept="image/*" multiple onChange={handleEditImageUpload} style={{ display: 'none' }} />
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                                    <circle cx="12" cy="13" r="4" />
                                                                </svg>
                                                                <span>Adjuntar Fotografías</span>
                                                            </label>

                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <button className="mac-btn mac-btn-secondary" onClick={() => { setEditingId(null); setEditImages([]); }} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                                                                    Cancelar
                                                                </button>
                                                                <button className="mac-btn mac-btn-primary" onClick={() => handleSaveEdit(update.id)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} disabled={submittingEdit}>
                                                                    {submittingEdit ? 'Guardando...' : 'Guardar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div
                                                            className="quill-content"
                                                            style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: '1.5', marginBottom: (update.images?.length > 0 || update.image) ? '0.6rem' : '0' }}
                                                            dangerouslySetInnerHTML={{ __html: update.content }}
                                                        />

                                                        {(update.images && update.images.length > 0) ? (
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                {update.images.map((imgUrl, i) => (
                                                                    <div key={i} style={{ borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setExpandedImage(imgUrl)}>
                                                                        <img src={imgUrl} alt="" style={{ height: '90px', display: 'block', objectFit: 'cover' }} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : update.image ? (
                                                            <div style={{ borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block' }} onClick={() => setExpandedImage(update.image)}>
                                                                <img src={update.image} alt="" style={{ height: '90px', display: 'block', objectFit: 'cover' }} />
                                                            </div>
                                                        ) : null}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'todo' && <IACaseTodoList caseId={id} isClosed={!isCaseOpen} />}
                    {activeTab === 'sanction_votes' && (
                        <IASanctionVoting 
                            caseId={id} 
                            currentUser={currentUser} 
                            userIsIAUser={userIsIAUser} 
                            canEditCase={(canEditCase || userIsIAUser) && isCaseOpen} 
                        />
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="mac-widget-card" style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                    <h4 style={{ margin: 0, fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AGENTES ASIGNADOS</h4>
                                </div>
                                {isCaseOpen && userIsIAUser && (
                                    <button onClick={openAssignModal} className="mac-btn mac-btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                        Gestionar
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {assignments.length === 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sin agentes asignados</span>
                                ) : (
                                    assignments.map(user => (
                                        <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                            <img src={user.avatar || '/logowebp/anon.webp'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', objectFit: 'cover' }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {user.rank} {user.full_name}
                                                </div>
                                            </div>
                                            {isCaseOpen && userIsIAUser ? (
                                                <select
                                                    value={user.role || 'Investigador'}
                                                    onChange={(e) => handleUpdateRole(user.user_id, e.target.value)}
                                                    style={{ background: 'rgba(0,0,0,0.5)', color: '#f87171', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '1px 4px', fontSize: '0.7rem', cursor: 'pointer' }}
                                                >
                                                    <option value="Supervisor" style={{ background: '#1e293b', color: '#fff' }}>Supervisor</option>
                                                    <option value="Encargado" style={{ background: '#1e293b', color: '#fff' }}>Encargado</option>
                                                    <option value="Investigador" style={{ background: '#1e293b', color: '#fff' }}>Investigador</option>
                                                    <option value="Ayudante" style={{ background: '#1e293b', color: '#fff' }}>Ayudante</option>
                                                    <option value="Externo" style={{ background: '#1e293b', color: '#fff' }}>Externo</option>
                                                </select>
                                            ) : (
                                                <span style={{ fontSize: '0.68rem', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                                    {user.role || 'Investigador'}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mac-widget-card" style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <h4 style={{ margin: 0, fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>INTERROGATORIOS</h4>
                                </div>
                                {isCaseOpen && userIsIAUser && (
                                    <button onClick={loadAvailableInterrogations} className="mac-btn mac-btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                        Vincular
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {interrogations.length === 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sin interrogatorios vinculados</span>
                                ) : (
                                    interrogations.map(inv => (
                                        <div key={inv.id} onClick={() => navigate(`/internal-affairs/interrogations?search=${encodeURIComponent(inv.title)}`)} style={{ padding: '0.45rem 0.55rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', cursor: 'pointer', borderLeft: '2px solid #14b8a6', position: 'relative' }}>
                                            <div style={{ paddingRight: '18px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#ffffff' }}>{inv.title}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                                            </div>
                                            {isCaseOpen && userIsIAUser && (
                                                <button onClick={(e) => { e.stopPropagation(); handleUnlinkInterrogation(inv.id); }} style={{ position: 'absolute', top: '2px', right: '4px', background: 'none', border: 'none', color: '#f87171', fontSize: '0.9rem', cursor: 'pointer' }} title="Desvincular">
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mac-widget-card" style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                                    </svg>
                                    <h4 style={{ margin: 0, fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>DENUNCIAS VINCULADAS</h4>
                                </div>
                                {isCaseOpen && userIsIAUser && (
                                    <button onClick={openLinkComplaintModal} className="mac-btn mac-btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                        Vincular
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {complaints.length === 0 ? (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sin denuncias vinculadas</span>
                                ) : (
                                    complaints.map(comp => (
                                        <div key={comp.id} onClick={() => setSelectedComplaint(comp)} style={{ padding: '0.45rem 0.55rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', cursor: 'pointer', borderLeft: '2px solid #38bdf8', position: 'relative' }}>
                                            <div style={{ paddingRight: '18px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#38bdf8', textDecoration: 'underline' }}>{comp.motivo || comp.titulo}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Por: {comp.denunciante_nombre}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{new Date(comp.created_at).toLocaleDateString()}</div>
                                            </div>
                                            {isCaseOpen && userIsIAUser && (
                                                <button onClick={(e) => { e.stopPropagation(); handleUnlinkComplaint(comp.id); }} style={{ position: 'absolute', top: '2px', right: '4px', background: 'none', border: 'none', color: '#f87171', fontSize: '0.9rem', cursor: 'pointer' }} title="Desvincular">
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
            </div>

            {showAssignModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '420px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowAssignModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">{language === 'es' ? 'Gestionar Asignación de IA' : 'Manage IA Assignment'}</span>
                            <div style={{ width: 52 }} />
                        </div>
                        <div className="mac-modal-body">
                            <div style={{ maxHeight: '220px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
                                {users.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => toggleAssignmentSelection(!selectedAssignments.includes(u.id), u.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem',
                                            cursor: 'pointer', background: selectedAssignments.includes(u.id) ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <input type="checkbox" checked={selectedAssignments.includes(u.id)} readOnly style={{ marginRight: '10px', pointerEvents: 'none' }} />
                                        <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' }} />
                                        <span style={{ fontSize: '0.85rem', color: '#fff' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button className="mac-btn mac-btn-secondary" onClick={() => setShowAssignModal(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                                <button className="mac-btn mac-btn-primary" onClick={handleUpdateAssignments}>{language === 'es' ? 'Guardar Cambios' : 'Save Changes'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPrivacyModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '480px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowPrivacyModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">{language === 'es' ? 'Ajustes de Privacidad' : 'Privacy Settings'}</span>
                            <div style={{ width: 52 }} />
                        </div>
                        <div className="mac-modal-body">
                            <div style={{ marginBottom: '1rem', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem', color: '#f87171', fontWeight: 700 }}>
                                    <input
                                        type="checkbox"
                                        checked={isHiddenFromAll}
                                        onChange={e => setIsHiddenFromAll(e.target.checked)}
                                        style={{ marginRight: '10px' }}
                                    />
                                    {language === 'es' ? 'Ocultar caso a todos los miembros de IA' : 'Hide case from all IA members'}
                                </label>
                            </div>

                            {!isHiddenFromAll && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                                        {language === 'es' ? 'Seleccione los miembros a los que desea ocultar este caso:' : 'Select members to hide this case from:'}
                                    </span>
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {users.map(u => (
                                            <div
                                                key={u.id}
                                                onClick={() => togglePrivacyHiddenUser(u.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem',
                                                    cursor: 'pointer', background: selectedHiddenUsers.includes(u.id) ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                }}
                                            >
                                                <input type="checkbox" checked={selectedHiddenUsers.includes(u.id)} readOnly style={{ marginRight: '10px', pointerEvents: 'none' }} />
                                                <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' }} />
                                                <span style={{ fontSize: '0.85rem', color: '#fff' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button className="mac-btn mac-btn-secondary" onClick={() => setShowPrivacyModal(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                                <button className="mac-btn mac-btn-primary" onClick={handleSavePrivacy} disabled={savingPrivacy} style={{ background: 'rgba(239, 68, 68, 0.3)', borderColor: 'rgba(239, 68, 68, 0.6)', color: '#f87171' }}>
                                    {savingPrivacy ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar Cambios' : 'Save Changes')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLinkModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '480px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowLinkModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">{language === 'es' ? 'Vincular Interrogatorio de IA' : 'Link IA Interrogation'}</span>
                            <div style={{ width: 52 }} />
                        </div>
                        <div className="mac-modal-body">
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                                {language === 'es' ? 'Seleccione un interrogatorio registrado para asociarlo a este expediente.' : 'Select an interrogation to attach to this case.'}
                            </p>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
                                {availableInterrogations.length === 0 ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                        {language === 'es' ? 'No se encontraron interrogatorios disponibles para vincular.' : 'No available interrogations found.'}
                                    </div>
                                ) : (
                                    availableInterrogations.map(int => (
                                        <div
                                            key={int.id}
                                            onClick={() => handleLinkInterrogation(int.id)}
                                            style={{
                                                padding: '0.65rem 0.85rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>{int.title}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{language === 'es' ? 'Sujeto: ' : 'Subject: '}{int.subjects}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(int.created_at).toLocaleDateString()}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="mac-btn mac-btn-secondary" onClick={() => setShowLinkModal(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLinkComplaintModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '520px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowLinkComplaintModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">{language === 'es' ? 'Vincular Denuncia de IA' : 'Link IA Complaint'}</span>
                            <div style={{ width: 52 }} />
                        </div>
                        <div className="mac-modal-body">
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                                {language === 'es' ? 'Seleccione una denuncia entrante o no asignada para vincularla a este caso.' : 'Select an incoming complaint to attach to this case.'}
                            </p>
                            <div style={{ maxHeight: '240px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
                                {availableComplaints.length === 0 ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                        {language === 'es' ? 'No se encontraron denuncias disponibles para vincular.' : 'No available complaints found.'}
                                    </div>
                                ) : (
                                    availableComplaints.map(comp => (
                                        <div
                                            key={comp.id}
                                            onClick={() => handleLinkComplaint(comp.id)}
                                            style={{
                                                padding: '0.65rem 0.85rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: 'transparent',
                                                transition: 'background 0.2s',
                                                borderLeft: '3px solid #38bdf8'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8' }}>{comp.motivo || comp.titulo || 'Denuncia sin título'}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Por: {comp.denunciante_nombre || 'Anónimo'}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Fecha: {new Date(comp.created_at).toLocaleDateString()}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="mac-btn mac-btn-secondary" onClick={() => setShowLinkComplaintModal(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedComplaint && (
                <div className="mac-modal-overlay" onClick={() => setSelectedComplaint(null)}>
                    <div className="mac-modal-card" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setSelectedComplaint(null)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">{language === 'es' ? 'Detalle de Denuncia Confidencial' : 'Confidential Complaint Details'}</span>
                            <div style={{ width: 52 }} />
                        </div>
                        <div className="mac-modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                                <div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Denunciante:</span>
                                    <p style={{ color: '#ffffff', fontSize: '0.9rem', margin: '0.1rem 0 0 0', fontWeight: 700 }}>{selectedComplaint.denunciante_nombre}</p>
                                </div>
                                <div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Nº Teléfono:</span>
                                    <p style={{ color: '#ffffff', fontSize: '0.9rem', margin: '0.1rem 0 0 0', fontWeight: 700 }}>{selectedComplaint.denunciante_telefono || 'N/A'}</p>
                                </div>
                                <div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Denunciado:</span>
                                    <p style={{ color: '#f87171', fontSize: '0.9rem', margin: '0.1rem 0 0 0', fontWeight: 700 }}>{selectedComplaint.denunciado_nombre_placa || 'Desconocido'}</p>
                                </div>
                                <div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Fecha de los Hechos:</span>
                                    <p style={{ color: '#ffffff', fontSize: '0.9rem', margin: '0.1rem 0 0 0' }}>{selectedComplaint.fecha_hechos || 'N/A'}</p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '0.85rem' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Motivo de la Denuncia:</span>
                                <p style={{ color: '#38bdf8', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 700 }}>{selectedComplaint.motivo || selectedComplaint.titulo}</p>
                            </div>

                            <div style={{ marginBottom: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Declaración de los Hechos:</span>
                                <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '0.3rem 0 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                    {selectedComplaint.declaracion || selectedComplaint.descripcion || 'Sin declaración registrada'}
                                </p>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Pruebas Aportadas:</span>
                                {selectedComplaint.pruebas ? (
                                    <div style={{ marginTop: '0.4rem', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                                        {selectedComplaint.pruebas.includes('Imagen adjunta:') ? (
                                            (() => {
                                                const parts = selectedComplaint.pruebas.split('Imagen adjunta:');
                                                const linkPart = parts[0].replace('Enlace: ', '').trim();
                                                const imagePart = parts[1].trim();
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                        {linkPart && (
                                                            <div>
                                                                <a href={linkPart} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>{linkPart}</a>
                                                            </div>
                                                        )}
                                                        {imagePart && (
                                                            <div>
                                                                <img src={imagePart} alt="Evidencia" style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            selectedComplaint.pruebas.startsWith('data:image') ? (
                                                <img src={selectedComplaint.pruebas} alt="Evidencia" style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                            ) : (
                                                <a href={selectedComplaint.pruebas} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>{selectedComplaint.pruebas}</a>
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: '0.2rem 0 0 0', fontSize: '0.82rem' }}>Ninguna prueba adjunta</p>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button className="mac-btn mac-btn-secondary" onClick={() => setSelectedComplaint(null)}>
                                    {language === 'es' ? 'Cerrar Detalles' : 'Close Details'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN APPLE MAC OS WHITEBOARD MODAL */}
            {showBoardModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    background: 'rgba(8, 9, 13, 0.96)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Apple macOS Traffic Light Window Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(15, 23, 42, 0.95)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                        userSelect: 'none'
                    }}>
                        {/* Traffic light buttons with macOS hover animation */}
                        <div className="mac-window-dots">
                            <div
                                className="mac-window-dot close"
                                onClick={() => setShowBoardModal(false)}
                                title="Cerrar Pizarra (Esc)"
                            />
                            <div
                                className="mac-window-dot min"
                                onClick={() => setShowBoardModal(false)}
                                title="Minimizar (Esc)"
                            />
                            <div
                                className="mac-window-dot max"
                                title="Pantalla Completa"
                            />
                        </div>

                        {/* Title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>📌</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                                {language === 'es' ? 'Pizarra de Investigación' : 'Investigation Whiteboard'} #{String(info.case_number).padStart(3, '0')} - {info.title}
                            </span>
                        </div>

                        {/* Spacer for symmetry */}
                        <div style={{ width: '60px' }} />
                    </div>

                    {/* Canvas Container */}
                    <div style={{ flex: 1, width: '100%', height: 'calc(100vh - 48px)', position: 'relative', overflow: 'hidden' }}>
                        <CaseWhiteboard
                            caseId={id}
                            isIA={true}
                            caseData={info}
                            onGoToUpdate={(updateId) => {
                                setShowBoardModal(false);
                                handleGoToUpdate(updateId);
                            }}
                        />
                    </div>
                </div>
            )}

            {expandedImage && (
                <div className="mac-modal-overlay" style={{ zIndex: 9999, cursor: 'zoom-out' }} onClick={() => setExpandedImage(null)}>
                    <img src={expandedImage} alt="Expanded" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }} />
                </div>
            )}
        </div>
    );
}

export default IACaseDetail;

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';
import DOJCaseTodoList from '../components/DOJCaseTodoList';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { makeQuillModules, quillFormats } from '../utils/quillConfig';

function DOJCaseDetail() {
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

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [editImages, setEditImages] = useState([]);
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Edit Case Details State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editInfoForm, setEditInfoForm] = useState({ title: '', location: '', description: '' });
    const [savingInfo, setSavingInfo] = useState(false);

    // Quill config
    const quillModules = useMemo(() => makeQuillModules(), []);

    // Image Viewer Lightbox
    const [expandedImage, setExpandedImage] = useState(null);

    // Modals
    const [users, setUsers] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignments, setSelectedAssignments] = useState([]);

    const [currentUser, setCurrentUser] = useState(null);

    // Interrogations Linking State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [availableInterrogations, setAvailableInterrogations] = useState([]);

    const loadAvailableInterrogations = async () => {
        try {
            const { data, error } = await supabase.rpc('get_available_doj_interrogations_to_link');
            if (error) {
                // Fallback direct query if RPC is not present
                const fallback = await supabase
                    .from('doj_interrogations')
                    .select('id, title, subjects, created_at')
                    .is('case_id', null)
                    .order('created_at', { ascending: false });
                if (fallback.error) throw fallback.error;
                setAvailableInterrogations(fallback.data || []);
            } else {
                setAvailableInterrogations(data || []);
            }
            setShowLinkModal(true);
        } catch (err) {
            alert('Error loading interrogations: ' + err.message);
        }
    };

    const handleLinkInterrogation = async (interrogationId) => {
        try {
            const { error } = await supabase.rpc('manage_doj_interrogation', {
                p_action: 'link',
                p_id: interrogationId,
                p_case_id: id
            });
            if (error) {
                // Fallback table update
                const fallback = await supabase
                    .from('doj_interrogations')
                    .update({ case_id: id })
                    .eq('id', interrogationId);
                if (fallback.error) throw fallback.error;
            }
            setShowLinkModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error linking interrogation: ' + err.message);
        }
    };

    const handleUnlinkInterrogation = async (interrogationId) => {
        if (!window.confirm(language === 'es' ? "¿Desvincular este interrogatorio del sumario?" : "Unlink this interrogation from the case?")) return;
        try {
            const { error } = await supabase.rpc('manage_doj_interrogation', {
                p_action: 'unlink',
                p_id: interrogationId
            });
            if (error) {
                const fallback = await supabase
                    .from('doj_interrogations')
                    .update({ case_id: null })
                    .eq('id', interrogationId);
                if (fallback.error) throw fallback.error;
            }
            loadCaseDetails();
        } catch (err) {
            alert('Error unlinking: ' + err.message);
        }
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

    const loadCaseDetails = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_doj_case_details', { p_case_id: id });
        if (error) {
            console.error('Error loading DOJ case:', error);
            alert('Failed to load investigation details.');
        } else {
            setCaseData(data);
            const currentIds = data.assignments ? data.assignments.map(a => a.user_id) : [];
            setSelectedAssignments(currentIds);
            if (data.info) {
                setEditInfoForm({
                    title: data.info.title || '',
                    location: data.info.location || '',
                    description: data.info.description || ''
                });
            }
        }
        setLoading(false);
    };

    const handleStatusChange = async (newStatus) => {
        try {
            const { error } = await supabase
                .from('doj_cases')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert('Error updating case status: ' + err.message);
        }
    };

    const handleSaveInfo = async (e) => {
        e.preventDefault();
        setSavingInfo(true);
        try {
            const { error } = await supabase
                .from('doj_cases')
                .update({
                    title: editInfoForm.title,
                    location: editInfoForm.location,
                    description: editInfoForm.description
                })
                .eq('id', id);

            if (error) throw error;
            setIsEditingInfo(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error updating investigation details: ' + err.message);
        } finally {
            setSavingInfo(false);
        }
    };

    const openAssignModal = async () => {
        if (users.length === 0) {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, divisions, profile_image').order('rango');
            if (data) {
                const dojUsers = data.filter(u =>
                    (u.divisions && u.divisions.includes('DOJ')) ||
                    u.rol === 'Administrador'
                );
                setUsers(dojUsers);
            }
        }
        if (caseData?.assignments) {
            setSelectedAssignments(caseData.assignments.map(a => a.user_id));
        }
        setShowAssignModal(true);
    };

    const handleUpdateAssignments = async () => {
        try {
            const { error } = await supabase.rpc('update_doj_case_assignments', {
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

    const toggleAssignmentSelection = (status, userId) => {
        if (status) {
            setSelectedAssignments(prev => [...prev, userId]);
        } else {
            setSelectedAssignments(prev => prev.filter(uid => uid !== userId));
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

    const handlePostUpdate = async (e) => {
        e.preventDefault();
        const isTextEmpty = newUpdateContent.replace(/<[^>]*>/g, '').trim() === '';
        if (isTextEmpty && newUpdateImages.length === 0) {
            alert(language === 'es' ? "Por favor ingrese texto o adjunte una imagen." : "Please enter text or attach an image.");
            return;
        }

        setSubmittingUpdate(true);
        try {
            const { error } = await supabase.rpc('add_doj_case_update', {
                p_case_id: id,
                p_content: newUpdateContent,
                p_images: newUpdateImages
            });

            if (error) throw error;

            setNewUpdateContent('');
            setNewUpdateImages([]);
            loadCaseDetails();
        } catch (err) {
            alert('Error posting update: ' + err.message);
        } finally {
            setSubmittingUpdate(false);
        }
    };

    const handleStartEdit = (update) => {
        setEditingId(update.id);
        setEditContent(update.content || "");
        const initialImgs = update.images && update.images.length > 0 
            ? [...update.images] 
            : (update.image ? [update.image] : []);
        setEditImages(initialImgs);
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

    const handleSaveEdit = async (updateId) => {
        const isTextEmpty = editContent.replace(/<[^>]*>/g, '').trim() === '';
        if (isTextEmpty && editImages.length === 0) {
            alert(language === 'es' ? "Por favor ingrese texto o adjunte una imagen." : "Please enter text or attach an image.");
            return;
        }

        setSubmittingEdit(true);
        try {
            let uploadedImages = [];
            if (editImages.length > 0) {
                uploadedImages = await Promise.all(
                    editImages.map(async img => {
                        if (img && img.startsWith('data:')) {
                            return await uploadImageToStorage(img, 'cases');
                        }
                        return img;
                    })
                );
            }

            const { error } = await supabase.rpc('update_doj_case_update_content', {
                p_update_id: updateId,
                p_content: editContent,
                p_images: uploadedImages
            });

            if (error) {
                // Direct update fallback
                const fallback = await supabase
                    .from('doj_case_updates')
                    .update({ content: editContent, images: uploadedImages })
                    .eq('id', updateId);
                if (fallback.error) throw fallback.error;
            }

            setEditingId(null);
            setEditImages([]);
            loadCaseDetails();
        } catch (err) {
            alert('Error updating note: ' + err.message);
        } finally {
            setSubmittingEdit(false);
        }
    };

    const handleDeleteUpdate = async (updateId) => {
        if (!window.confirm(language === 'es' ? "¿Está seguro de eliminar esta entrada del sumario?" : "Are you sure you want to delete this message?")) return;
        try {
            const { error } = await supabase.rpc('delete_doj_case_update', { p_update_id: updateId });
            if (error) {
                const fallback = await supabase.from('doj_case_updates').delete().eq('id', updateId);
                if (fallback.error) throw fallback.error;
            }
            loadCaseDetails();
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    };

    if (loading) {
        return (
            <div className="mac-dashboard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#94a3b8' }}>
                <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#3b82f6', width: '12px', height: '12px', display: 'inline-block', marginBottom: '1rem', borderRadius: '50%' }}></span>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>
                    {language === 'es' ? 'Cargando sumario judicial...' : 'Loading Legal Inquest...'}
                </div>
            </div>
        );
    }

    if (!caseData || !caseData.info) {
        return (
            <div className="mac-dashboard-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <h2 style={{ color: '#ef4444' }}>{language === 'es' ? 'Sumario No Encontrado' : 'Investigation Not Found'}</h2>
                <button
                    onClick={() => navigate('/doj/cases')}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        marginTop: '1rem'
                    }}
                >
                    {language === 'es' ? 'Volver a Casos' : 'Return to Cases'}
                </button>
            </div>
        );
    }

    const { info, assignments = [], updates = [], interrogations = [] } = caseData;
    const isCaseOpen = info.status === 'Open';

    const statusBadgeColors = {
        'Open': { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', text: '#34d399' },
        'Closed': { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', text: '#f87171' },
        'Archived': { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.35)', text: '#94a3b8' }
    };
    const badgeStyle = statusBadgeColors[info.status] || statusBadgeColors['Archived'];

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Top Command Action Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <button
                    type="button"
                    onClick={() => navigate('/doj/cases')}
                    style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '9999px',
                        padding: '0.35rem 0.85rem',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                    <span>{language === 'es' ? 'Volver a Investigaciones' : 'Back to Legal Cases'}</span>
                </button>

                {/* Status Switcher Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {!isEditingInfo && (
                        <button
                            type="button"
                            onClick={() => setIsEditingInfo(true)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#e2e8f0',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '10px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>{language === 'es' ? 'Editar Sumario' : 'Edit Inquiry'}</span>
                        </button>
                    )}

                    {info.status === 'Open' ? (
                        <>
                            <button
                                type="button"
                                onClick={() => handleStatusChange('Closed')}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    color: '#f87171',
                                    padding: '0.35rem 0.85rem',
                                    borderRadius: '10px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cerrar Sumario' : 'Close Case'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStatusChange('Archived')}
                                style={{
                                    background: 'rgba(100, 116, 139, 0.15)',
                                    border: '1px solid rgba(100, 116, 139, 0.35)',
                                    color: '#94a3b8',
                                    padding: '0.35rem 0.85rem',
                                    borderRadius: '10px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Archivar Sumario' : 'Archive Case'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleStatusChange('Open')}
                            style={{
                                background: 'rgba(16, 185, 129, 0.18)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#34d399',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '10px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            {language === 'es' ? 'Reabrir Sumario' : 'Re-open Case'}
                        </button>
                    )}
                </div>
            </div>

            {/* Case Details Hero Card */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '24px',
                padding: '2rem',
                marginBottom: '2rem',
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}>
                {isEditingInfo ? (
                    <form onSubmit={handleSaveInfo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{language === 'es' ? 'Título del Sumario' : 'Case Title'}</label>
                            <input
                                type="text"
                                className="mac-form-input"
                                required
                                value={editInfoForm.title}
                                onChange={e => setEditInfoForm({ ...editInfoForm, title: e.target.value })}
                            />
                        </div>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{language === 'es' ? 'Localización / Jurisdicción' : 'Location'}</label>
                            <input
                                type="text"
                                className="mac-form-input"
                                required
                                value={editInfoForm.location}
                                onChange={e => setEditInfoForm({ ...editInfoForm, location: e.target.value })}
                            />
                        </div>
                        <div className="mac-form-group">
                            <label className="mac-form-label">{language === 'es' ? 'Relato de Hechos / Informe Inicial' : 'Description'}</label>
                            <textarea
                                className="mac-form-textarea"
                                rows="4"
                                required
                                value={editInfoForm.description}
                                onChange={e => setEditInfoForm({ ...editInfoForm, description: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsEditingInfo(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.45rem 1rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                type="submit"
                                disabled={savingInfo}
                                style={{
                                    background: '#2563eb',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '0.45rem 1.2rem',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {savingInfo ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar Cambios' : 'Save Changes')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <span style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        color: '#60a5fa',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '8px'
                                    }}>
                                        DOJ-CASE #{String(info.case_number).padStart(3, '0')}
                                    </span>

                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        color: badgeStyle.text,
                                        background: badgeStyle.bg,
                                        border: `1px solid ${badgeStyle.border}`,
                                        padding: '0.25rem 0.8rem',
                                        borderRadius: '9999px'
                                    }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: badgeStyle.text }}></span>
                                        {info.status}
                                    </span>
                                </div>

                                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
                                    {info.title}
                                </h1>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.86rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span>{info.location}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        <span>{new Date(info.occurred_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Initial Report Box */}
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            padding: '1.25rem 1.5rem',
                            marginTop: '1.25rem'
                        }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                                {language === 'es' ? 'INFORME PRELIMINAR / RELATO INICIAL' : 'PRELIMINARY INQUIRY REPORT'}
                            </div>

                            {info.initial_image_url && (
                                <div 
                                    style={{ 
                                        marginBottom: '1rem', 
                                        borderRadius: '12px', 
                                        overflow: 'hidden', 
                                        cursor: 'zoom-in', 
                                        maxWidth: '420px', 
                                        border: '1px solid rgba(255, 255, 255, 0.15)' 
                                    }} 
                                    onClick={() => setExpandedImage(info.initial_image_url)}
                                >
                                    <img src={info.initial_image_url} alt="Initial Evidence" style={{ width: '100%', display: 'block', maxHeight: '250px', objectFit: 'cover' }} />
                                </div>
                            )}

                            <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.6 }}>
                                {info.description}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Layout Grid: Main Content & Sidebar */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 340px',
                gap: '1.75rem',
                alignItems: 'start'
            }}>
                {/* Main Content Area */}
                <div>
                    {/* Navigation Tabs */}
                    <div className="mac-doc-tabs" style={{ marginBottom: '1.5rem' }}>
                        <button
                            className={`mac-doc-tab ${activeTab === 'updates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('updates')}
                            style={{
                                borderColor: activeTab === 'updates' ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
                                backgroundColor: activeTab === 'updates' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: activeTab === 'updates' ? '#ffffff' : '#94a3b8'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span>{language === 'es' ? 'Bitácora & Evidencias' : 'Inquest Log & Evidence'}</span>
                            <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                                {updates.length}
                            </span>
                        </button>

                        <button
                            className={`mac-doc-tab ${activeTab === 'todo' ? 'active' : ''}`}
                            onClick={() => setActiveTab('todo')}
                            style={{
                                borderColor: activeTab === 'todo' ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
                                backgroundColor: activeTab === 'todo' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: activeTab === 'todo' ? '#ffffff' : '#94a3b8'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 11 12 14 22 4"/>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            <span>{language === 'es' ? 'Diligencias & Tareas' : 'Case Tasks'}</span>
                        </button>
                    </div>

                    {activeTab === 'updates' ? (
                        <>
                            {/* New Update Editor Form */}
                            {isCaseOpen && (
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '20px',
                                    padding: '1.5rem',
                                    marginBottom: '2rem'
                                }}>
                                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        <span>{language === 'es' ? 'Añadir Actualización al Sumario' : 'Add Investigation Note / Update'}</span>
                                    </h4>

                                    <form onSubmit={handlePostUpdate}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <ReactQuill
                                                theme="snow"
                                                modules={quillModules}
                                                formats={quillFormats}
                                                value={newUpdateContent}
                                                onChange={setNewUpdateContent}
                                                placeholder={language === 'es' ? "Escriba los avances periciales, testimonios o resoluciones..." : "Write case findings, depositions, or legal progress..."}
                                            />
                                        </div>

                                        {/* Image Previews */}
                                        {newUpdateImages.length > 0 && (
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                                {newUpdateImages.map((imgSrc, idx) => (
                                                    <div key={idx} style={{ position: 'relative' }}>
                                                        <img src={imgSrc} alt="" style={{ height: '75px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.5)' }} />
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewUpdateImages(prev => prev.filter((_, i) => i !== idx))}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-6px',
                                                                right: '-6px',
                                                                background: '#ef4444',
                                                                color: '#fff',
                                                                borderRadius: '50%',
                                                                width: '20px',
                                                                height: '20px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontSize: '11px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                            <label style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.45rem',
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                padding: '0.45rem 0.9rem',
                                                borderRadius: '10px',
                                                color: '#cbd5e1',
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                                    <polyline points="21 15 16 10 5 21"/>
                                                </svg>
                                                <span>{language === 'es' ? 'Adjuntar Imágenes' : 'Attach Photos'}</span>
                                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                                            </label>

                                            <button
                                                type="submit"
                                                disabled={submittingUpdate}
                                                style={{
                                                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                                    border: 'none',
                                                    color: '#ffffff',
                                                    padding: '0.55rem 1.4rem',
                                                    borderRadius: '10px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    cursor: submittingUpdate ? 'not-allowed' : 'pointer',
                                                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                                                }}
                                            >
                                                {submittingUpdate ? (language === 'es' ? 'Publicando...' : 'Posting...') : (language === 'es' ? 'Publicar Actualización' : 'Post Update')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Updates Feed */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {updates.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '3rem 1.5rem',
                                        background: 'rgba(15, 23, 42, 0.45)',
                                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                                        borderRadius: '20px',
                                        color: '#94a3b8'
                                    }}>
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        </svg>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                                            {language === 'es' ? 'Sin actualizaciones en la causa' : 'No updates recorded yet'}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                            {language === 'es' ? 'Los avances procesales y diligencias aparecerán aquí.' : 'Case developments will be recorded in this inquiry log.'}
                                        </div>
                                    </div>
                                ) : (
                                    updates.map(update => {
                                        const isAuthor = currentUser && (currentUser.id === update.user_id || currentUser.id === update.author_id);
                                        const isHighCommand = currentUser && (
                                            ['Coordinador', 'Administrador', 'Comisionado', 'Director', 'Fundador'].includes(currentUser.rol) ||
                                            ['Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief', 'Comandante', 'Capitan', 'Teniente'].includes(currentUser.rango)
                                        );
                                        const canEdit = isAuthor || isHighCommand || (currentUser && ['Administrador', 'Coordinador'].includes(currentUser.rol));
                                        const canDelete = isAuthor || isHighCommand;
                                        const isEditing = editingId === update.id;

                                        return (
                                            <div
                                                key={update.id}
                                                style={{
                                                    background: 'rgba(15, 23, 42, 0.75)',
                                                    backdropFilter: 'blur(16px)',
                                                    WebkitBackdropFilter: 'blur(16px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderLeft: '4px solid #3b82f6',
                                                    borderRadius: '18px',
                                                    padding: '1.4rem 1.6rem'
                                                }}
                                            >
                                                {/* Author Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <img
                                                            src={update.author_avatar || '/logowebp/anon.webp'}
                                                            alt=""
                                                            style={{
                                                                width: '36px',
                                                                height: '36px',
                                                                borderRadius: '50%',
                                                                objectFit: 'cover',
                                                                border: '2px solid rgba(59, 130, 246, 0.3)'
                                                            }}
                                                        />
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                                                                {update.author_rank} {update.author_name}
                                                            </div>
                                                            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                                                                {new Date(update.created_at).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(canEdit || canDelete) && !isEditing && (
                                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleStartEdit(update)}
                                                                    title={language === 'es' ? 'Editar' : 'Edit'}
                                                                    style={{
                                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                        color: '#cbd5e1',
                                                                        borderRadius: '8px',
                                                                        padding: '0.3rem 0.5rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteUpdate(update.id)}
                                                                    title={language === 'es' ? 'Eliminar' : 'Delete'}
                                                                    style={{
                                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                        color: '#f87171',
                                                                        borderRadius: '8px',
                                                                        padding: '0.3rem 0.5rem',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <polyline points="3 6 5 6 21 6" />
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Edit Form or Content View */}
                                                {isEditing ? (
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <ReactQuill
                                                            theme="snow"
                                                            modules={quillModules}
                                                            formats={quillFormats}
                                                            value={editContent}
                                                            onChange={setEditContent}
                                                        />

                                                        {editImages.length > 0 && (
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                                                                {editImages.map((imgSrc, idx) => (
                                                                    <div key={idx} style={{ position: 'relative' }}>
                                                                        <img src={imgSrc} alt="" style={{ height: '70px', borderRadius: '6px' }} />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                                                                            style={{
                                                                                position: 'absolute',
                                                                                top: '-5px',
                                                                                right: '-5px',
                                                                                background: '#ef4444',
                                                                                color: '#fff',
                                                                                borderRadius: '50%',
                                                                                width: '18px',
                                                                                height: '18px',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                fontSize: '10px'
                                                                            }}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                                            <label style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.35rem',
                                                                padding: '0.35rem 0.75rem',
                                                                background: 'rgba(255,255,255,0.08)',
                                                                borderRadius: '8px',
                                                                color: '#cbd5e1',
                                                                fontSize: '0.78rem',
                                                                cursor: 'pointer'
                                                            }}>
                                                                <input type="file" accept="image/*" multiple onChange={handleEditImageUpload} style={{ display: 'none' }} />
                                                                <span>+ Imágenes</span>
                                                            </label>
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <button
                                                                    onClick={() => { setEditingId(null); setEditImages([]); }}
                                                                    style={{
                                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                        color: '#cbd5e1',
                                                                        padding: '0.4rem 0.85rem',
                                                                        borderRadius: '8px',
                                                                        fontSize: '0.8rem',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSaveEdit(update.id)}
                                                                    disabled={submittingEdit}
                                                                    style={{
                                                                        background: '#2563eb',
                                                                        border: 'none',
                                                                        color: '#ffffff',
                                                                        padding: '0.4rem 1rem',
                                                                        borderRadius: '8px',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {submittingEdit ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar' : 'Save')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.6 }}
                                                        className="quill-content"
                                                        dangerouslySetInnerHTML={{ __html: update.content }}
                                                    />
                                                )}

                                                {/* Images Attached */}
                                                {(update.images && update.images.length > 0) && (
                                                    <div style={{ marginTop: '1.25rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                        {update.images.map((imgSrc, i) => (
                                                            <div
                                                                key={i}
                                                                style={{
                                                                    borderRadius: '10px',
                                                                    overflow: 'hidden',
                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                    cursor: 'zoom-in',
                                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                                                                }}
                                                                onClick={() => setExpandedImage(imgSrc)}
                                                            >
                                                                <img
                                                                    src={imgSrc}
                                                                    alt="Evidence"
                                                                    style={{
                                                                        display: 'block',
                                                                        maxHeight: '180px',
                                                                        maxWidth: '260px',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
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
                    ) : (
                        <DOJCaseTodoList caseId={id} />
                    )}
                </div>

                {/* Sidebar Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Assigned DOJ Agents Widget */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '20px',
                        padding: '1.4rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                </svg>
                                <span>{language === 'es' ? 'Fiscales Asignados' : 'Assigned Agents'}</span>
                            </h4>
                            {isCaseOpen && (
                                <button
                                    onClick={openAssignModal}
                                    style={{
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        color: '#93c5fd',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Gestionar' : 'Manage'}
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {assignments.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                                    {language === 'es' ? 'Sin fiscales asignados a este sumario.' : 'No agents assigned.'}
                                </div>
                            ) : (
                                assignments.map(user => (
                                    <div
                                        key={user.user_id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            padding: '0.6rem 0.8rem',
                                            borderRadius: '12px'
                                        }}
                                    >
                                        <img
                                            src={user.avatar || '/logowebp/anon.webp'}
                                            alt=""
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: '1px solid rgba(59, 130, 246, 0.4)'
                                            }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {user.full_name}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#60a5fa', fontWeight: 600 }}>
                                                {user.rank}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Linked Interrogations Widget */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '20px',
                        padding: '1.4rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                </svg>
                                <span>{language === 'es' ? 'Actas Vinculadas' : 'Interrogations'}</span>
                            </h4>
                            {isCaseOpen && (
                                <button
                                    onClick={loadAvailableInterrogations}
                                    style={{
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        color: '#34d399',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    + {language === 'es' ? 'Vincular' : 'Link'}
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {(!interrogations || interrogations.length === 0) ? (
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                                    {language === 'es' ? 'Sin interrogatorios enlazados.' : 'No interrogations linked.'}
                                </div>
                            ) : (
                                interrogations.map(int => (
                                    <div
                                        key={int.id}
                                        style={{
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            borderLeft: '3px solid #10b981',
                                            padding: '0.75rem 0.85rem',
                                            borderRadius: '12px'
                                        }}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                            <a
                                                href={`/doj/interrogations?id=${int.id}`}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    navigate(`/doj/interrogations?search=${encodeURIComponent(int.title)}`);
                                                }}
                                                style={{ color: '#f1f5f9', textDecoration: 'none' }}
                                            >
                                                {int.title}
                                            </a>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                                            {int.subjects && <div><strong>{language === 'es' ? 'Declarantes:' : 'Subjects:'}</strong> {int.subjects}</div>}
                                            <div>{new Date(int.created_at).toLocaleDateString()}</div>
                                        </div>
                                        {isCaseOpen && (
                                            <div style={{ textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleUnlinkInterrogation(int.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#f87171',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {language === 'es' ? 'Desvincular' : 'Unlink'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Assignments Modal */}
            {showAssignModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowAssignModal(false)}>
                    <div
                        className="mac-modal-container"
                        style={{ maxWidth: '440px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 1rem 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 800 }}>
                            {language === 'es' ? 'Asignar Fiscales del DOJ' : 'Manage Case Assignment'}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                            {language === 'es' ? 'Seleccione los agentes encargados de la causa:' : 'Select legal agents assigned to this file:'}
                        </p>

                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {users.map(u => {
                                const isSelected = selectedAssignments.includes(u.id);
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => toggleAssignmentSelection(!isSelected, u.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.65rem',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent'
                                        }}
                                    >
                                        <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#3b82f6', pointerEvents: 'none' }} />
                                        <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                                        <span style={{ fontSize: '0.86rem', color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                                            {u.rango} {u.nombre} {u.apellido}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowAssignModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '10px',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdateAssignments}
                                style={{
                                    background: '#2563eb',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '10px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Guardar Asignaciones' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Interrogation Modal */}
            {showLinkModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowLinkModal(false)}>
                    <div
                        className="mac-modal-container"
                        style={{ maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 800 }}>
                            {language === 'es' ? 'Vincular Interrogatorio' : 'Link Interrogation'}
                        </h3>
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                            {language === 'es' ? 'Seleccione un acta de interrogatorio sin caso asignado para asociarla a este sumario.' : 'Select an unlinked interrogation to associate with this case.'}
                        </p>

                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            {availableInterrogations.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                    {language === 'es' ? 'No hay interrogatorios disponibles para vincular.' : 'No loose interrogations found.'}
                                </div>
                            ) : (
                                availableInterrogations.map(int => (
                                    <div
                                        key={int.id}
                                        onClick={() => handleLinkInterrogation(int.id)}
                                        style={{
                                            padding: '0.85rem 1rem',
                                            cursor: 'pointer',
                                            borderRadius: '10px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                            e.currentTarget.style.borderColor = '#3b82f6';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                        }}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', marginBottom: '0.2rem' }}>
                                            {int.title}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                            <strong>{language === 'es' ? 'Declarantes:' : 'Subject:'}</strong> {int.subjects}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                                            {new Date(int.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setShowLinkModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '10px',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Image Lightbox Modal */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
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
                    onClick={() => setExpandedImage(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '95vw', maxHeight: '95vh' }}>
                        <img
                            src={expandedImage}
                            alt="Expanded Evidence"
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
                            onClick={() => setExpandedImage(null)}
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
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
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

export default DOJCaseDetail;

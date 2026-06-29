import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';
import IACaseTodoList from '../components/IACaseTodoList';
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

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');

    // Quill config – memoized so the object reference is stable across renders
    const quillModules = useMemo(() => makeQuillModules(), []);

    // Image Viewer
    const [expandedImage, setExpandedImage] = useState(null);

    // Modals
    const [users, setUsers] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignments, setSelectedAssignments] = useState([]);

    const [currentUser, setCurrentUser] = useState(null);

    // Interrogations Linking State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [availableInterrogations, setAvailableInterrogations] = useState([]);

    // Linked Complaints State
    const [complaints, setComplaints] = useState([]);
    const [selectedComplaint, setSelectedComplaint] = useState(null);

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

    const handleUnlinkComplaint = async (complaintId) => {
        if (!window.confirm("¿Desvincular esta denuncia del caso? Volverá al receptor de denuncias como 'Entrante'.")) return;
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
            if (error) throw error;
            setAvailableInterrogations(data || []);
            setShowLinkModal(true);
        } catch (err) {
            alert('Error loading interrogations: ' + err.message);
        }
    };

    const handleLinkInterrogation = async (interrogationId) => {
        try {
            const { error } = await supabase.rpc('manage_ia_interrogation', {
                p_action: 'link',
                p_id: interrogationId,
                p_case_id: id
            });
            if (error) throw error;
            setShowLinkModal(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error linking interrogation: ' + err.message);
        }
    };

    const handleUnlinkInterrogation = async (interrogationId) => {
        if (!window.confirm("Unlink this interrogation? It will remain in the system but attached to no case.")) return;
        try {
            const { error } = await supabase.rpc('manage_ia_interrogation', {
                p_action: 'unlink',
                p_id: interrogationId
            });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert('Error unlinking: ' + err.message);
        }
    };

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

    const openAssignModal = async () => {
        if (users.length === 0) {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, profile_image, divisions').order('rango');
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

    const handleUpdateRole = async (userId, newRole) => {
        // Optimistic update
        setCaseData(prev => {
            const newAssignments = prev.assignments.map(a => a.user_id === userId ? { ...a, role: newRole } : a);
            return { ...prev, assignments: newAssignments };
        });

        try {
            const { error } = await supabase.rpc('update_ia_case_assignment_role', {
                p_case_id: id,
                p_user_id: userId,
                p_role: newRole
            });
            if (error) throw error;
        } catch (err) {
            alert('Error updating role: ' + err.message);
            loadCaseDetails(false); // Reload silently to revert if error
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
            alert("Please enter text or attach an image.");
            return;
        }

        setSubmittingUpdate(true);
        try {
            const { error } = await supabase.rpc('add_ia_case_update', {
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
        setEditContent(update.content);
    };

    const handleSaveEdit = async (updateId) => {
        try {
            const { error } = await supabase.rpc('update_ia_case_update_content', {
                p_update_id: updateId,
                p_content: editContent
            });
            if (error) throw error;
            setEditingId(null);
            loadCaseDetails();
        } catch (err) {
            alert("Error updating: " + err.message);
        }
    };

    const handleDeleteUpdate = async (updateId) => {
        if (!window.confirm(language === 'es' ? '¿Está seguro de que desea eliminar este mensaje?' : 'Are you sure you want to delete this message?')) return;
        try {
            const { error } = await supabase.rpc('delete_ia_case_update', { p_update_id: updateId });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    };

    if (loading) return <div className="loading-screen">{language === 'es' ? 'Cargando Investigación...' : 'Loading Investigation...'}</div>;
    if (!caseData) return <div className="loading-screen" style={{ color: '#f87171' }}>{language === 'es' ? 'Investigación no encontrada.' : 'Investigation Not Found.'}</div>;

    const { info, assignments, updates, interrogations } = caseData;

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div className="case-detail-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <button onClick={() => navigate('/internal-affairs/cases')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', marginBottom: '1rem' }}>
                        {language === 'es' ? '← Volver a Casos de IA' : '← Back to IA Cases'}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: '#f87171' }}>
                            <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>IA-#{String(info.case_number).padStart(3, '0')}</span>
                            {info.title}
                        </h1>
                        <div style={{ color: 'var(--text-secondary)' }}>
                            {language === 'es' ? 'Ubicado en ' : 'Located at '}<strong>{info.location}</strong> • {language === 'es' ? 'Ocurrió el ' : 'Occurred on '}{new Date(info.occurred_at).toLocaleString()}
                        </div>
                    </div>
                    <div className={`status-badge ${info.status.toLowerCase()}`}
                        style={{
                            display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase',
                            backgroundColor: info.status === 'Open' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                            color: info.status === 'Open' ? '#4ade80' : '#94a3b8',
                            border: `1px solid ${info.status === 'Open' ? '#4ade80' : '#94a3b8'}`
                        }}>
                        {info.status === 'Open' ? (language === 'es' ? 'ABIERTO' : 'OPEN') : info.status === 'Closed' ? (language === 'es' ? 'CERRADO' : 'CLOSED') : (language === 'es' ? 'ARCHIVADO' : 'ARCHIVED')}
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-gold)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-gold)' }}>{language === 'es' ? 'REPORTE INICIAL' : 'INITIAL REPORT'}</h4>
                    {info.initial_image_url && (
                        <div style={{ marginBottom: '1rem', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setExpandedImage(info.initial_image_url)}>
                            <img src={info.initial_image_url} alt="Initial Evidence" style={{ width: '100%', display: 'block' }} />
                        </div>
                    )}
                    <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>{info.description}</p>
                </div>
            </div>

            <div className="case-layout" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="case-main-content">
                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => setActiveTab('updates')}
                            style={{
                                background: 'none', border: 'none',
                                borderBottom: activeTab === 'updates' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                color: activeTab === 'updates' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer'
                            }}>
                            {language === 'es' ? 'Bitácora de Investigación' : 'Investigation Log'}
                        </button>
                        <button
                            onClick={() => setActiveTab('todo')}
                            style={{
                                background: 'none', border: 'none',
                                borderBottom: activeTab === 'todo' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                color: activeTab === 'todo' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer'
                            }}>
                            {language === 'es' ? 'Lista de Tareas' : 'To-Do List'}
                        </button>
                    </div>

                    {activeTab === 'updates' ? (
                        <>

                            {/* New Update Box */}
                            {info.status !== 'Archived' && (
                                <div className="new-update-box" style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
                                    <form onSubmit={handlePostUpdate}>
                                        <ReactQuill 
                                            theme="snow"
                                            modules={quillModules}
                                            formats={quillFormats}
                                            placeholder={language === 'es' ? 'Registrar un nuevo hallazgo, evidencia o declaración...' : 'Log a new finding, evidence or statement...'}
                                            value={newUpdateContent}
                                            onChange={setNewUpdateContent}
                                            style={{ marginBottom: '1rem' }}
                                        />
                                        {newUpdateImages.length > 0 && (
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                                {newUpdateImages.map((imgSrc, idx) => (
                                                    <div key={idx} style={{ position: 'relative' }}>
                                                        <img src={imgSrc} alt="" style={{ height: '80px', borderRadius: '4px', border: '1px solid var(--accent-gold)' }} />
                                                        <button type="button" onClick={() => setNewUpdateImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer' }}>&times;</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label className="custom-file-upload" style={{ margin: 0, fontSize: '0.9rem', padding: '0.4rem 1rem', width: 'auto' }}>
                                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                                                {language === 'es' ? '📸 Añadir Evidencia' : '📸 Add Evidence'}
                                            </label>
                                            <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submittingUpdate}>
                                                {submittingUpdate ? (language === 'es' ? 'Publicando...' : 'Posting...') : (language === 'es' ? 'Publicar Actualización' : 'Post Update')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="updates-feed">
                                {updates.length === 0 ? <div className="empty-list">{language === 'es' ? 'Aún no se han registrado actualizaciones o novedades.' : 'No updates or developments recorded yet.'}</div> : (
                                    updates.map(update => {
                                        const isAuthor = currentUser && currentUser.id === update.user_id;
                                        const isHighCommand = currentUser && (
                                            ['Coordinador', 'Administrador', 'Comisionado', 'Director', 'Fundador'].includes(currentUser.rol) ||
                                            ['Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief', 'Comandante', 'Capitan', 'Teniente'].includes(currentUser.rango)
                                        );
                                        const canEdit = isAuthor;
                                        const canDelete = isAuthor || isHighCommand;
                                        const isEditing = editingId === update.id;

                                        return (
                                        <div key={update.id} className="case-update-card" style={{
                                            background: 'rgba(30, 41, 59, 0.4)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem',
                                            borderLeft: '2px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <img src={update.author_avatar || '/anon.png'} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', marginRight: '10px' }} />
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{update.author_rank} {update.author_name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(update.created_at).toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                {(canEdit || canDelete) && !isEditing && (
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        {canEdit && (
                                                            <button onClick={() => handleStartEdit(update)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }} title="Edit Message">✏️</button>
                                                        )}
                                                        {canDelete && (
                                                            <button onClick={() => handleDeleteUpdate(update.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }} title="Delete Message">🗑️</button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <ReactQuill 
                                                        theme="snow"
                                                        modules={quillModules}
                                                        formats={quillFormats}
                                                        value={editContent}
                                                        onChange={setEditContent}
                                                        style={{ marginBottom: '0.5rem' }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        <button className="login-button btn-secondary" onClick={() => setEditingId(null)} style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                                                        <button className="login-button" onClick={() => handleSaveEdit(update.id)} style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>{language === 'es' ? 'Guardar Cambios' : 'Save Changes'}</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ marginBottom: '1rem', color: 'var(--text-primary)' }} className="quill-content" dangerouslySetInnerHTML={{ __html: update.content }} />
                                            )}
                                            {(update.images && update.images.length > 0) && (
                                                <div style={{ marginTop: '1rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {update.images.map((imgSrc, i) => (
                                                        <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }} onClick={() => setExpandedImage(imgSrc)}>
                                                            <img src={imgSrc} alt="Evidence" style={{ display: 'block', maxHeight: '200px', maxWidth: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )})
                                )}
                            </div>
                        </>
                    ) : (
                        <IACaseTodoList caseId={id} />
                    )}
                </div>

                <div className="case-sidebar">
                    <div className="sidebar-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>{language === 'es' ? 'Agentes Asignados' : 'Assigned Agents'}</h4>
                            {info.status === 'Open' && (
                                <button onClick={openAssignModal} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>{language === 'es' ? 'Gestionar' : 'Manage'}</button>
                            )}
                        </div>
                        <div className="assigned-list">
                            {assignments.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{language === 'es' ? 'Sin agentes asignados.' : 'No agents assigned.'}</div> : (
                                assignments.map(user => (
                                    <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                                        <img src={user.avatar || '/anon.png'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px', border: '1px solid var(--accent-gold)' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{user.rank}</div>
                                            <div style={{ fontSize: '0.85rem' }}>{user.full_name}</div>
                                        </div>
                                        {info.status === 'Open' ? (
                                            <select
                                                value={user.role || 'Investigador'}
                                                onChange={(e) => handleUpdateRole(user.user_id, e.target.value)}
                                                style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--accent-gold)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '2px 5px', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                                            >
                                                <option value="Supervisor" style={{ background: '#1e293b', color: '#fff' }}>Supervisor</option>
                                                <option value="Encargado" style={{ background: '#1e293b', color: '#fff' }}>Encargado</option>
                                                <option value="Investigador" style={{ background: '#1e293b', color: '#fff' }}>Investigador</option>
                                                <option value="Ayudante" style={{ background: '#1e293b', color: '#fff' }}>Ayudante</option>
                                                <option value="Externo" style={{ background: '#1e293b', color: '#fff' }}>Externo</option>
                                            </select>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '2px 5px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                                                {user.role || 'Investigador'}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="sidebar-section" style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>{language === 'es' ? 'Interrogatorios' : 'Interrogations'}</h4>
                            {info.status === 'Open' && (
                                <button onClick={loadAvailableInterrogations} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>{language === 'es' ? '+ Vincular' : '+ Link'}</button>
                            )}
                        </div>
                        <div className="assigned-list">
                            {(!interrogations || interrogations.length === 0) ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{language === 'es' ? 'Sin interrogatorios vinculados.' : 'No interrogations linked.'}</div> : (
                                interrogations.map(int => (
                                    <div key={int.id} style={{ marginBottom: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '4px', borderLeft: '3px solid #f87171' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                                            <a href={`/internal-affairs/interrogations?id=${int.id}`} onClick={(e) => { e.preventDefault(); navigate(`/internal-affairs/interrogations?search=${encodeURIComponent(int.title)}`); }} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                {int.title}
                                            </a>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {new Date(int.created_at).toLocaleDateString()}
                                        </div>
                                        {info.status === 'Open' && (
                                            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                                                <button onClick={() => handleUnlinkInterrogation(int.id)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.8 }}>
                                                    {language === 'es' ? 'Desvincular' : 'Unlink'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Complaints Section */}
                    <div className="sidebar-section" style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>{language === 'es' ? 'Denuncias Vinculadas' : 'Linked Complaints'}</h4>
                        </div>
                        <div className="assigned-list">
                            {complaints.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{language === 'es' ? 'Sin denuncias vinculadas.' : 'No complaints linked.'}</div> : (
                                complaints.map(comp => (
                                    <div key={comp.id} style={{ marginBottom: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-gold)' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                                            <span onClick={() => setSelectedComplaint(comp)} style={{ color: 'var(--accent-gold)', cursor: 'pointer', textDecoration: 'underline' }}>
                                                {comp.motivo}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                                            Por: {comp.denunciante_nombre}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Fecha: {new Date(comp.created_at).toLocaleDateString()}
                                        </div>
                                        {info.status === 'Open' && (
                                            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                                                <button onClick={() => handleUnlinkComplaint(comp.id)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.8 }}>
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
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>{language === 'es' ? 'Gestionar Asignación' : 'Manage Assignment'}</h3>
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--glass-border)', borderRadius: '4px' }}>
                            {users.map(u => (
                                <div key={u.id}
                                    onClick={() => toggleAssignmentSelection(!selectedAssignments.includes(u.id), u.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', padding: '0.8rem',
                                        cursor: 'pointer', background: selectedAssignments.includes(u.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                    <input type="checkbox" checked={selectedAssignments.includes(u.id)} readOnly style={{ marginRight: '10px', pointerEvents: 'none' }} />
                                    <img src={u.profile_image || '/anon.png'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '10px' }} />
                                    <span style={{ fontSize: '0.9rem' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setShowAssignModal(false)} style={{ width: 'auto' }}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                            <button className="login-button" onClick={handleUpdateAssignments} style={{ width: 'auto' }}>{language === 'es' ? 'Guardar Cambios' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Interrogation Modal */}
            {showLinkModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#f87171' }}>{language === 'es' ? 'Vincular Interrogatorio' : 'Link Interrogation'}</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{language === 'es' ? 'Seleccione un interrogatorio suelto para adjuntar a este expediente de caso.' : 'Select a loose interrogation to attach to this case file.'}</p>

                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--glass-border)', borderRadius: '4px' }}>
                            {availableInterrogations.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{language === 'es' ? 'No se encontraron interrogatorios sin vincular.' : 'No unlinked interrogations found.'}</div>
                            ) : (
                                availableInterrogations.map(int => (
                                    <div key={int.id}
                                        onClick={() => handleLinkInterrogation(int.id)}
                                        style={{
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: 'rgba(0,0,0,0.2)',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
                                    >
                                        <div style={{ fontWeight: 'bold' }}>{int.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Sujeto: ' : 'Subject: '}{int.subjects}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Fecha: ' : 'Date: '}{new Date(int.created_at).toLocaleDateString()}</div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="login-button btn-secondary" onClick={() => setShowLinkModal(false)} style={{ width: 'auto' }}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: View Complaint Details */}
            {selectedComplaint && (
                <div className="cropper-modal-overlay" onClick={() => setSelectedComplaint(null)}>
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', width: '90%', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem', color: 'var(--accent-gold)', fontSize: '1.3rem' }}>
                            Detalle de Denuncia Confidencial
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0' }}>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Denunciante:</span>
                                <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.denunciante_nombre}</p>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Nº Teléfono:</span>
                                <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.denunciante_telefono}</p>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Denunciado:</span>
                                <p style={{ color: '#ef4444', fontSize: '0.95rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.denunciado_nombre_placa}</p>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Fecha de los hechos:</span>
                                <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: '0.1rem 0 0 0' }}>{selectedComplaint.fecha_hechos}</p>
                            </div>
                        </div>

                        <div style={{ margin: '1rem 0' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Motivo de la denuncia:</span>
                            <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', margin: '0.1rem 0 0 0', fontWeight: 'bold' }}>{selectedComplaint.motivo}</p>
                        </div>

                        <div style={{ margin: '1rem 0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Declaración de los hechos:</span>
                            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: '0.3rem 0 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                {selectedComplaint.declaracion}
                            </p>
                        </div>

                        <div style={{ margin: '1rem 0' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>Pruebas aportadas:</span>
                            {selectedComplaint.pruebas ? (
                                <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                                    {selectedComplaint.pruebas.includes('Imagen adjunta:') ? (
                                        (() => {
                                            const parts = selectedComplaint.pruebas.split('Imagen adjunta:');
                                            const linkPart = parts[0].replace('Enlace: ', '').trim();
                                            const imagePart = parts[1].trim();
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                    {linkPart && (
                                                        <div>
                                                            <a href={linkPart} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>{linkPart}</a>
                                                        </div>
                                                    )}
                                                    {imagePart && (
                                                        <div>
                                                            <img src={imagePart} alt="Evidencia" style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        selectedComplaint.pruebas.startsWith('data:image') ? (
                                            <img src={selectedComplaint.pruebas} alt="Evidencia" style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                        ) : (
                                            <a href={selectedComplaint.pruebas} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>{selectedComplaint.pruebas}</a>
                                        )
                                    )}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>Ninguna prueba adjunta</p>
                            )}
                        </div>

                        <div className="cropper-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setSelectedComplaint(null)}>
                                Cerrar Detalles
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* FULL SCREEN IMAGE VIEWER */}
            {expandedImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setExpandedImage(null)}>
                    <img src={expandedImage} alt="Expanded" style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }} />
                    <button onClick={() => setExpandedImage(null)} style={{ position: 'absolute', top: '20px', right: '30px', background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}>&times;</button>
                </div>
            )}
        </div>
    );
}

export default IACaseDetail;

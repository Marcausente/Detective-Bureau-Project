import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';
import CaseTodoList from '../components/CaseTodoList';

function CaseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('updates'); // updates, evidence, interrogations

    // New Update State
    // New Update State
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [newUpdateImages, setNewUpdateImages] = useState([]); // Array of Base64 strings
    const [submittingUpdate, setSubmittingUpdate] = useState(false);

    // Image Viewer Modal State
    const [expandedImage, setExpandedImage] = useState(null);

    // Modals Data
    const [users, setUsers] = useState([]);
    const [availableInterrogations, setAvailableInterrogations] = useState([]);

    // Modals Visibility
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);

    // Temp Selection State
    const [selectedAssignments, setSelectedAssignments] = useState([]);
    const [selectedInterrogation, setSelectedInterrogation] = useState('');

    // Edit/Delete Permissions State
    const [currentUser, setCurrentUser] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");

    // Case Info Edit State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [editOccurredAt, setEditOccurredAt] = useState("");
    const [editDescription, setEditDescription] = useState("");

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
        const { data, error } = await supabase.rpc('get_case_details', { p_case_id: id });
        if (error) {
            console.error('Error loading case:', error);
            alert('Failed to load case details.');
        } else {
            setCaseData(data);
            // When loading, init selected assignments
            const currentIds = data.assignments ? data.assignments.map(a => a.user_id) : [];
            setSelectedAssignments(currentIds);
        }
        setLoading(false);
    };

    const openAssignModal = async () => {
        // Fetch users if not loaded
        if (users.length === 0) {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango, profile_image').order('rango');
            setUsers(data || []);
        }
        // Sync current selections
        if (caseData?.assignments) {
            setSelectedAssignments(caseData.assignments.map(a => a.user_id));
        }
        setShowAssignModal(true);
    };

    const openLinkModal = async () => {
        // Fetch interrogations that have NO case_id via RPC to respect visibility rules
        const { data, error } = await supabase.rpc('get_available_interrogations_to_link');

        if (error) console.error(error);
        else setAvailableInterrogations(data || []);

        setSelectedInterrogation('');
        setShowLinkModal(true);
    };

    const handleUpdateAssignments = async () => {
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

    const toggleAssignmentSelection = (status, userId) => {
        if (status) {
            setSelectedAssignments(prev => [...prev, userId]);
        } else {
            setSelectedAssignments(prev => prev.filter(uid => uid !== userId));
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!window.confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
        try {
            const { error } = await supabase.rpc('set_case_status', { p_case_id: id, p_status: newStatus });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert('Error updating status: ' + err.message);
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
                    // Only resize if wider than max
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
        // Allow if content OR images exist
        if (!newUpdateContent.trim() && newUpdateImages.length === 0) {
            alert("Please enter text or attach an image.");
            return;
        }

        setSubmittingUpdate(true);
        try {
            const { error } = await supabase.rpc('add_case_update', {
                p_case_id: id,
                p_content: newUpdateContent,
                p_images: newUpdateImages // Send array
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

    const handleUnlink = async (e, intId) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to UNLINK this interrogation from the case?")) return;

        try {
            const { error } = await supabase.rpc('unlink_interrogation', { p_interrogation_id: intId });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            console.error("Error unlinking:", err);
            alert("Error unlinking: " + err.message);
        }
    };

    const handleDeleteUpdate = async (updateId) => {
        if (!window.confirm("Are you sure you want to delete this message?")) return;
        try {
            const { error } = await supabase.rpc('delete_case_update', { p_update_id: updateId });
            if (error) throw error;
            loadCaseDetails();
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    };

    const handleStartEdit = (update) => {
        setEditingId(update.id);
        setEditContent(update.content);
    };

    const handleSaveEdit = async (updateId) => {
        try {
            const { error } = await supabase.rpc('update_case_update_content', {
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

    const handleDeleteCase = async () => {
        if (!window.confirm("🛑 DANGER ZONE 🛑\n\nAre you sure you want to PERMANENTLY DELETE this case?\nThis includes all updates, evidence images, and assignments.\nLinked interrogations will be preserved but unlinked.\n\nThis action CANNOT be undone.")) return;

        try {
            setLoading(true);
            console.log("Attempting to delete case:", id);

            // Use the RPC to ensuring rigorous deletion (bypass RLS if needed)
            const { data: result, error } = await supabase.rpc('delete_case_fully', {
                p_case_id: id
            });

            console.log("Delete RPC Result:", result, error);

            if (error) throw error;

            if (result === 'NOT_FOUND') {
                alert("Server reported: Case ID not found during deletion. It might be already deleted.");
            }

            navigate('/cases');
        } catch (err) {
            console.error('Error deleting case:', err);
            alert('Error deleting case: ' + err.message);
            setLoading(false);
        }
    };

    const handleSaveInfo = async () => {
        try {
            const { error } = await supabase.rpc('update_case_details', {
                p_case_id: id,
                p_title: editTitle,
                p_location: editLocation,
                p_occurred_at: editOccurredAt,
                p_description: editDescription
            });
            if (error) throw error;
            setIsEditingInfo(false);
            loadCaseDetails();
        } catch (err) {
            alert('Error updating case details: ' + err.message);
        }
    };

    if (loading) return <div className="loading-screen">Loading Case File...</div>;
    if (!caseData) return <div className="loading-screen" style={{ color: '#f87171' }}>Case File Not Found.</div>;

    const { info, assignments, updates, interrogations } = caseData;

    // Permission Check using locally loaded User and Case Info
    // Admins/High Command OR the Creator of the case
    const isHighCommand = currentUser && ['Coordinador', 'Administrador', 'Comisionado'].includes(currentUser.rol);
    const isCreator = currentUser && info.created_by === currentUser.id;
    const canEditCase = isHighCommand || isCreator;

    // Initialize edit state when not editing
    const startEditingInfo = () => {
        setEditTitle(info.title);
        setEditLocation(info.location || '');
        // Format for datetime-local input: YYYY-MM-DDTHH:mm
        const dt = new Date(info.occurred_at);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        setEditOccurredAt(dt.toISOString().slice(0, 16));
        setEditDescription(info.description || '');
        setIsEditingInfo(true);
    };

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            {/* Header */}
            <div className="case-detail-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <button onClick={() => navigate('/cases')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', marginBottom: '1rem' }}>
                        ← Back to Cases
                    </button>

                    {!isEditingInfo && canEditCase && (
                        <button onClick={startEditingInfo} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
                            Edit Details
                        </button>
                    )}
                </div>

                {isEditingInfo ? (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--accent-gold)' }}>
                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Case Title</label>
                                <input type="text" className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Location</label>
                                    <input type="text" className="form-input" value={editLocation} onChange={e => setEditLocation(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Date & Time</label>
                                    <input type="datetime-local" className="form-input" value={editOccurredAt} onChange={e => setEditOccurredAt(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Initial Report</label>
                                <textarea className="eval-textarea" rows="5" value={editDescription} onChange={e => setEditDescription(e.target.value)} style={{ width: '100%' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="login-button btn-secondary" onClick={() => setIsEditingInfo(false)} style={{ width: 'auto' }}>Cancel</button>
                            <button className="login-button" onClick={handleSaveInfo} style={{ width: 'auto' }}>Save Changes</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                                <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>#{String(info.case_number).padStart(3, '0')}</span>
                                {info.title}
                            </h1>
                            <div style={{ color: 'var(--text-secondary)' }}>
                                Located at <strong>{info.location}</strong> • Occurred on {new Date(info.occurred_at).toLocaleString()}
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div className={`status-badge ${info.status.toLowerCase()}`}
                                style={{
                                    display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase',
                                    backgroundColor: info.status === 'Open' ? 'rgba(74, 222, 128, 0.2)' : info.status === 'Closed' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                    color: info.status === 'Open' ? '#4ade80' : info.status === 'Closed' ? '#f87171' : '#94a3b8',
                                    border: `1px solid ${info.status === 'Open' ? '#4ade80' : info.status === 'Closed' ? '#f87171' : '#94a3b8'}`
                                }}>
                                {info.status}
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                {info.status === 'Open' && (
                                    <>
                                        <button className="login-button btn-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => handleStatusChange('Closed')}>Close Case</button>
                                        <button className="login-button btn-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => handleStatusChange('Archived')}>Archive</button>
                                    </>
                                )}
                                {info.status !== 'Open' && (
                                    <button className="login-button btn-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => handleStatusChange('Open')}>Re-Open Case</button>
                                )}

                                {/* DELETE BUTTON: Only for Coordinador, Administrador, Comisionado */}
                                {currentUser && ['Coordinador', 'Administrador', 'Comisionado'].includes(currentUser.rol) && (
                                    <button
                                        className="login-button"
                                        style={{
                                            width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444'
                                        }}
                                        onClick={handleDeleteCase}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Initial Description - Hide if editing because it's in the form */}
                {!isEditingInfo && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-gold)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-gold)' }}>INITIAL REPORT</h4>
                        <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>{info.description}</p>
                    </div>
                )}
            </div>

            <div className="case-layout" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                {/* Left Column: Updates & Timeline */}
                <div className="case-main-content">
                    {/* Tab Navigation */}
                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => setActiveTab('updates')}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'updates' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                color: activeTab === 'updates' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            Updates & Evidence
                        </button>
                        <button
                            onClick={() => setActiveTab('todo')}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'todo' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                color: activeTab === 'todo' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            To-Do List
                        </button>
                    </div>

                    {activeTab === 'updates' ? (
                        <>
                            {/* New Update Box */}
                            {info.status !== 'Archived' && (
                                <div className="new-update-box" style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
                                    <form onSubmit={handlePostUpdate}>
                                        <textarea
                                            className="eval-textarea"
                                            rows="3"
                                            placeholder="Log a new development, update or evidence..."
                                            value={newUpdateContent}
                                            onChange={e => setNewUpdateContent(e.target.value)}
                                            style={{ marginBottom: '1rem' }}
                                        />

                                        {/* Image Previews */}
                                        {newUpdateImages.length > 0 && (
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                                {newUpdateImages.map((imgSrc, idx) => (
                                                    <div key={idx} style={{ position: 'relative' }}>
                                                        <img src={imgSrc} alt="" style={{ height: '80px', borderRadius: '4px', border: '1px solid var(--accent-gold)' }} />
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewUpdateImages(prev => prev.filter((_, i) => i !== idx))}
                                                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <label className="custom-file-upload" style={{ display: 'inline-block', width: 'auto', margin: 0, fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
                                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                                                    📸 Add Images
                                                </label>
                                            </div>
                                            <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submittingUpdate}>
                                                {submittingUpdate ? 'Posting...' : 'Post Update'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Updates Feed */}
                            <div className="updates-feed">
                                {updates.length === 0 ? <div className="empty-list">No updates or developments recorded yet.</div> : (
                                    updates.map(update => {
                                        const isAuthor = currentUser && currentUser.id === update.user_id;

                                        // Check permissions based on ROLE and RANK
                                        const isHighCommand = currentUser && (
                                            ['Coordinador', 'Administrador', 'Comisionado', 'Director', 'Fundador'].includes(currentUser.rol) ||
                                            ['Capitan', 'Teniente'].includes(currentUser.rango)
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

                                                    {/* Action Buttons */}
                                                    {(canEdit || canDelete) && !isEditing && (
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleStartEdit(update)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }}
                                                                    title="Edit Message"
                                                                >
                                                                    ✏️
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteUpdate(update.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }}
                                                                    title="Delete Message"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {isEditing ? (
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <textarea
                                                            className="eval-textarea"
                                                            value={editContent}
                                                            onChange={e => setEditContent(e.target.value)}
                                                            rows="4"
                                                            style={{ width: '100%', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.3)' }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                            <button className="login-button btn-secondary" onClick={() => setEditingId(null)} style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Cancel</button>
                                                            <button className="login-button" onClick={() => handleSaveEdit(update.id)} style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Save Changes</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ whiteSpace: 'pre-line', marginBottom: '1rem', color: 'var(--text-primary)' }}>{update.content}</div>
                                                )}

                                                {/* Render Images from Array (new) or Single (legacy) */}
                                                {(update.images && update.images.length > 0) ? (
                                                    <div style={{ marginTop: '1rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                        {update.images.map((imgSrc, i) => (
                                                            <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '100%', cursor: 'pointer' }} onClick={() => setExpandedImage(imgSrc)}>
                                                                <img
                                                                    src={imgSrc}
                                                                    alt="Evidence"
                                                                    style={{ display: 'block', maxHeight: '400px', maxWidth: '100%', objectFit: 'contain' }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : update.image ? (
                                                    <div style={{ marginTop: '1rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }} onClick={() => setExpandedImage(update.image)}>
                                                        <img
                                                            src={update.image}
                                                            alt="Evidence"
                                                            style={{ display: 'block', maxHeight: '400px', maxWidth: '100%', objectFit: 'contain' }}
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : (
                        <CaseTodoList caseId={id} />
                    )}
                </div>

                {/* Right Column: Key Info & Linked Data */}
                <div className="case-sidebar">
                    {/* Assigned Detectives */}
                    <div className="sidebar-section" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>Assigned Detectives</h4>
                            {info.status === 'Open' && (
                                <button onClick={openAssignModal} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    Manage
                                </button>
                            )}
                        </div>
                        <div className="assigned-list">
                            {assignments.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No detectives assigned.</div> : (
                                assignments.map(user => (
                                    <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                                        <img src={user.avatar || '/anon.png'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px', border: '1px solid var(--accent-gold)' }} />
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{user.rank}</div>
                                            <div style={{ fontSize: '0.85rem' }}>{user.full_name}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Linked Interrogations */}
                    <div className="sidebar-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>Linked Interrogations</h4>
                            {info.status === 'Open' && (
                                <button onClick={openLinkModal} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    + Link
                                </button>
                            )}
                        </div>
                        <div className="linked-interrogations">
                            {interrogations.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No interrogations linked.</div> : (
                                interrogations.map(inv => (
                                    <div key={inv.id}
                                        onClick={() => navigate(`/interrogations?id=${inv.id}`)}
                                        style={{
                                            padding: '0.8rem', marginBottom: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', cursor: 'pointer',
                                            borderLeft: '2px solid var(--accent-gold)',
                                            position: 'relative'
                                        }}>
                                        <div style={{ paddingRight: '20px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{inv.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subjects: {inv.subjects}</div>
                                        </div>
                                        {info.status === 'Open' && (
                                            <button
                                                onClick={(e) => handleUnlink(e, inv.id)}
                                                style={{
                                                    position: 'absolute', top: '2px', right: '5px',
                                                    background: 'none', border: 'none', color: '#f87171',
                                                    fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: '0 5px'
                                                }}
                                                title="Unlink Interrogation"
                                            >
                                                &times;
                                            </button>
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
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Manage Assignments</h3>
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--glass-border)', borderRadius: '4px' }}>
                            {users.map(u => (
                                <div key={u.id}
                                    onClick={() => toggleAssignmentSelection(!selectedAssignments.includes(u.id), u.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', padding: '0.8rem',
                                        cursor: 'pointer', background: selectedAssignments.includes(u.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedAssignments.includes(u.id)}
                                        readOnly
                                        style={{ marginRight: '10px', pointerEvents: 'none' }}
                                        aria-label={`Assign ${u.rango} ${u.nombre} ${u.apellido}`}
                                    />
                                    <img src={u.profile_image || '/anon.png'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '10px' }} />
                                    <span style={{ fontSize: '0.9rem' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setShowAssignModal(false)} style={{ width: 'auto' }}>Cancel</button>
                            <button className="login-button" onClick={handleUpdateAssignments} style={{ width: 'auto' }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Interrogation Modal */}
            {showLinkModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Link Interrogation Log</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Only unlinked interrogations are shown here.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <select
                                className="form-input custom-select"
                                value={selectedInterrogation}
                                onChange={e => setSelectedInterrogation(e.target.value)}
                                style={{ width: '100%' }}
                                aria-label="Select Interrogation to Link"
                            >
                                <option value="">-- Select an Interrogation --</option>
                                {availableInterrogations.map(inv => (
                                    <option key={inv.id} value={inv.id}>
                                        {inv.title} ({new Date(inv.created_at).toLocaleDateString()}) - {inv.subjects}
                                    </option>
                                ))}
                            </select>
                            {availableInterrogations.length === 0 && (
                                <div style={{ marginTop: '0.5rem', color: '#f87171', fontSize: '0.9rem' }}>
                                    No available interrogations found.
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setShowLinkModal(false)} style={{ width: 'auto' }}>Cancel</button>
                            <button className="login-button" onClick={handleLinkInterrogation} disabled={!selectedInterrogation} style={{ width: 'auto' }}>Link Case</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN IMAGE VIEWER */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.95)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out'
                    }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img
                        src={expandedImage}
                        alt="Expanded Evidence"
                        style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                    />
                    <button
                        onClick={() => setExpandedImage(null)}
                        style={{
                            position: 'absolute', top: '20px', right: '30px',
                            background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer',
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                        }}
                    >
                        &times;
                    </button>
                </div>
            )}
        </div>
    );
}

export default CaseDetail;

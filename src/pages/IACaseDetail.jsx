import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';
import IACaseTodoList from '../components/IACaseTodoList'; // Import component

function IACaseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('updates');

    // Update State
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [newUpdateImages, setNewUpdateImages] = useState([]);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);

    // Image Viewer
    const [expandedImage, setExpandedImage] = useState(null);

    // Modals
    const [users, setUsers] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignments, setSelectedAssignments] = useState([]);

    const [currentUser, setCurrentUser] = useState(null);

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
        if (!newUpdateContent.trim() && newUpdateImages.length === 0) {
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

    if (loading) return <div className="loading-screen">Loading Investigation...</div>;
    if (!caseData) return <div className="loading-screen" style={{ color: '#f87171' }}>Investigation Not Found.</div>;

    const { info, assignments, updates } = caseData;

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div className="case-detail-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <button onClick={() => navigate('/internal-affairs/cases')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', marginBottom: '1rem' }}>
                        ← Back to IA Cases
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: '#f87171' }}>
                            <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>IA-#{String(info.case_number).padStart(3, '0')}</span>
                            {info.title}
                        </h1>
                        <div style={{ color: 'var(--text-secondary)' }}>
                            Located at <strong>{info.location}</strong> • Occurred on {new Date(info.occurred_at).toLocaleString()}
                        </div>
                    </div>
                    <div className={`status-badge ${info.status.toLowerCase()}`}
                        style={{
                            display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase',
                            backgroundColor: info.status === 'Open' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                            color: info.status === 'Open' ? '#4ade80' : '#94a3b8',
                            border: `1px solid ${info.status === 'Open' ? '#4ade80' : '#94a3b8'}`
                        }}>
                        {info.status}
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-gold)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-gold)' }}>INITIAL REPORT</h4>
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
                            Investigation Log
                        </button>
                        <button
                            onClick={() => setActiveTab('todo')}
                            style={{
                                background: 'none', border: 'none',
                                borderBottom: activeTab === 'todo' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                color: activeTab === 'todo' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer'
                            }}>
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
                                            className="eval-textarea" rows="3"
                                            placeholder="Log a new finding, evidence or statement..."
                                            value={newUpdateContent} onChange={e => setNewUpdateContent(e.target.value)}
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
                                                📸 Add Evidence
                                            </label>
                                            <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submittingUpdate}>
                                                {submittingUpdate ? 'Posting...' : 'Post Update'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="updates-feed">
                                {updates.length === 0 ? <div className="empty-list">No updates or developments recorded yet.</div> : (
                                    updates.map(update => (
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
                                            </div>
                                            <div style={{ whiteSpace: 'pre-line', marginBottom: '1rem', color: 'var(--text-primary)' }}>{update.content}</div>
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
                                    ))
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
                            <h4 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>Assigned Agents</h4>
                            {info.status === 'Open' && (
                                <button onClick={openAssignModal} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.8rem' }}>Manage</button>
                            )}
                        </div>
                        <div className="assigned-list">
                            {assignments.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No agents assigned.</div> : (
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
                </div>
            </div>

            {/* Assignments Modal */}
            {showAssignModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Manage Assignment</h3>
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
                            <button className="login-button btn-secondary" onClick={() => setShowAssignModal(false)} style={{ width: 'auto' }}>Cancel</button>
                            <button className="login-button" onClick={handleUpdateAssignments} style={{ width: 'auto' }}>Save Changes</button>
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

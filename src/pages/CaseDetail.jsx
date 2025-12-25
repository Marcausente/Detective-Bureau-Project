import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function CaseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('updates'); // updates, evidence, interrogations

    // New Update State
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [newUpdateImage, setNewUpdateImage] = useState(null); // Base64 string
    const [submittingUpdate, setSubmittingUpdate] = useState(false);

    useEffect(() => {
        loadCaseDetails();
    }, [id]);

    const loadCaseDetails = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_case_details', { p_case_id: id });
        if (error) {
            console.error('Error loading case:', error);
            alert('Failed to load case details.');
        } else {
            setCaseData(data);
        }
        setLoading(false);
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
        const file = e.target.files[0];
        if (!file) return;

        // Compress Image Logic
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resize for updates
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Compress to JPEG 0.7 quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setNewUpdateImage(dataUrl);
            };
        };
    };

    const handlePostUpdate = async (e) => {
        e.preventDefault();
        if (!newUpdateContent.trim()) return;

        setSubmittingUpdate(true);
        try {
            const { error } = await supabase.rpc('add_case_update', {
                p_case_id: id,
                p_content: newUpdateContent,
                p_image: newUpdateImage
            });

            if (error) throw error;

            setNewUpdateContent('');
            setNewUpdateImage(null);
            loadCaseDetails();
        } catch (err) {
            alert('Error posting update: ' + err.message);
        } finally {
            setSubmittingUpdate(false);
        }
    };

    if (loading) return <div className="loading-container">Loading Case File...</div>;
    if (!caseData || !caseData.info) return <div className="loading-container">Case Not Found</div>;

    const { info, assignments, updates, interrogations } = caseData;

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            {/* Header */}
            <div className="case-detail-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => navigate('/cases')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', marginBottom: '1rem' }}>
                    ← Back to Cases
                </button>

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

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {info.status === 'Open' && (
                                <>
                                    <button className="login-button btn-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => handleStatusChange('Closed')}>Close Case</button>
                                    <button className="login-button btn-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => handleStatusChange('Archived')}>Archive</button>
                                </>
                            )}
                            {info.status !== 'Open' && (
                                <button className="login-button btn-secondary" style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => handleStatusChange('Open')}>Re-Open Case</button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Initial Description */}
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-gold)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-gold)' }}>INITIAL REPORT</h4>
                    <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>{info.description}</p>
                </div>
            </div>

            <div className="case-layout" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                {/* Left Column: Updates & Timeline */}
                <div className="case-main-content">
                    <h3 className="section-title">Case Updates & Evidence</h3>

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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <label className="custom-file-upload" style={{ display: 'inline-block', width: 'auto', margin: 0, fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} />
                                            📸 Add Image
                                        </label>
                                        {newUpdateImage && <span style={{ color: '#4ade80', fontSize: '0.9rem' }}>Image Attached ✓</span>}
                                        {newUpdateImage && <button type="button" onClick={() => setNewUpdateImage(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>Remove</button>}
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
                            updates.map(update => (
                                <div key={update.id} className="case-update-card" style={{
                                    background: 'rgba(30, 41, 59, 0.4)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem',
                                    borderLeft: '2px solid rgba(255,255,255,0.1)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                                        <img src={update.author_avatar || '/anon.png'} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', marginRight: '10px' }} />
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{update.author_rank} {update.author_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(update.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div style={{ whiteSpace: 'pre-line', marginBottom: '1rem', color: 'var(--text-primary)' }}>{update.content}</div>
                                    {update.image && (
                                        <div style={{ marginTop: '1rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <a href={update.image} target="_blank" rel="noreferrer">
                                                <img src={update.image} alt="Evidence" style={{ width: '100%', display: 'block' }} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Key Info & Linked Data */}
                <div className="case-sidebar">
                    {/* Assigned Detectives */}
                    <div className="sidebar-section" style={{ marginBottom: '2rem' }}>
                        <h4 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Assigned Detectives</h4>
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
                        <h4 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Linked Interrogations</h4>
                        <div className="linked-interrogations">
                            {interrogations.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No interrogations linked.</div> : (
                                interrogations.map(inv => (
                                    <div key={inv.id}
                                        onClick={() => navigate(`/interrogations?id=${inv.id}`)}
                                        style={{
                                            padding: '0.8rem', marginBottom: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', cursor: 'pointer',
                                            borderLeft: '2px solid var(--accent-gold)'
                                        }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{inv.title}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subjects: {inv.subjects}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* TODO: Add button to link existing interrogation (Later feature) */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CaseDetail;

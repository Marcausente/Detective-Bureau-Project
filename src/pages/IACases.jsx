import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function IACases() {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Open'); // Open, Closed, Archived
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form State
    const [newCase, setNewCase] = useState({
        title: '',
        location: '',
        occurred_at: '',
        description: '',
        assignments: [], // Array of user IDs
        initialImage: null
    });
    const [users, setUsers] = useState([]); // IA Users for assignment
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchCases();
        fetchIAUsers();
    }, [filter]);

    const fetchCases = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_ia_cases', { p_status_filter: filter });
        if (error) console.error('Error fetching IA cases:', error);
        else setCases(data || []);
        setLoading(false);
    };

    const fetchIAUsers = async () => {
        // Fetch ALL users then filter client-side for "Internal Affairs" division
        // OR better, create an RPC. For now client-side filter is fine if dataset isn't huge.
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango, profile_image, divisions').order('rango');
        if (data) {
            const iaUsers = data.filter(u => u.divisions && u.divisions.includes('Internal Affairs'));
            setUsers(iaUsers);
        }
    };

    const handleCreateCase = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const timestamp = new Date(newCase.occurred_at).toISOString();

            const { data: newId, error } = await supabase.rpc('create_ia_case', {
                p_title: newCase.title,
                p_location: newCase.location,
                p_occurred_at: timestamp,
                p_description: newCase.description,
                p_assigned_ids: newCase.assignments,
                p_image: newCase.initialImage
            });

            if (error) throw error;

            setShowCreateModal(false);
            navigate(`/internal-affairs/cases/${newId}`);

        } catch (err) {
            alert('Error creating IA case: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleAssignment = (userId) => {
        const current = newCase.assignments;
        if (current.includes(userId)) {
            setNewCase({ ...newCase, assignments: current.filter(id => id !== userId) });
        } else {
            setNewCase({ ...newCase, assignments: [...current, userId] });
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
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
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                setNewCase({ ...newCase, initialImage: dataUrl });
            };
        };
    };

    const statusColors = {
        'Open': '#4ade80',     // Green
        'Closed': '#f87171',   // Red
        'Archived': '#94a3b8'  // Gray
    };

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div className="doc-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <button onClick={() => navigate('/internal-affairs')} style={{ display: 'block', marginBottom: '0.5rem', background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer' }}>← Back to Dashboard</button>
                    <h2 className="page-title" style={{ color: '#f87171' }}>INTERNAL AFFAIRS DIVISION</h2>
                </div>
                <button className="login-button" style={{ width: 'auto', backgroundColor: '#7f1d1d' }} onClick={() => setShowCreateModal(true)}>
                    + New IA Investigation
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                {['Open', 'Closed', 'Archived'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: filter === status ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            fontWeight: filter === status ? 'bold' : 'normal',
                            fontSize: '1.rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            padding: '0.5rem 1rem',
                            borderBottom: filter === status ? '2px solid var(--accent-gold)' : 'none'
                        }}
                    >
                        {status} Cases
                    </button>
                ))}
            </div>

            {/* Case Grid */}
            {loading ? (
                <div className="loading-container">Loading Investigations...</div>
            ) : cases.length === 0 ? (
                <div className="empty-list">No {filter.toLowerCase()} investigations found.</div>
            ) : (
                <div className="dashboard-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {cases.map(c => (
                        <div
                            key={c.id}
                            className="announcement-card case-card"
                            style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: `4px solid ${statusColors[c.status]}` }}
                            onClick={() => navigate(`/internal-affairs/cases/${c.id}`)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>IA-CASE #{String(c.case_number).padStart(3, '0')}</span>
                                <span style={{ color: statusColors[c.status], fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase' }}>{c.status}</span>
                            </div>

                            <h3 style={{ margin: '0.5rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>{c.title}</h3>

                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                📍 {c.location} • 📅 {new Date(c.occurred_at).toLocaleDateString()}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', marginRight: '0.5rem' }}>
                                    {c.assigned_avatars && c.assigned_avatars.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={img || '/anon.png'}
                                            alt="Ag"
                                            style={{
                                                width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover',
                                                marginLeft: idx > 0 ? '-10px' : '0', border: '2px solid var(--bg-dark)'
                                            }}
                                        />
                                    ))}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Agents Assigned</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '700px', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 className="section-title">Open New IA Investigation</h3>
                        <form onSubmit={handleCreateCase}>
                            <div className="form-group">
                                <label className="form-label">Case Title</label>
                                <input type="text" className="form-input" required
                                    value={newCase.title} onChange={e => setNewCase({ ...newCase, title: e.target.value })} placeholder="e.g. Officer Misconduct - 418" />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input type="text" className="form-input" required
                                        value={newCase.location} onChange={e => setNewCase({ ...newCase, location: e.target.value })} placeholder="e.g. Mission Row PD" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date & Time</label>
                                    <input type="datetime-local" className="form-input" required
                                        value={newCase.occurred_at} onChange={e => setNewCase({ ...newCase, occurred_at: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Initial Report / Description</label>
                                <textarea className="eval-textarea" rows="5" required
                                    value={newCase.description} onChange={e => setNewCase({ ...newCase, description: e.target.value })} placeholder="Describe the incident details..." />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Evidence / Scene Photo (Optional)</label>
                                <label className="login-button btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', height: '50px', borderStyle: 'dashed' }}>
                                    📷 Add Photo
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                </label>
                                {newCase.initialImage && (
                                    <div style={{ position: 'relative', marginTop: '10px' }}>
                                        <img src={newCase.initialImage} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} alt="Evidence" />
                                        <button type="button" onClick={() => setNewCase({ ...newCase, initialImage: null })} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer' }}>×</button>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Assign IA Agents</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                                    {users.length === 0 ? <div style={{ color: '#aaa', padding: '1rem' }}>No Internal Affairs agents found.</div> :
                                        users.map(u => (
                                            <div key={u.id}
                                                onClick={() => toggleAssignment(u.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', padding: '0.5rem',
                                                    cursor: 'pointer', background: newCase.assignments.includes(u.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                                                    marginBottom: '2px'
                                                }}>
                                                <input type="checkbox" checked={newCase.assignments.includes(u.id)} readOnly style={{ marginRight: '10px' }} />
                                                <img src={u.profile_image || '/anon.png'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '10px' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)} style={{ width: 'auto' }}>Cancel</button>
                                <button type="submit" className="login-button" disabled={submitting} style={{ width: 'auto' }}>{submitting ? 'Creating...' : 'Create Case'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IACases;

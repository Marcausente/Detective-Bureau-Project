import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function WarrantRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pendiente'); // Pendiente, Historial
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // User Permissions
    const [currentUser, setCurrentUser] = useState(null);

    // Form State
    const [newRequest, setNewRequest] = useState({
        type: 'Orden de Allanamiento',
        target: '',
        location: '',
        reason: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadUserAndRequests();
    }, [activeTab]);

    const loadUserAndRequests = async () => {
        setLoading(true);
        // Load User
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
            setCurrentUser(data);
        }

        // Load Requests
        const { data: wData, error } = await supabase.rpc('get_warrant_requests', { p_status_filter: activeTab });
        if (error) console.error(error);
        else setRequests(wData || []);
        
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_warrant_request', {
                p_type: newRequest.type,
                p_target: newRequest.target,
                p_location: newRequest.location,
                p_reason: newRequest.reason
            });

            if (error) throw error;

            setShowCreateModal(false);
            setNewRequest({ type: 'Orden de Allanamiento', target: '', location: '', reason: '' });
            loadUserAndRequests();
        } catch (err) {
            alert('Error creating request: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReview = async (id, status) => {
        if (!window.confirm(`Are you sure you want to mark this as ${status}?`)) return;
        try {
            const { error } = await supabase.rpc('review_warrant_request', {
                p_request_id: id,
                p_status: status
            });
            if (error) throw error;
            loadUserAndRequests();
        } catch (err) {
            alert('Error updating status: ' + err.message);
        }
    };

    const canReview = currentUser && ['Administrador', 'Coordinador', 'Comisionado', 'Jefe', 'Capitan'].includes(currentUser.rol);
    const isAyudante = currentUser && currentUser.rol === 'Ayudante';

    return (
        <div className="documentation-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div className="doc-header" style={{ marginBottom: '2rem' }}>
                <h2 className="page-title">JUDICIAL WARRANTS</h2>
                {!isAyudante && (
                    <button className="login-button" style={{ width: 'auto' }} onClick={() => setShowCreateModal(true)}>
                        + New Request
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="filter-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                <button
                    onClick={() => setActiveTab('Pendiente')}
                    style={{
                        background: 'none', border: 'none',
                        color: activeTab === 'Pendiente' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'Pendiente' ? '2px solid var(--accent-gold)' : 'none',
                        padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem'
                    }}
                >
                    Pending Review
                </button>
                <button
                    onClick={() => setActiveTab('Historial')}
                    style={{
                        background: 'none', border: 'none',
                        color: activeTab === 'Historial' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'Historial' ? '2px solid var(--accent-gold)' : 'none',
                        padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem'
                    }}
                >
                    History
                </button>
            </div>

            {loading ? (
                <div className="loading-container">Loading Requests...</div>
            ) : requests.length === 0 ? (
                <div className="empty-list">No requests found.</div>
            ) : (
                <div className="dashboard-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {requests.map(req => (
                        <div key={req.id} className="announcement-card" style={{
                            borderLeft: `4px solid ${req.status === 'Pendiente' ? '#fbbf24' : req.status === 'Aprobada' ? '#4ade80' : '#f87171'}`,
                            cursor: 'default'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>{req.request_type}</span>
                                <span style={{
                                    color: req.status === 'Pendiente' ? '#fbbf24' : req.status === 'Aprobada' ? '#4ade80' : '#f87171',
                                    fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem'
                                }}>
                                    {req.status}
                                </span>
                            </div>

                            <h3 style={{ margin: '0.5rem 0', color: 'var(--text-primary)' }}>target: {req.target_name}</h3>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                📍 {req.location}
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                                <strong>Reason available evidence:</strong><br/>
                                {req.reason}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <img src={req.requester_avatar || '/anon.png'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }} />
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{req.requester_rank} {req.requester_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(req.created_at).toLocaleString()}</div>
                                    </div>
                                </div>

                                {req.status === 'Pendiente' && canReview && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="login-button btn-secondary" style={{ width: 'auto', background: 'rgba(248, 113, 113, 0.2)', color: '#f87171', border: '1px solid #f87171' }} onClick={() => handleReview(req.id, 'Rechazada')}>Deny</button>
                                        <button className="login-button" style={{ width: 'auto', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', border: '1px solid #4ade80' }} onClick={() => handleReview(req.id, 'Aprobada')}>Approve</button>
                                    </div>
                                )}
                                
                                {req.status !== 'Pendiente' && req.reviewer_name && (
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Reviewed by {req.reviewer_name}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px' }}>
                        <h3 className="section-title">Request Judicial Warrant</h3>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Warrant Type</label>
                                <select className="form-input custom-select" required
                                    value={newRequest.type} onChange={e => setNewRequest({ ...newRequest, type: e.target.value })}>
                                    <option value="Orden de Allanamiento">Search Warrant (Allanamiento)</option>
                                    <option value="Orden de Arresto">Arrest Warrant (Arresto)</option>
                                    <option value="Orden de Vigilancia">Surveillance Warrant (Vigilancia)</option>
                                    <option value="Otro">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Target Name (Person / Property)</label>
                                <input type="text" className="form-input" required
                                    value={newRequest.target} onChange={e => setNewRequest({ ...newRequest, target: e.target.value })}
                                    placeholder="e.g. John Doe OR 123 Alta St" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Location / Address</label>
                                <input type="text" className="form-input" required
                                    value={newRequest.location} onChange={e => setNewRequest({ ...newRequest, location: e.target.value })}
                                    placeholder="e.g. 123 Alta St, Apt 4" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Probable Cause / Reasoning</label>
                                <textarea className="eval-textarea" rows="5" required
                                    value={newRequest.reason} onChange={e => setNewRequest({ ...newRequest, reason: e.target.value })}
                                    placeholder="Explain why this warrant is needed and what evidence supports it..." />
                            </div>

                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)} style={{ width: 'auto' }}>Cancel</button>
                                <button type="submit" className="login-button" disabled={submitting} style={{ width: 'auto' }}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WarrantRequests;

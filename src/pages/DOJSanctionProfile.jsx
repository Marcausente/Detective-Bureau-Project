import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function DOJSanctionProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [cases, setCases] = useState([]); // For dropdown
    const [formData, setFormData] = useState({
        type: 'Media', // Default
        description: '',
        date: new Date().toISOString().split('T')[0],
        caseId: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_doj_subject_details', { p_subject_id: id });
            if (error) throw error;
            setProfileData(data);
        } catch (err) {
            console.error('Error loading profile:', err);
            alert('Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    const loadCasesForDropdown = async () => {
        const { data, error } = await supabase.rpc('get_doj_cases_dropdown');
        if (error) {
            console.error('Error loading cases:', error);
            // alert('Error loading cases: ' + error.message); 
        }
        setCases(data || []);
    };

    const openForCreate = () => {
        setModalMode('create');
        setEditingId(null);
        setFormData({ type: 'Media', description: '', date: new Date().toISOString().split('T')[0], caseId: '' });
        loadCasesForDropdown();
        setShowModal(true);
    };

    const openForEdit = (item) => {
        setModalMode('update');
        setEditingId(item.id);
        setFormData({
            type: item.type,
            description: item.description || '',
            date: item.date,
            caseId: item.case_id || ''
        });
        loadCasesForDropdown();
        setShowModal(true);
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('manage_doj_sanction', {
                p_action: modalMode,
                p_id: editingId, // Ignored if create
                p_subject_id: id,
                p_type: formData.type,
                p_description: formData.description,
                p_date: formData.date,
                p_case_id: formData.caseId || null
            });
            if (error) throw error;

            setShowModal(false);
            loadData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (sanctionId) => {
        if (!window.confirm("Are you sure you want to delete this sanction record?")) return;
        try {
            const { error } = await supabase.rpc('manage_doj_sanction', {
                p_action: 'delete',
                p_id: sanctionId
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    if (loading) return <div className="loading-screen">Loading Profile...</div>;
    if (!profileData) return <div className="loading-screen" style={{ color: '#3b82f6' }}>Profile Not Found.</div>;

    const { profile, sanctions } = profileData;

    return (
        <div className="documentation-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <button onClick={() => navigate('/doj/sanctions')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}>
                    ← Back to Registry
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', background: 'rgba(30, 41, 59, 0.4)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{
                        width: '100px', height: '100px', borderRadius: '50%',
                        background: 'rgba(248, 113, 113, 0.1)',
                        color: '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2.5rem', fontWeight: 'bold',
                        border: '2px solid #3b82f6'
                    }}>
                        {profile.nombre[0]}{profile.apellido[0]}
                    </div>
                    <div>
                        <h1 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc' }}>{profile.nombre} {profile.apellido}</h1>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Badge Number: <span style={{ color: 'var(--accent-gold)' }}>{profile.no_placa}</span></div>
                        <div style={{ color: '#3b82f6', fontWeight: 'bold' }}>Total Sanctions: {sanctions.length}</div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        <button className="login-button" style={{ width: 'auto' }} onClick={openForCreate}>
                            + Register Sanction
                        </button>
                    </div>
                </div>
            </div>

            {/* Sanctions History */}
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: '#f8fafc' }}>Disciplinary History</h3>

            <div className="sanctions-timeline">
                {sanctions.length === 0 ? (
                    <div className="empty-list">No disciplinary records found for this officer.</div>
                ) : (
                    sanctions.map(item => (
                        <div key={item.id} style={{
                            display: 'flex',
                            gap: '1.5rem',
                            marginBottom: '2rem',
                            position: 'relative'
                        }}>
                            {/* Timeline Line */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    background: item.type === 'Grave' ? '#ef4444' : item.type === 'Media' ? '#f59e0b' : '#3b82f6',
                                    border: '2px solid rgba(255,255,255,0.2)'
                                }}></div>
                                <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.1)', minHeight: '50px' }}></div>
                            </div>

                            {/* Card */}
                            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{
                                            fontWeight: 'bold',
                                            color: item.type === 'Grave' ? '#ef4444' : item.type === 'Media' ? '#f59e0b' : '#3b82f6',
                                            textTransform: 'uppercase',
                                            fontSize: '0.9rem',
                                            letterSpacing: '1px'
                                        }}>
                                            {item.type} Fault
                                        </span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.date}</span>
                                    </div>
                                    <div className="int-actions" style={{ marginLeft: '1rem', display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => openForEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Edit">✏️</button>
                                        <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Delete">🗑️</button>
                                    </div>
                                </div>
                                <div style={{ color: '#e2e8f0', marginBottom: '1rem', whiteSpace: 'pre-line' }}>
                                    {item.description || "No description provided."}
                                </div>

                                {item.case_id && (
                                    <div style={{
                                        marginTop: '1rem', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'
                                    }} onClick={() => navigate(`/doj/cases/${item.case_id}`)}>
                                        <span style={{ fontSize: '1.2rem' }}>📁</span>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Related Case</div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--accent-gold)' }}>DOJ-#{String(item.case_number).padStart(3, '0')} {item.case_title}</div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                    Registered by: {item.created_by_name}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#3b82f6' }}>{modalMode === 'create' ? 'Register Sanction' : 'Edit Sanction'}</h3>
                        <form onSubmit={handleAction}>
                            <div className="form-group">
                                <label className="form-label">Sanction Type</label>
                                <select className="form-input" style={{ backgroundColor: '#0f172a' }} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                    <option value="Leve">Leve (Minor)</option>
                                    <option value="Media">Media (Moderate)</option>
                                    <option value="Grave">Grave (Severe)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Date of Incident</label>
                                <input type="date" className="form-input" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description / Reason (Optional)</label>
                                <textarea className="form-input" rows="4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Link to DOJ Case (Optional)</label>
                                <select className="form-input" style={{ backgroundColor: '#0f172a' }} value={formData.caseId} onChange={e => setFormData({ ...formData, caseId: e.target.value })}>
                                    <option value="">-- No Linked Case --</option>
                                    {cases.map(c => (
                                        <option key={c.id} value={c.id}>
                                            DOJ-#{String(c.case_number).padStart(3, '0')} {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="login-button" disabled={submitting}>{submitting ? 'Saving...' : 'Confirm'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJSanctionProfile;

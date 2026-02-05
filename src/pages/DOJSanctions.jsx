import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function DOJSanctions() {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal & CRUD State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ nombre: '', apellido: '', no_placa: '' });
    const [loadingAction, setLoadingAction] = useState(false);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_doj_subjects');
            if (error) throw error;
            setProfiles(data || []);
        } catch (err) {
            console.error('Error loading profiles:', err);
        } finally {
            setLoading(false);
        }
    };

    const openForCreate = () => {
        setEditingId(null);
        setFormData({ nombre: '', apellido: '', no_placa: '' });
        setShowModal(true);
    };

    const openForEdit = (e, profile) => {
        e.stopPropagation();
        setEditingId(profile.id);
        setFormData({ nombre: profile.nombre, apellido: profile.apellido, no_placa: profile.no_placa });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoadingAction(true);
        try {
            if (editingId) {
                // Update
                const { error } = await supabase.rpc('update_doj_subject_profile', {
                    p_id: editingId,
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa
                });
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase.rpc('create_doj_subject_profile', {
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa
                });
                if (error) throw error;
            }
            setShowModal(false);
            loadProfiles();
        } catch (err) {
            alert('Error saving profile: ' + err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure? This will delete the officer profile and ALL their sanction history.")) return;

        try {
            const { error } = await supabase.rpc('delete_doj_subject_profile', { p_id: id });
            if (error) throw error;
            loadProfiles();
        } catch (err) {
            alert('Error deleting profile: ' + err.message);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.nombre + ' ' + p.apellido).toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.no_placa.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="documentation-container" style={{ padding: '2rem' }}>
            <div className="doc-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 className="page-title" style={{ margin: 0, color: '#3b82f6' }}>Sanctioned Personnel Registry</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Database of officers with disciplinary records.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Search Name or Badge..."
                        className="form-input"
                        style={{ width: '250px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={openForCreate}>
                        + New Profile
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">Loading Registry...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {filteredProfiles.length === 0 ? (
                        <div className="empty-list" style={{ gridColumn: '1/-1' }}>No profiles found.</div>
                    ) : (
                        filteredProfiles.map(profile => (
                            <div key={profile.id}
                                onClick={() => navigate(`/doj/sanctions/${profile.id}`)}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, border-color 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                }}
                            >
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%',
                                    background: 'rgba(248, 113, 113, 0.1)',
                                    color: '#3b82f6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', fontWeight: 'bold'
                                }}>
                                    {profile.nombre[0]}{profile.apellido[0]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#f8fafc' }}>{profile.nombre} {profile.apellido}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Badge: {profile.no_placa}</div>
                                    <div style={{ fontSize: '0.8rem', color: profile.sanction_count > 0 ? '#3b82f6' : '#4ade80', marginTop: '0.2rem' }}>
                                        {profile.sanction_count} Record{profile.sanction_count !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div className="card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={(e) => openForEdit(e, profile)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.1rem' }}
                                        title="Edit Profile"
                                        className="hover-text-white"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, profile.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem' }}
                                        title="Delete Profile"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '400px' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#3b82f6' }}>
                            {editingId ? 'Edit Officer Profile' : 'Register New Officer'}
                        </h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input"
                                    required
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Surname</label>
                                <input
                                    className="form-input"
                                    required
                                    value={formData.apellido}
                                    onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Badge Number</label>
                                <input
                                    className="form-input"
                                    required
                                    value={formData.no_placa}
                                    onChange={e => setFormData({ ...formData, no_placa: e.target.value })}
                                />
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)} disabled={loadingAction}>Cancel</button>
                                <button type="submit" className="login-button" disabled={loadingAction}>
                                    {loadingAction ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Registry')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJSanctions;

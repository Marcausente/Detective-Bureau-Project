import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function IASanctions() {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProfile, setNewProfile] = useState({ nombre: '', apellido: '', no_placa: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_ia_subjects');
            if (error) throw error;
            setProfiles(data || []);
        } catch (err) {
            console.error('Error loading profiles:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProfile = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const { error } = await supabase.rpc('create_ia_subject_profile', {
                p_nombre: newProfile.nombre,
                p_apellido: newProfile.apellido,
                p_no_placa: newProfile.no_placa
            });
            if (error) throw error;
            setShowCreateModal(false);
            setNewProfile({ nombre: '', apellido: '', no_placa: '' });
            loadProfiles();
        } catch (err) {
            alert('Error creating profile: ' + err.message);
        } finally {
            setCreating(false);
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
                    <h2 className="page-title" style={{ margin: 0, color: '#f87171' }}>Sanctioned Personnel Registry</h2>
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
                    <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => setShowCreateModal(true)}>
                        + New Profile
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">Loading Registry...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {filteredProfiles.length === 0 ? (
                        <div className="empty-list" style={{ gridColumn: '1/-1' }}>No profiles found.</div>
                    ) : (
                        filteredProfiles.map(profile => (
                            <div key={profile.id}
                                onClick={() => navigate(`/internal-affairs/sanctions/${profile.id}`)}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    padding: '1.5rem',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, border-color 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.borderColor = '#f87171';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                }}
                            >
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%',
                                    background: 'rgba(248, 113, 113, 0.1)',
                                    color: '#f87171',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', fontWeight: 'bold'
                                }}>
                                    {profile.nombre[0]}{profile.apellido[0]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#f8fafc' }}>{profile.nombre} {profile.apellido}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Badge: {profile.no_placa}</div>
                                    <div style={{ fontSize: '0.8rem', color: profile.sanction_count > 0 ? '#f87171' : '#4ade80', marginTop: '0.2rem' }}>
                                        {profile.sanction_count} Record{profile.sanction_count !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>→</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '400px' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#f87171' }}>Register New Officer</h3>
                        <form onSubmit={handleCreateProfile}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Name</label>
                                <input className="form-input" required value={newProfile.nombre} onChange={e => setNewProfile({ ...newProfile, nombre: e.target.value })} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Surname</label>
                                <input className="form-input" required value={newProfile.apellido} onChange={e => setNewProfile({ ...newProfile, apellido: e.target.value })} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Badge Number</label>
                                <input className="form-input" required value={newProfile.no_placa} onChange={e => setNewProfile({ ...newProfile, no_placa: e.target.value })} />
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="login-button" disabled={creating}>{creating ? 'Creating...' : 'Create Registry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IASanctions;

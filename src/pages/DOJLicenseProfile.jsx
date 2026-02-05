import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import '../index.css';

function DOJLicenseProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [licenses, setLicenses] = useState([]);
    const [licenseTypes, setLicenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Inline notes editing
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState('');

    // Modals
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Forms
    const [assignForm, setAssignForm] = useState({ license_type_id: '', expires_date: '' });
    const [editForm, setEditForm] = useState({
        nombre: '',
        apellido: '',
        id_number: '',
        phone_number: '',
        profile_image: '',
        notes: ''
    });

    // Image cropper
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadProfile(), loadLicenseTypes()]);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadProfile = async () => {
        const { data, error } = await supabase.rpc('get_doj_civilian_details', { p_civilian_id: id });
        if (error) throw error;
        if (data) {
            setProfile(data.profile);
            setLicenses(data.licenses || []);
            setNotesText(data.profile.notes || '');
        }
    };

    const loadLicenseTypes = async () => {
        const { data, error } = await supabase.rpc('get_doj_license_types');
        if (error) throw error;
        setLicenseTypes(data || []);
    };

    const openEditModal = () => {
        setEditForm({
            nombre: profile.nombre,
            apellido: profile.apellido,
            id_number: profile.id_number,
            phone_number: profile.phone_number || '',
            profile_image: profile.profile_image || '',
            notes: profile.notes || ''
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('update_doj_civilian', {
                p_id: id,
                ...Object.fromEntries(Object.entries(editForm).map(([k, v]) => [`p_${k}`, v]))
            });
            setShowEditModal(false);
            loadProfile();
        } catch (err) {
            alert('Error updating profile: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this civilian profile? This action cannot be undone.')) return;
        try {
            await supabase.rpc('delete_doj_civilian', { p_id: id });
            navigate('/doj/licenses');
        } catch (err) {
            alert('Error deleting profile: ' + err.message);
        }
    };

    const handleAssignLicense = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('assign_doj_license', {
                p_civilian_id: id,
                p_license_type_id: assignForm.license_type_id,
                p_expires_date: assignForm.expires_date || null
            });
            setShowAssignModal(false);
            setAssignForm({ license_type_id: '', expires_date: '' });
            loadProfile();
        } catch (err) {
            alert('Error assigning license: ' + err.message);
        }
    };

    const handleUpdateLicenseStatus = async (licenseId, newStatus) => {
        try {
            await supabase.rpc('update_doj_license_status', {
                p_license_id: licenseId,
                p_status: newStatus
            });
            loadProfile();
        } catch (err) {
            alert('Error updating status: ' + err.message);
        }
    };

    const handleRevokeLicense = async (licenseId) => {
        if (!window.confirm('Revoke this license? This will permanently remove it.')) return;
        try {
            await supabase.rpc('revoke_doj_license', { p_license_id: licenseId });
            loadProfile();
        } catch (err) {
            alert('Error revoking license: ' + err.message);
        }
    };

    // Notes handlers
    const handleSaveNotes = async () => {
        try {
            await supabase.rpc('update_doj_civilian', {
                p_id: id,
                p_nombre: profile.nombre,
                p_apellido: profile.apellido,
                p_id_number: profile.id_number,
                p_phone_number: profile.phone_number || '',
                p_profile_image: profile.profile_image || '',
                p_notes: notesText
            });
            setEditingNotes(false);
            loadProfile();
        } catch (err) {
            alert('Error saving notes: ' + err.message);
        }
    };

    const handleCancelNotes = () => {
        setNotesText(profile.notes || '');
        setEditingNotes(false);
    };

    // Image cropper
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageSrc(file);
            setEditorOpen(true);
            e.target.value = '';
        }
    };

    const handleSaveCroppedImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            setEditForm({ ...editForm, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': return '#4ade80';
            case 'Expired': return '#f59e0b';
            case 'Suspended': return '#f97316';
            case 'Revoked': return '#ef4444';
            default: return '#94a3b8';
        }
    };

    const getStatusOptions = (currentStatus) => {
        return ['Active', 'Suspended', 'Revoked', 'Expired'].filter(s => s !== currentStatus);
    };

    if (loading) return <div className="loading-container">Loading Profile...</div>;
    if (!profile) return <div className="error-message">Profile not found</div>;

    return (
        <div className="personnel-detail-container">
            <button className="back-button" onClick={() => navigate('/doj/licenses')}>← Back to Licenses</button>

            <div className="detail-card">
                {/* Header */}
                <div className="detail-header">
                    <div className="detail-image-wrapper">
                        {profile.profile_image ? (
                            <img src={profile.profile_image} alt={profile.nombre} className="detail-image" />
                        ) : (
                            <img src="/anon.png" alt="No photo" className="detail-image" />
                        )}
                    </div>
                    <div className="detail-title">
                        <h1 className="detail-name">{profile.nombre} {profile.apellido}</h1>
                        <h2 className="detail-rank" style={{ color: '#3b82f6' }}>Civilian</h2>
                        <span className="detail-badge">ID: {profile.id_number}</span>
                        {profile.phone_number && <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }}>📞 {profile.phone_number}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                        <button className="login-button btn-secondary" onClick={openEditModal}>Edit Profile</button>
                        <button className="login-button" style={{ background: '#ef4444' }} onClick={handleDelete}>Delete</button>
                    </div>
                </div>

                <div className="detail-body">
                    {/* Notes Section */}
                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3>Notes</h3>
                            {!editingNotes ? (
                                <button className="login-button btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={() => setEditingNotes(true)}>✏️ Edit</button>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="login-button btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={handleCancelNotes}>Cancel</button>
                                    <button className="login-button" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={handleSaveNotes}>💾 Save</button>
                                </div>
                            )}
                        </div>
                        {editingNotes ? (
                            <textarea
                                className="form-input"
                                rows="6"
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                placeholder="Add notes about this civilian..."
                                autoFocus
                                style={{ marginTop: '0.5rem' }}
                            />
                        ) : (
                            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', minHeight: '80px', whiteSpace: 'pre-wrap', color: profile.notes ? '#f8fafc' : '#64748b' }}>
                                {profile.notes || 'No notes recorded'}
                            </div>
                        )}
                    </div>

                    {/* Licenses Section */}
                    <div className="detail-section" style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Issued Licenses</h3>
                            <button className="login-button" onClick={() => setShowAssignModal(true)}>+ Assign License</button>
                        </div>

                        {licenses.length === 0 ? (
                            <div className="empty-list">No licenses assigned</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {licenses.map(lic => (
                                    <div key={lic.id} style={{
                                        padding: '1.5rem',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: `2px solid ${getStatusColor(lic.status)}`,
                                        borderRadius: '8px',
                                        position: 'relative'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', fontSize: '1.1rem' }}>{lic.license_name}</h4>
                                                {lic.license_description && <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>{lic.license_description}</p>}
                                                
                                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                                                    <div>
                                                        <strong>Issued:</strong> {new Date(lic.issued_date).toLocaleDateString()}
                                                    </div>
                                                    {lic.expires_date && (
                                                        <div>
                                                            <strong>Expires:</strong> {new Date(lic.expires_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <strong>By:</strong> {lic.issued_by_name}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                {/* Status Badge */}
                                                <span style={{
                                                    padding: '0.3rem 0.8rem',
                                                    borderRadius: '12px',
                                                    background: getStatusColor(lic.status) + '20',
                                                    color: getStatusColor(lic.status),
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {lic.status}
                                                </span>

                                                {/* Status Dropdown */}
                                                <select
                                                    className="form-input custom-select"
                                                    style={{ width: 'auto', padding: '0.3rem', fontSize: '0.85rem' }}
                                                    value=""
                                                    onChange={(e) => handleUpdateLicenseStatus(lic.id, e.target.value)}
                                                >
                                                    <option value="">Change Status</option>
                                                    {getStatusOptions(lic.status).map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>

                                                {/* Revoke Button */}
                                                <button
                                                    className="card-action-btn delete-btn"
                                                    onClick={() => handleRevokeLicense(lic.id)}
                                                    title="Revoke License"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Assign License Modal */}
            {showAssignModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Assign License</h3>
                        <form onSubmit={handleAssignLicense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">License Type *</label>
                                <select required className="form-input custom-select" value={assignForm.license_type_id} onChange={(e) => setAssignForm({ ...assignForm, license_type_id: e.target.value })}>
                                    <option value="">Select license type...</option>
                                    {licenseTypes.map(lt => (
                                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Expiration Date (Optional)</label>
                                <input type="date" className="form-input" value={assignForm.expires_date} onChange={(e) => setAssignForm({ ...assignForm, expires_date: e.target.value })} />
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                                <button type="submit" className="login-button">Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {showEditModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Edit Profile</h3>
                        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">First Name *</label>
                                <input required className="form-input" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name *</label>
                                <input required className="form-input" value={editForm.apellido} onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">ID Number *</label>
                                <input required className="form-input" value={editForm.id_number} onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="form-input" value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Profile Photo</label>
                                <label className="custom-file-upload">
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} />
                                    {editForm.profile_image ? "Photo Selected (Click to change)" : "Choose Photo"}
                                </label>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea className="form-input" rows="4" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                <button type="submit" className="login-button">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Cropper */}
            {editorOpen && createPortal(
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content">
                        <h3>Adjust Profile Picture</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor ref={editorRef} image={imageSrc} width={250} height={250} border={20} borderRadius={125} color={[0, 0, 0, 0.6]} scale={scale} />
                        </div>
                        <div className="cropper-controls">
                            <div className="zoom-slider-container">
                                <span>-</span>
                                <input type="range" min="1" max="3" step="0.01" value={scale} className="zoom-slider" onChange={(e) => setScale(parseFloat(e.target.value))} />
                                <span>+</span>
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => { setEditorOpen(false); setImageSrc(null); }}>Cancel</button>
                                <button type="button" className="login-button" onClick={handleSaveCroppedImage}>Save Image</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default DOJLicenseProfile;

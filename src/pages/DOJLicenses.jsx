import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import '../index.css';

function DOJLicenses() {
    const navigate = useNavigate();
    const [civilians, setCivilians] = useState([]);
    const [licenseTypes, setLicenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showCivilianModal, setShowCivilianModal] = useState(false);
    const [showLicenseTypesModal, setShowLicenseTypesModal] = useState(false);

    // Civilian form
    const [civilianForm, setCivilianForm] = useState({
        nombre: '',
        apellido: '',
        id_number: '',
        phone_number: '',
        profile_image: '',
        notes: ''
    });
    const [editingCivilianId, setEditingCivilianId] = useState(null);

    // License type form
    const [licenseTypeForm, setLicenseTypeForm] = useState({ name: '', description: '' });
    const [editingLicenseTypeId, setEditingLicenseTypeId] = useState(null);

    // Image cropper
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadCivilians(), loadLicenseTypes()]);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadCivilians = async () => {
        const { data, error } = await supabase.rpc('get_doj_civilians');
        if (error) throw error;
        setCivilians(data || []);
    };

    const loadLicenseTypes = async () => {
        const { data, error } = await supabase.rpc('get_doj_license_types');
        if (error) throw error;
        setLicenseTypes(data || []);
    };

    // ===== CIVILIAN CRUD =====
    const openCivilianModal = (civilian = null) => {
        if (civilian) {
            setCivilianForm({
                nombre: civilian.nombre,
                apellido: civilian.apellido,
                id_number: civilian.id_number,
                phone_number: civilian.phone_number || '',
                profile_image: civilian.profile_image || '',
                notes: civilian.notes || ''
            });
            setEditingCivilianId(civilian.id);
        } else {
            setCivilianForm({ nombre: '', apellido: '', id_number: '', phone_number: '', profile_image: '', notes: '' });
            setEditingCivilianId(null);
        }
        setShowCivilianModal(true);
    };

    const handleSaveCivilian = async (e) => {
        e.preventDefault();
        try {
            if (editingCivilianId) {
                await supabase.rpc('update_doj_civilian', {
                    p_id: editingCivilianId,
                    ...Object.fromEntries(Object.entries(civilianForm).map(([k, v]) => [`p_${k}`, v]))
                });
            } else {
                await supabase.rpc('create_doj_civilian', {
                    ...Object.fromEntries(Object.entries(civilianForm).map(([k, v]) => [`p_${k}`, v]))
                });
            }
            setShowCivilianModal(false);
            loadCivilians();
        } catch (err) {
            alert('Error saving civilian: ' + err.message);
        }
    };

    const handleDeleteCivilian = async (id) => {
        if (!window.confirm('Are you sure you want to delete this civilian profile?')) return;
        try {
            await supabase.rpc('delete_doj_civilian', { p_id: id });
            loadCivilians();
        } catch (err) {
            alert('Error deleting civilian: ' + err.message);
        }
    };

    // ===== LICENSE TYPE CRUD =====
    const handleSaveLicenseType = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('manage_doj_license_type', {
                p_action: editingLicenseTypeId ? 'update' : 'create',
                p_id: editingLicenseTypeId,
                p_name: licenseTypeForm.name,
                p_description: licenseTypeForm.description
            });
            setLicenseTypeForm({ name: '', description: '' });
            setEditingLicenseTypeId(null);
            loadLicenseTypes();
        } catch (err) {
            alert('Error saving license type: ' + err.message);
        }
    };

    const handleDeleteLicenseType = async (id) => {
        if (!window.confirm('Delete this license type? All issued licenses of this type will be removed.')) return;
        try {
            await supabase.rpc('manage_doj_license_type', { p_action: 'delete', p_id: id });
            loadLicenseTypes();
        } catch (err) {
            alert('Error deleting license type: ' + err.message);
        }
    };

    // ===== IMAGE CROPPER =====
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
            setCivilianForm({ ...civilianForm, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    // ===== FILTERING =====
    const filteredCivilians = civilians.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="loading-container">Loading Licenses...</div>;

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 className="page-title" style={{ margin: 0, color: '#3b82f6' }}>DOJ Licenses Management</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="login-button btn-secondary" onClick={() => setShowLicenseTypesModal(true)}>
                        Manage License Types
                    </button>
                    <button className="login-button" onClick={() => openCivilianModal()}>
                        + New Civilian
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <input
                type="text"
                placeholder="Search by name or ID..."
                className="form-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ marginBottom: '2rem', maxWidth: '400px' }}
            />

            {/* Civilians Grid */}
            <div className="personnel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {filteredCivilians.length === 0 ? (
                    <div className="empty-list">No civilians found</div>
                ) : (
                    filteredCivilians.map(civilian => (
                        <div key={civilian.id} className="personnel-card" onClick={() => navigate(`/doj/licenses/${civilian.id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
                            <div className="personnel-image-container">
                                {civilian.profile_image ? (
                                    <img src={civilian.profile_image} alt={civilian.nombre} className="personnel-image" />
                                ) : (
                                    <img src="/anon.png" alt="No photo" className="personnel-image" />
                                )}
                            </div>
                            <div className="personnel-info">
                                <div className="personnel-name">{civilian.nombre} {civilian.apellido}</div>
                                <div className="personnel-badge">ID: {civilian.id_number}</div>
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                    📜 {civilian.license_count} {civilian.license_count === 1 ? 'License' : 'Licenses'}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Civilian Modal */}
            {showCivilianModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                            {editingCivilianId ? 'Edit Civilian' : 'New Civilian Profile'}
                        </h3>
                        <form onSubmit={handleSaveCivilian} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">First Name *</label>
                                <input required className="form-input" value={civilianForm.nombre} onChange={(e) => setCivilianForm({ ...civilianForm, nombre: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name *</label>
                                <input required className="form-input" value={civilianForm.apellido} onChange={(e) => setCivilianForm({ ...civilianForm, apellido: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">ID Number *</label>
                                <input required className="form-input" value={civilianForm.id_number} onChange={(e) => setCivilianForm({ ...civilianForm, id_number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="form-input" value={civilianForm.phone_number} onChange={(e) => setCivilianForm({ ...civilianForm, phone_number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Profile Photo</label>
                                <label className="custom-file-upload">
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} />
                                    {civilianForm.profile_image ? "Photo Selected (Click to change)" : "Choose Photo"}
                                </label>
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowCivilianModal(false)}>Cancel</button>
                                <button type="submit" className="login-button">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* License Types Modal */}
            {showLicenseTypesModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px' }}>
                        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Manage License Types</h3>
                        
                        {/* Add/Edit Form */}
                        <form onSubmit={handleSaveLicenseType} style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">License Name *</label>
                                <input required className="form-input" value={licenseTypeForm.name} onChange={(e) => setLicenseTypeForm({ ...licenseTypeForm, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows="2" value={licenseTypeForm.description} onChange={(e) => setLicenseTypeForm({ ...licenseTypeForm, description: e.target.value })} />
                            </div>
                            <button type="submit" className="login-button" style={{ width: 'auto', alignSelf: 'flex-end' }}>
                                {editingLicenseTypeId ? 'Update' : '+ Add'} License Type
                            </button>
                        </form>

                        {/* List */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                            {licenseTypes.length === 0 ? (
                                <div className="empty-list">No license types created yet</div>
                            ) : (
                                licenseTypes.map(lt => (
                                    <div key={lt.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>{lt.name}</div>
                                            {lt.description && <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>{lt.description}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="card-action-btn edit-btn" onClick={() => { setLicenseTypeForm({ name: lt.name, description: lt.description || '' }); setEditingLicenseTypeId(lt.id); }} title="Edit">✏️</button>
                                            <button className="card-action-btn delete-btn" onClick={() => handleDeleteLicenseType(lt.id)} title="Delete">🗑️</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button className="login-button btn-secondary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setShowLicenseTypesModal(false)}>Close</button>
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

export default DOJLicenses;

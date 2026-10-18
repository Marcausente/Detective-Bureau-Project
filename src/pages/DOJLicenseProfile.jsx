import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function DOJLicenseProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
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
    const [assignForm, setAssignForm] = useState({ license_type_id: '', issued_date: '', expires_date: '' });
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

    // Equipment State
    const [equipment, setEquipment] = useState([]);
    const [equipmentTypes, setEquipmentTypes] = useState([]);
    const [showEquipmentTypesModal, setShowEquipmentTypesModal] = useState(false);
    const [showAssignEquipmentModal, setShowAssignEquipmentModal] = useState(false);
    const [equipmentTypeForm, setEquipmentTypeForm] = useState({ name: '', description: '' });
    const [editingEquipmentTypeId, setEditingEquipmentTypeId] = useState(null);
    const [assignEquipmentForm, setAssignEquipmentForm] = useState({ equipment_type_id: '', issued_date: '', serial_number: '' });

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadProfile(), loadLicenseTypes(), loadEquipmentTypes(), loadEquipment()]);
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

    const loadEquipmentTypes = async () => {
        const { data, error } = await supabase.rpc('get_equipment_types');
        if (error) throw error;
        setEquipmentTypes(data || []);
    };

    const loadEquipment = async () => {
        const { data, error } = await supabase.rpc('get_civilian_equipment', { p_civilian_id: id });
        if (error) throw error;
        setEquipment(data || []);
    };

    // ===== EQUIPMENT HANDLERS =====
    const handleSaveEquipmentType = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('manage_equipment_type', {
                p_action: editingEquipmentTypeId ? 'update' : 'create',
                p_id: editingEquipmentTypeId,
                p_name: equipmentTypeForm.name,
                p_description: equipmentTypeForm.description
            });
            setEquipmentTypeForm({ name: '', description: '' });
            setEditingEquipmentTypeId(null);
            await loadEquipmentTypes();
        } catch (err) {
            alert('Error saving equipment type: ' + err.message);
        }
    };

    const handleDeleteEquipmentType = async (typeId) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar este tipo de equipamiento?' : 'Delete this equipment type? All assignments will be removed.')) return;
        try {
            await supabase.rpc('manage_equipment_type', { p_action: 'delete', p_id: typeId });
            await loadEquipmentTypes();
        } catch (err) {
            alert('Error deleting equipment type: ' + err.message);
        }
    };

    const handleAssignEquipment = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('assign_equipment', {
                p_civilian_id: id,
                p_equipment_type_id: assignEquipmentForm.equipment_type_id,
                p_issued_date: assignEquipmentForm.issued_date,
                p_serial_number: assignEquipmentForm.serial_number || null
            });
            setShowAssignEquipmentModal(false);
            setAssignEquipmentForm({ equipment_type_id: '', issued_date: '', serial_number: '' });
            await loadEquipment();
        } catch (err) {
            alert('Error assigning equipment: ' + err.message);
        }
    };

    const handleUpdateEquipmentStatus = async (equipId, newStatus) => {
        try {
            await supabase.rpc('update_equipment_status', {
                p_equipment_id: equipId,
                p_status: newStatus,
                p_return_date: null
            });
            await loadEquipment();
        } catch (err) {
            alert('Error updating equipment status: ' + err.message);
        }
    };

    const handleRemoveEquipment = async (equipId) => {
        if (!window.confirm(language === 'es' ? '¿Retirar esta asignación de equipamiento?' : 'Remove this equipment assignment?')) return;
        try {
            await supabase.rpc('remove_equipment', { p_equipment_id: equipId });
            await loadEquipment();
        } catch (err) {
            alert('Error removing equipment: ' + err.message);
        }
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
            let finalImage = editForm.profile_image;
            if (finalImage && finalImage.startsWith('data:')) {
                finalImage = await uploadImageToStorage(finalImage, 'avatars');
            }
            const payload = { ...editForm, profile_image: finalImage };

            await supabase.rpc('update_doj_civilian', {
                p_id: id,
                p_nombre: payload.nombre,
                p_apellido: payload.apellido,
                p_id_number: payload.id_number,
                p_phone_number: payload.phone_number,
                p_profile_image: payload.profile_image,
                p_notes: payload.notes
            });
            setShowEditModal(false);
            loadProfile();
        } catch (err) {
            alert('Error updating profile: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(language === 'es' ? '¿Está seguro de eliminar este expediente civil? Esta acción no se puede deshacer.' : 'Are you sure you want to delete this civilian profile? This action cannot be undone.')) return;
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
                p_issued_date: assignForm.issued_date,
                p_expires_date: assignForm.expires_date || null
            });
            setShowAssignModal(false);
            setAssignForm({ license_type_id: '', issued_date: '', expires_date: '' });
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
        if (!window.confirm(language === 'es' ? '¿Revocar esta licencia? Se eliminará del registro civil.' : 'Revoke this license? This will permanently remove it.')) return;
        try {
            await supabase.rpc('revoke_doj_license', { p_license_id: licenseId });
            loadProfile();
        } catch (err) {
            alert('Error revoking license: ' + err.message);
        }
    };

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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result);
                setEditorOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveCroppedImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setEditForm({ ...editForm, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    if (loading) {
        return (
            <div className="mac-dashboard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#94a3b8' }}>
                <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#8b5cf6', width: '12px', height: '12px', display: 'inline-block', marginBottom: '1rem', borderRadius: '50%' }}></span>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>
                    {language === 'es' ? 'Cargando expediente civil...' : 'Loading Civilian Record...'}
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="mac-dashboard-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <h2 style={{ color: '#ef4444' }}>{language === 'es' ? 'Expediente No Encontrado' : 'Civilian Record Not Found'}</h2>
                <button
                    onClick={() => navigate('/doj/licenses')}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        marginTop: '1rem'
                    }}
                >
                    {language === 'es' ? 'Volver a Licencias' : 'Back to Licenses'}
                </button>
            </div>
        );
    }

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Top Bar Navigation & Actions */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <button
                    type="button"
                    onClick={() => navigate('/doj/licenses')}
                    style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '9999px',
                        padding: '0.35rem 0.85rem',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                    <span>{language === 'es' ? 'Volver a Padrón de Licencias' : 'Back to Licenses Registry'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={openEditModal}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>{language === 'es' ? 'Editar Perfil' : 'Edit Profile'}</span>
                    </button>

                    <button
                        onClick={handleDelete}
                        style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>{language === 'es' ? 'Eliminar' : 'Delete'}</span>
                    </button>
                </div>
            </div>

            {/* Profile Hero Card */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '24px',
                padding: '2rem',
                marginBottom: '2rem',
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                display: 'flex',
                gap: '2rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <img
                    src={profile.profile_image || '/logowebp/anon.webp'}
                    alt={profile.nombre}
                    style={{
                        width: '110px',
                        height: '110px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid rgba(139, 92, 246, 0.5)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}
                />

                <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            color: '#c084fc',
                            background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            padding: '0.2rem 0.75rem',
                            borderRadius: '8px'
                        }}>
                            ID: {profile.id_number}
                        </span>
                        <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#34d399',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.2rem 0.75rem',
                            borderRadius: '9999px'
                        }}>
                            📜 {licenses.length} {language === 'es' ? 'Licencias Registradas' : 'Licenses Active'}
                        </span>
                    </div>

                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0', letterSpacing: '-0.02em' }}>
                        {profile.nombre} {profile.apellido}
                    </h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.86rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                        {profile.phone_number && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>📞 {profile.phone_number}</span>
                            </div>
                        )}
                        <div>
                            <span>{language === 'es' ? 'Expediente aperturado:' : 'Registered on:'} </span>
                            <strong style={{ color: '#cbd5e1' }}>{new Date(profile.created_at).toLocaleDateString()}</strong>
                        </div>
                    </div>
                </div>

                {/* Quick Action Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
                    <button
                        onClick={() => {
                            setAssignForm({ license_type_id: '', issued_date: new Date().toISOString().split('T')[0], expires_date: '' });
                            setShowAssignModal(true);
                        }}
                        style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            border: 'none',
                            color: '#fff',
                            padding: '0.6rem 1.1rem',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>{language === 'es' ? 'Otorgar Licencia' : 'Issue License'}</span>
                    </button>

                    <button
                        onClick={() => {
                            setAssignEquipmentForm({ equipment_type_id: '', issued_date: new Date().toISOString().split('T')[0], serial_number: '' });
                            setShowAssignEquipmentModal(true);
                        }}
                        style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#93c5fd',
                            padding: '0.6rem 1.1rem',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                        <span>{language === 'es' ? 'Asignar Armamento' : 'Assign Weapon'}</span>
                    </button>
                </div>
            </div>

            {/* Notes Section Card */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '1.4rem 1.6rem',
                marginBottom: '2rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {language === 'es' ? 'Observaciones Periciales & Anotaciones Civiles' : 'Civilian Record Notes & Remarks'}
                    </div>
                    {!editingNotes && (
                        <button
                            onClick={() => setEditingNotes(true)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#cbd5e1',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            ✏️ {language === 'es' ? 'Editar Notas' : 'Edit Notes'}
                        </button>
                    )}
                </div>

                {editingNotes ? (
                    <div>
                        <textarea
                            className="mac-form-textarea"
                            rows="4"
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            placeholder={language === 'es' ? "Anotaciones sobre antecedentes, revisiones psicológicas, permisos..." : "Enter observations..."}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button
                                onClick={handleCancelNotes}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.4rem 0.85rem',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleSaveNotes}
                                style={{
                                    background: '#8b5cf6',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '0.4rem 1.1rem',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Guardar' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p style={{ margin: 0, fontSize: '0.88rem', color: profile.notes ? '#cbd5e1' : '#64748b', fontStyle: profile.notes ? 'normal' : 'italic', lineHeight: 1.55 }}>
                        {profile.notes || (language === 'es' ? 'Sin observaciones registradas.' : 'No notes recorded.')}
                    </p>
                )}
            </div>

            {/* Dual Grid: Licenses & Equipment */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
                {/* Licenses Column */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>📜 {language === 'es' ? 'Licencias Habilitadas' : 'Active Licenses'}</span>
                            <span style={{ fontSize: '0.75rem', color: '#c084fc', background: 'rgba(139, 92, 246, 0.15)', padding: '0.15rem 0.55rem', borderRadius: '6px' }}>
                                {licenses.length}
                            </span>
                        </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {licenses.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '2.5rem 1rem',
                                background: 'rgba(15, 23, 42, 0.45)',
                                border: '1px dashed rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                color: '#64748b',
                                fontSize: '0.85rem'
                            }}>
                                {language === 'es' ? 'El ciudadano no posee licencias registradas.' : 'No active licenses registered for this civilian.'}
                            </div>
                        ) : (
                            licenses.map(lic => {
                                const isActive = lic.status === 'Active';
                                return (
                                    <div
                                        key={lic.id}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            backdropFilter: 'blur(16px)',
                                            WebkitBackdropFilter: 'blur(16px)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderLeft: `4px solid ${isActive ? '#8b5cf6' : '#ef4444'}`,
                                            borderRadius: '16px',
                                            padding: '1.25rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                                                {lic.license_type_name}
                                            </h4>
                                            <select
                                                value={lic.status}
                                                onChange={(e) => handleUpdateLicenseStatus(lic.id, e.target.value)}
                                                className="mac-form-select"
                                                style={{ padding: '0.2rem 1.8rem 0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px', width: 'auto' }}
                                            >
                                                <option value="Active">{language === 'es' ? 'Activa / Vigente' : 'Active'}</option>
                                                <option value="Suspended">{language === 'es' ? 'Suspendida' : 'Suspended'}</option>
                                                <option value="Revoked">{language === 'es' ? 'Revocada' : 'Revoked'}</option>
                                                <option value="Expired">{language === 'es' ? 'Expirada' : 'Expired'}</option>
                                            </select>
                                        </div>

                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                            <div>📅 {language === 'es' ? 'Expedida el:' : 'Issued:'} <strong style={{ color: '#cbd5e1' }}>{lic.issued_date}</strong></div>
                                            {lic.expires_date && <div>⏳ {language === 'es' ? 'Vence el:' : 'Expires:'} <strong style={{ color: '#cbd5e1' }}>{lic.expires_date}</strong></div>}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                                            <button
                                                onClick={() => handleRevokeLicense(lic.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#f87171',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️ {language === 'es' ? 'Revocar Licencia' : 'Revoke License'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Equipment Column */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🛡️ {language === 'es' ? 'Armamento & Equipamiento' : 'Registered Equipment'}</span>
                            <span style={{ fontSize: '0.75rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '0.15rem 0.55rem', borderRadius: '6px' }}>
                                {equipment.length}
                            </span>
                        </h3>
                        <button
                            onClick={() => setShowEquipmentTypesModal(true)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#cbd5e1',
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            ⚙️ {language === 'es' ? 'Tipos' : 'Catalog'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {equipment.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '2.5rem 1rem',
                                background: 'rgba(15, 23, 42, 0.45)',
                                border: '1px dashed rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                color: '#64748b',
                                fontSize: '0.85rem'
                            }}>
                                {language === 'es' ? 'Sin armamento o material registrado a este ciudadano.' : 'No weapons or equipment assigned.'}
                            </div>
                        ) : (
                            equipment.map(eq => {
                                const statusColor = eq.status === 'Active' ? '#10b981' : (eq.status === 'Missing' ? '#ef4444' : '#64748b');
                                return (
                                    <div
                                        key={eq.id}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            backdropFilter: 'blur(16px)',
                                            WebkitBackdropFilter: 'blur(16px)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderLeft: `4px solid ${statusColor}`,
                                            borderRadius: '16px',
                                            padding: '1.25rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                                                {eq.equipment_name}
                                            </h4>
                                            <select
                                                value={eq.status}
                                                onChange={(e) => handleUpdateEquipmentStatus(eq.id, e.target.value)}
                                                className="mac-form-select"
                                                style={{ padding: '0.2rem 1.8rem 0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px', width: 'auto' }}
                                            >
                                                <option value="Active">{language === 'es' ? 'En Posesión (Activo)' : 'Active'}</option>
                                                <option value="Missing">{language === 'es' ? 'Extraviado / Sustraído' : 'Missing'}</option>
                                                <option value="Retired">{language === 'es' ? 'Retirado / Custodia' : 'Retired'}</option>
                                            </select>
                                        </div>

                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                            {eq.serial_number && (
                                                <div>
                                                    <span style={{ color: '#64748b' }}>{language === 'es' ? 'Nº de Serie:' : 'Serial Number:'} </span>
                                                    <strong style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{eq.serial_number}</strong>
                                                </div>
                                            )}
                                            <div>📅 {language === 'es' ? 'Asignado el:' : 'Issued on:'} <strong style={{ color: '#cbd5e1' }}>{eq.issued_date}</strong></div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                                            <button
                                                onClick={() => handleRemoveEquipment(eq.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#f87171',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️ {language === 'es' ? 'Retirar Equipamiento' : 'Remove Equipment'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Issue License */}
            {showAssignModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowAssignModal(false)}>
                    <div className="mac-modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                DOJ • ISSUE LICENSE
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowAssignModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                            {language === 'es' ? 'Otorgar Licencia a Ciudadano' : 'Issue New License'}
                        </h2>
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
                            {profile.nombre} {profile.apellido} (ID: {profile.id_number})
                        </p>

                        <form onSubmit={handleAssignLicense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Tipo de Licencia *' : 'License Type *'}</label>
                                <select
                                    required
                                    className="mac-form-select"
                                    value={assignForm.license_type_id}
                                    onChange={(e) => setAssignForm({ ...assignForm, license_type_id: e.target.value })}
                                >
                                    <option value="">{language === 'es' ? '-- Seleccione una licencia --' : '-- Select License --'}</option>
                                    {licenseTypes.map(lt => (
                                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Fecha de Expedición *' : 'Issued Date *'}</label>
                                    <input
                                        type="date"
                                        required
                                        className="mac-form-input"
                                        value={assignForm.issued_date}
                                        onChange={(e) => setAssignForm({ ...assignForm, issued_date: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Fecha de Vencimiento' : 'Expires Date'}</label>
                                    <input
                                        type="date"
                                        className="mac-form-input"
                                        value={assignForm.expires_date}
                                        onChange={(e) => setAssignForm({ ...assignForm, expires_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.25rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Emitir Licencia' : 'Issue License'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Assign Equipment */}
            {showAssignEquipmentModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowAssignEquipmentModal(false)}>
                    <div className="mac-modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                DOJ • ASSIGN EQUIPMENT
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowAssignEquipmentModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                            {language === 'es' ? 'Asignar Armamento o Material' : 'Assign Weapon or Equipment'}
                        </h2>

                        <form onSubmit={handleAssignEquipment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Tipo de Armamento *' : 'Equipment Type *'}</label>
                                <select
                                    required
                                    className="mac-form-select"
                                    value={assignEquipmentForm.equipment_type_id}
                                    onChange={(e) => setAssignEquipmentForm({ ...assignEquipmentForm, equipment_type_id: e.target.value })}
                                >
                                    <option value="">{language === 'es' ? '-- Seleccione modelo --' : '-- Select Equipment --'}</option>
                                    {equipmentTypes.map(et => (
                                        <option key={et.id} value={et.id}>{et.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Nº de Serie (Opcional)' : 'Serial Number'}</label>
                                    <input
                                        className="mac-form-input"
                                        placeholder="SN-XXXXX"
                                        value={assignEquipmentForm.serial_number}
                                        onChange={(e) => setAssignEquipmentForm({ ...assignEquipmentForm, serial_number: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Fecha de Asignación *' : 'Issue Date *'}</label>
                                    <input
                                        type="date"
                                        required
                                        className="mac-form-input"
                                        value={assignEquipmentForm.issued_date}
                                        onChange={(e) => setAssignEquipmentForm({ ...assignEquipmentForm, issued_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.25rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAssignEquipmentModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#2563eb',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Registrar Asignación' : 'Assign Equipment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Edit Civilian Details */}
            {showEditModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowEditModal(false)}>
                    <div className="mac-modal-container" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                DOJ • EDIT PROFILE
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 1.25rem 0' }}>
                            {language === 'es' ? 'Modificar Expediente Civil' : 'Edit Civilian Profile'}
                        </h2>

                        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Nombre *' : 'First Name *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={editForm.nombre}
                                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Apellido *' : 'Last Name *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={editForm.apellido}
                                        onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'ID / DNI *' : 'ID Number *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={editForm.id_number}
                                        onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Teléfono' : 'Phone'}</label>
                                    <input
                                        className="mac-form-input"
                                        value={editForm.phone_number}
                                        onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Fotografía de Perfil' : 'Profile Picture'}</label>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.75rem',
                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    color: '#cbd5e1',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}>
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                    <span>{editForm.profile_image ? (language === 'es' ? 'Foto lista (Clic para cambiar)' : 'Photo Ready (Click to change)') : (language === 'es' ? 'Subir Foto' : 'Upload Photo')}</span>
                                </label>
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.25rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#8b5cf6',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Actualizar Ficha' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Equipment Catalog / Types */}
            {showEquipmentTypesModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowEquipmentTypesModal(false)}>
                    <div className="mac-modal-container" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                DOJ • EQUIPMENT CATALOG
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowEquipmentTypesModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 1rem 0' }}>
                            {language === 'es' ? 'Catálogo de Armamento & Modelos' : 'Equipment Catalog'}
                        </h2>

                        <form onSubmit={handleSaveEquipmentType} style={{ marginBottom: '1.25rem', background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '12px' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Modelo / Nombre *' : 'Equipment Name *'}</label>
                                <input
                                    required
                                    className="mac-form-input"
                                    placeholder={language === 'es' ? "Ej: Glock 19 Gen 5 / 9mm" : "e.g. Pistol 9mm"}
                                    value={equipmentTypeForm.name}
                                    onChange={(e) => setEquipmentTypeForm({ ...equipmentTypeForm, name: e.target.value })}
                                />
                            </div>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Descripción' : 'Description'}</label>
                                <input
                                    className="mac-form-input"
                                    placeholder={language === 'es' ? "Calibre, especificaciones..." : "Caliber, specs..."}
                                    value={equipmentTypeForm.description}
                                    onChange={(e) => setEquipmentTypeForm({ ...equipmentTypeForm, description: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                {editingEquipmentTypeId && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingEquipmentTypeId(null); setEquipmentTypeForm({ name: '', description: '' }); }}
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    style={{
                                        background: '#2563eb',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.4rem 1rem',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {editingEquipmentTypeId ? 'Actualizar' : '+ Añadir Modelo'}
                                </button>
                            </div>
                        </form>

                        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            {equipmentTypes.map(et => (
                                <div
                                    key={et.id}
                                    style={{
                                        padding: '0.65rem 0.85rem',
                                        background: 'rgba(255, 255, 255, 0.04)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.86rem' }}>{et.name}</div>
                                        {et.description && <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{et.description}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <button
                                            onClick={() => {
                                                setEquipmentTypeForm({ name: et.name, description: et.description || '' });
                                                setEditingEquipmentTypeId(et.id);
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEquipmentType(et.id)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowEquipmentTypesModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.45rem 1.1rem',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Cropper Modal */}
            {editorOpen && createPortal(
                <div className="mac-modal-backdrop" style={{ zIndex: 9999999 }}>
                    <div className="mac-modal-container" style={{ maxWidth: '420px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#ffffff' }}>
                            {language === 'es' ? 'Ajustar Fotografía Civil' : 'Adjust Picture'}
                        </h3>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor
                                ref={editorRef}
                                image={imageSrc}
                                width={240}
                                height={240}
                                border={20}
                                borderRadius={120}
                                color={[0, 0, 0, 0.6]}
                                scale={scale}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
                            <span style={{ color: '#94a3b8' }}>-</span>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                style={{ accentColor: '#8b5cf6', width: '200px' }}
                            />
                            <span style={{ color: '#94a3b8' }}>+</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => { setEditorOpen(false); setImageSrc(null); }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCroppedImage}
                                style={{
                                    background: '#8b5cf6',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Aplicar' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default DOJLicenseProfile;

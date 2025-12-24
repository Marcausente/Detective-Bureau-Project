import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import '../index.css';

function Personnel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Auth State
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createMessage, setCreateMessage] = useState(null);

    // Cropper State
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);
    const editorRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        nombre: '',
        apellido: '',
        no_placa: '',
        rango: 'Oficial II',
        rol: 'Ayudante',
        fecha_ingreso: '',
        profile_image: ''
    });

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Get Current User and Role
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('rol')
                    .eq('id', user.id)
                    .single();
                if (profile) setCurrentUserRole(profile.rol);
            }

            // 2. Fetch All Personnel
            const { data, error } = await supabase
                .from('users')
                .select('*');

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Rank Priorities
    const rankPriority = {
        'Capitan': 100,
        'Teniente': 90,
        'Detective III': 80,
        'Detective II': 70,
        'Detective I': 60,
        'Oficial III+': 50,
        'Oficial III': 40,
        'Oficial II': 30
    };

    const getRankPriority = (rank) => rankPriority[rank] || 0;
    const sortUsers = (a, b) => getRankPriority(b.rango) - getRankPriority(a.rango);

    const detectives = users.filter(u => ['Detective I', 'Detective II', 'Detective III'].includes(u.rango)).sort(sortUsers);
    const helpers = users.filter(u => ['Oficial II', 'Oficial III', 'Oficial III+'].includes(u.rango)).sort(sortUsers);
    const command = users.filter(u => ['Capitan', 'Teniente'].includes(u.rango)).sort(sortUsers);

    // --- Actions ---

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageSrc(file);
            setEditorOpen(true);
            // Clear input so same file can be chosen again
            e.target.value = '';
        }
    };

    const handleSaveCroppedImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setFormData({ ...formData, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    const handleCancelCrop = () => {
        setEditorOpen(false);
        setImageSrc(null);
        setScale(1.2);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateMessage(null);

        try {
            // Call the RPC function
            const { data, error } = await supabase.rpc('create_new_personnel', {
                p_email: formData.email,
                p_password: formData.password,
                p_nombre: formData.nombre,
                p_apellido: formData.apellido,
                p_no_placa: formData.no_placa,
                p_rango: formData.rango,
                p_rol: formData.rol,
                p_fecha_ingreso: formData.fecha_ingreso || null,
                p_fecha_ultimo_ascenso: null,
                p_profile_image: formData.profile_image || null
            });

            if (error) throw error;

            setCreateMessage({ type: 'success', text: 'Personnel added successfully!' });

            // Refresh list and close modal after short delay
            setTimeout(() => {
                setShowModal(false);
                setFormData({
                    email: '', password: '', nombre: '', apellido: '', no_placa: '',
                    rango: 'Oficial II', rol: 'Ayudante', fecha_ingreso: '', profile_image: ''
                });
                setCreateMessage(null);
                fetchData();
            }, 1500);

        } catch (err) {
            console.error('Error creating user:', err);
            setCreateMessage({ type: 'error', text: err.message });
        } finally {
            setCreating(false);
        }
    };

    const canAddPersonnel = ['Comisionado', 'Coordinador', 'Administrador'].includes(currentUserRole);

    const UserCard = ({ user }) => (
        <div className="personnel-card">
            <div className="personnel-image-container">
                {user.profile_image ? (
                    <img src={user.profile_image} alt={`${user.nombre} ${user.apellido}`} className="personnel-image" />
                ) : (
                    <div className="personnel-placeholder-image" />
                )}
            </div>
            <div className="personnel-info">
                <div className="personnel-rank">{user.rango}</div>
                <div className="personnel-name">{user.nombre} {user.apellido}</div>
                <div className="personnel-badge">#{user.no_placa || '---'}</div>
            </div>
        </div>
    );

    if (loading && users.length === 0) return <div className="loading-container">Loading Personnel...</div>;

    return (
        <div className="personnel-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Bureau Personnel</h2>
                {canAddPersonnel && (
                    <button
                        className="login-button"
                        style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
                        onClick={() => setShowModal(true)}
                    >
                        + Add Personnel
                    </button>
                )}
            </div>

            {error && <div className="error-message">Error: {error}</div>}

            <div className="personnel-grid">
                {/* Detectives Column */}
                <div className="personnel-column">
                    <h3 className="column-title">Detectives</h3>
                    <div className="personnel-list">
                        {detectives.length > 0 ? detectives.map(u => <UserCard key={u.id} user={u} />) : <div className="empty-list">No detectives found</div>}
                    </div>
                </div>

                {/* Helpers Column */}
                <div className="personnel-column">
                    <h3 className="column-title">Ayudantes</h3>
                    <div className="personnel-list">
                        {helpers.length > 0 ? helpers.map(u => <UserCard key={u.id} user={u} />) : <div className="empty-list">No oficiales found</div>}
                    </div>
                </div>

                {/* Command Column */}
                <div className="personnel-column">
                    <h3 className="column-title">Comisionado</h3>
                    <div className="personnel-list">
                        {command.length > 0 ? command.map(u => <UserCard key={u.id} user={u} />) : <div className="empty-list">No command staff found</div>}
                    </div>
                </div>
            </div>

            {/* Add Personnel Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', textAlign: 'left' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>Add New Personnel</h3>

                        {createMessage && (
                            <div style={{
                                padding: '1rem', marginBottom: '1rem', borderRadius: '8px',
                                backgroundColor: createMessage.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: createMessage.type === 'success' ? '#4ade80' : '#ef4444',
                                border: `1px solid ${createMessage.type === 'success' ? '#4ade80' : '#ef4444'}`
                            }}>
                                {createMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input required type="email" name="email" className="form-input" value={formData.email} onChange={handleInputChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input required type="password" name="password" className="form-input" value={formData.password} onChange={handleInputChange} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input required type="text" name="nombre" className="form-input" value={formData.nombre} onChange={handleInputChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input required type="text" name="apellido" className="form-input" value={formData.apellido} onChange={handleInputChange} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Badge Number</label>
                                <input required type="text" name="no_placa" className="form-input" value={formData.no_placa} onChange={handleInputChange} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Profile Image (Optional)</label>
                                <label className="custom-file-upload">
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} />
                                    {formData.profile_image ? "Image Selected (Click to change)" : "Choose Image"}
                                </label>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Rank</label>
                                <select name="rango" className="form-input custom-select" value={formData.rango} onChange={handleInputChange}>
                                    <option value="Oficial II">Oficial II</option>
                                    <option value="Oficial III">Oficial III</option>
                                    <option value="Oficial III+">Oficial III+</option>
                                    <option value="Detective I">Detective I</option>
                                    <option value="Detective II">Detective II</option>
                                    <option value="Detective III">Detective III</option>
                                    <option value="Teniente">Teniente</option>
                                    <option value="Capitan">Capitan</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select name="rol" className="form-input custom-select" value={formData.rol} onChange={handleInputChange}>
                                    <option value="Externo">Externo</option>
                                    <option value="Ayudante">Ayudante</option>
                                    <option value="Detective">Detective</option>
                                    <option value="Coordinador">Coordinador</option>
                                    <option value="Comisionado">Comisionado</option>
                                    <option value="Administrador">Administrador</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Bureau Entry Date</label>
                                <input required type="date" name="fecha_ingreso" className="form-input" value={formData.fecha_ingreso} onChange={handleInputChange} />
                            </div>

                            <div className="cropper-actions" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)} disabled={creating}>Cancel</button>
                                <button type="submit" className="login-button" disabled={creating}>{creating ? 'Creating...' : 'Create Personnel'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Cropper Modal (Portal) */}
            {editorOpen && createPortal(
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content">
                        <h3>Adjust Profile Picture</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor
                                ref={editorRef}
                                image={imageSrc}
                                width={250}
                                height={250}
                                border={20}
                                borderRadius={125} // Circular mask
                                color={[0, 0, 0, 0.6]} // RGBA
                                scale={scale}
                                rotate={0}
                            />
                        </div>

                        <div className="cropper-controls">
                            <div className="zoom-slider-container">
                                <span>-</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.01"
                                    value={scale}
                                    className="zoom-slider"
                                    onChange={(e) => setScale(parseFloat(e.target.value))}
                                />
                                <span>+</span>
                            </div>

                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={handleCancelCrop}>Cancel</button>
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

export default Personnel;

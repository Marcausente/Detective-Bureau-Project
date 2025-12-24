import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import '../index.css';

function Profile() {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState(null);
    const fileInputRef = useRef(null);
    const editorRef = useRef(null);

    // Cropper State
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        no_placa: '',
        rango: '',
        rol: '',
        profile_image: ''
    });

    const [passwords, setPasswords] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('No user found');

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                setFormData({
                    nombre: data.nombre || '',
                    apellido: data.apellido || '',
                    no_placa: data.no_placa || '',
                    rango: data.rango || '',
                    rol: data.rol || 'Externo',
                    profile_image: data.profile_image || ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    // --- Image Handling ---
    const handleImageClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Check file size (optional check before compression)
            if (file.size > 10000000) { // 10MB limit check
                alert("File is very large, please choose a smaller one or wait for processing.");
            }
            setImageSrc(file);
            setEditorOpen(true);
            // Reset input so same file can be selected again if needed
            event.target.value = '';
        }
    };

    const handleSaveImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();

            // Create a temporary canvas to resize if needed (though AvatarEditor handles sizing, we double ensure max dimensions)
            // But usually getImageScaledToCanvas respects the width/height props.
            // We want high quality output.

            // Convert to Base64 JPEG 0.9 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setFormData({ ...formData, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    const handleCancelImage = () => {
        setEditorOpen(false);
        setImageSrc(null);
        setScale(1.2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Update Profile Data
            const { error: profileError } = await supabase
                .from('users')
                .update({
                    nombre: formData.nombre,
                    apellido: formData.apellido,
                    no_placa: formData.no_placa,
                    rango: formData.rango,
                    profile_image: formData.profile_image,
                    updated_at: new Date()
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Update Password if provided
            if (passwords.newPassword) {
                if (passwords.newPassword !== passwords.confirmPassword) {
                    throw new Error("Passwords do not match");
                }
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: passwords.newPassword
                });
                if (passwordError) throw passwordError;
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            // Reset password fields
            setPasswords({ newPassword: '', confirmPassword: '' });

        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading profile...</div>;

    // Permissions
    const canEditRank = ['Coordinador', 'Comisionado', 'Administrador'].includes(formData.rol);

    return (
        <div className="profile-container">
            <h2 style={{ marginBottom: '2rem' }}>Edit User Profile</h2>

            {message && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: message.type === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                    border: `1px solid ${message.type === 'success' ? '#4ade80' : '#ef4444'}`,
                    borderRadius: '8px',
                    color: message.type === 'success' ? '#4ade80' : '#ef4444'
                }}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="profile-layout">
                {/* Left Column: Form */}
                <div className="profile-form-section">
                    <h3>Personal Information</h3>
                    <div className="form-group">
                        <label className="form-label">First Name</label>
                        <input
                            type="text"
                            className="form-input"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Last Name</label>
                        <input
                            type="text"
                            className="form-input"
                            name="apellido"
                            value={formData.apellido}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Badge Number</label>
                        <input
                            type="text"
                            className="form-input"
                            name="no_placa"
                            value={formData.no_placa}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Rank {canEditRank ? '(Editable)' : '(Locked)'}</label>
                        {canEditRank ? (
                            <select
                                className="form-input"
                                name="rango"
                                value={formData.rango}
                                onChange={handleChange}
                            >
                                <option value="">Select Rank</option>
                                <option value="Oficial II">Oficial II</option>
                                <option value="Oficial III">Oficial III</option>
                                <option value="Oficial III+">Oficial III+</option>
                                <option value="Detective I">Detective I</option>
                                <option value="Detective II">Detective II</option>
                                <option value="Detective III">Detective III</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="form-input"
                                value={formData.rango}
                                disabled
                                style={{ opacity: 0.7, cursor: 'not-allowed' }}
                            />
                        )}
                    </div>

                    <div className="section-divider"></div>

                    <h3>Security</h3>
                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input
                            type="password"
                            className="form-input"
                            name="newPassword"
                            value={passwords.newPassword}
                            onChange={handlePasswordChange}
                            placeholder="Leave blank to keep current"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <input
                            type="password"
                            className="form-input"
                            name="confirmPassword"
                            value={passwords.confirmPassword}
                            onChange={handlePasswordChange}
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={updating}
                        style={{ marginTop: '1rem' }}
                    >
                        {updating ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                {/* Right Column: Image */}
                <div className="profile-image-section">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />

                    <div className="profile-image-uploader" onClick={handleImageClick}>
                        {formData.profile_image ? (
                            <img src={formData.profile_image} alt="Profile" />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'rgba(255,255,255,0.2)' }}>+</div>
                        )}
                        <div className="profile-image-overlay">
                            <span className="image-upload-text">Click to Change</span>
                        </div>
                    </div>

                    <div className="profile-badge-display">
                        <div className="big-badge-number">{formData.no_placa || '---'}</div>
                        <div className="badge-label">OFFICIAL BADGE NUMBER</div>
                    </div>
                </div>
            </form>

            {/* Image Cropper Modal */}
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
                                <button type="button" className="login-button btn-secondary" onClick={handleCancelImage}>Cancel</button>
                                <button type="button" className="login-button" onClick={handleSaveImage}>Save Image</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default Profile;

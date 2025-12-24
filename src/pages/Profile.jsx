import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Profile() {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState(null);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        no_placa: '',
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

    // Image Compression Logic
    const handleImageClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Check file size (optional check before compression)
            if (file.size > 5000000) { // 5MB limit check
                alert("File is too large! compressing...");
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 150;
                    const MAX_HEIGHT = 150;
                    let width = img.width;
                    let height = img.height;

                    // Resize logic
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.6 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    setFormData({ ...formData, profile_image: dataUrl });
                };
            };
            reader.readAsDataURL(file);
        }
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
        </div>
    );
}

export default Profile;

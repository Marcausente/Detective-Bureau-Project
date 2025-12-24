import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Profile() {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        no_placa: '',
        profile_image: ''
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const { error } = await supabase
                .from('users')
                .update({
                    nombre: formData.nombre,
                    apellido: formData.apellido,
                    no_placa: formData.no_placa,
                    profile_image: formData.profile_image,
                    updated_at: new Date()
                })
                .eq('id', user.id);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Profile updated successfully!' });

            // Optional: Force reload to update Sidebar info closely
            // window.location.reload(); 
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading profile...</div>;

    return (
        <div className="profile-container">
            <h2 style={{ marginBottom: '2rem' }}>Edit Profile</h2>

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

            <form onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
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
                    <label className="form-label">Profile Image URL</label>
                    <input
                        type="text"
                        className="form-input"
                        name="profile_image"
                        value={formData.profile_image}
                        onChange={handleChange}
                        placeholder="https://example.com/avatar.png"
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
            </form>
        </div>
    );
}

export default Profile;

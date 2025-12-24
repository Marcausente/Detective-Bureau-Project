import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function Welcome() {
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/');
                return;
            }

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                navigate('/dashboard'); // Fallback
            } else {
                setProfile(data);
                // Redirect after delay
                setTimeout(() => {
                    navigate('/dashboard');
                }, 4000); // 4 seconds total welcome time
            }
        };

        fetchProfile();
    }, [navigate]);

    if (!profile) return null; // Or a loading spinner

    return (
        <div className="welcome-container">
            <div className="welcome-content">
                <div className="welcome-avatar">
                    {profile.profile_image ? (
                        <img src={profile.profile_image} alt="Profile" />
                    ) : (
                        // Fallback avatar using initial
                        <div className="welcome-initial">{profile.nombre[0]}</div>
                    )}
                </div>

                <h1 className="welcome-title fade-in-1">WELCOME</h1>
                <h2 className="welcome-subtitle fade-in-2">
                    {profile.rango} {profile.nombre} {profile.apellido}
                </h2>
                <div className="welcome-line expand-line"></div>
            </div>
        </div>
    );
}

export default Welcome;

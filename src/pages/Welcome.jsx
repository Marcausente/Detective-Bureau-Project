import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getProfileImage } from '../utils/imageStorage';
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
                
                // Determine target route based on division & rank
                let targetRoute = '/dashboard';
                const div = data.divisions || [];
                const rank = data.rango || '';
                const isDB = div.includes('Detective Bureau');

                if (rank === 'SEB Agent' || (div.includes('SEB') && !isDB)) {
                    targetRoute = '/seb';
                } else if (rank === 'Internal Affairs Agent' || (div.includes('Internal Affairs') && !isDB)) {
                    targetRoute = '/internal-affairs';
                } else if (rank === 'Department of Justice Agent' || (div.includes('DOJ') && !isDB)) {
                    targetRoute = '/doj';
                }

                // Redirect after delay
                setTimeout(() => {
                    navigate(targetRoute);
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
                    {getProfileImage(profile.profile_image) ? (
                        <img src={getProfileImage(profile.profile_image)} alt="Profile" />
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

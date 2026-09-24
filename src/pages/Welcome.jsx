import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

function Welcome() {
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            try {
                // Get active session
                const { data: { session } } = await supabase.auth.getSession();
                let currentUser = session?.user;

                if (!currentUser) {
                    const { data: userData } = await supabase.auth.getUser();
                    currentUser = userData?.user;
                }

                if (!currentUser) {
                    if (isMounted) navigate('/');
                    return;
                }

                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();

                if (error || !data) {
                    console.error('Error fetching profile:', error);
                    if (isMounted) navigate('/dashboard'); // Direct fallback without hanging
                } else if (isMounted) {
                    setProfile(data);
                    
                    // Determine target route based on division & rank
                    let targetRoute = '/dashboard';
                    const div = data.divisions || [];
                    const rank = data.rango || '';
                    const isDB = div.includes('Detective Bureau');

                    if (rank === 'SEB Agent' || (div.includes('SEB') && !isDB)) {
                        targetRoute = '/seb';
                    } else if (rank === 'ASD Agent' || (div.includes('ASD') && !isDB)) {
                        targetRoute = '/air-support';
                    } else if (rank === 'Internal Affairs Agent' || (div.includes('Internal Affairs') && !isDB)) {
                        targetRoute = '/internal-affairs';
                    } else if (rank === 'Department of Justice Agent' || (div.includes('DOJ') && !isDB)) {
                        targetRoute = '/doj';
                    }

                    // Redirect after 2.5s
                    setTimeout(() => {
                        if (isMounted) navigate(targetRoute);
                    }, 2500);
                }
            } catch (err) {
                console.error('Unexpected error in welcome screen:', err);
                if (isMounted) navigate('/dashboard');
            }
        };

        fetchProfile();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    return (
        <div className="welcome-container">
            <div className="welcome-content">
                <div className="welcome-avatar">
                    {profile && getProfileImage(profile.profile_image) ? (
                        <img src={getProfileImage(profile.profile_image)} alt="Profile" />
                    ) : (
                        <div className="welcome-initial">{profile?.nombre?.[0] || '★'}</div>
                    )}
                </div>

                <h1 className="welcome-title fade-in-1">WELCOME</h1>
                <h2 className="welcome-subtitle fade-in-2">
                    {profile ? `${profile.rango || ''} ${profile.nombre || ''} ${profile.apellido || ''}` : 'Iniciando sesión...'}
                </h2>
                <div className="welcome-line expand-line"></div>
            </div>
        </div>
    );
}

export default Welcome;

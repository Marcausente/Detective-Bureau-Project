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
                    
                    // Determine target route based on exact division & role rules
                    let targetRoute = '/personnel';
                    const div = Array.isArray(data.divisions) ? data.divisions : [];
                    const sub = Array.isArray(data.subdivisions) ? data.subdivisions : [];
                    const userRoleLower = (data.rol || '').trim().toLowerCase();
                    const isAdmin = userRoleLower === 'administrador' || userRoleLower === 'superadmin';

                    const isDB = isAdmin || div.includes('Detective Bureau');
                    const hasComandancia = isAdmin || div.includes('Comandancia') || sub.includes('Comandancia');
                    const hasIA = isAdmin || div.includes('Internal Affairs') || sub.includes('Internal Affairs');
                    const hasSEB = isAdmin || div.includes('SEB') || sub.includes('SEB');
                    const hasASD = isAdmin || div.includes('ASD') || sub.includes('ASD');
                    const hasDOJ = isAdmin || div.includes('DOJ') || sub.includes('DOJ');
                    const hasTraining = isAdmin || isDB || div.includes('DTP') || sub.includes('DTP');
                    const hasCoord = ['coordinador', 'coordinacion', 'coordinación', 'comisionado', 'administrador', 'superadmin'].includes(userRoleLower);

                    if (isDB) {
                        targetRoute = '/dashboard';
                    } else if (hasComandancia) {
                        targetRoute = '/comandancia';
                    } else if (hasIA) {
                        targetRoute = '/internal-affairs';
                    } else if (hasSEB) {
                        targetRoute = '/seb';
                    } else if (hasASD) {
                        targetRoute = '/air-support';
                    } else if (hasDOJ) {
                        targetRoute = '/doj';
                    } else if (hasTraining) {
                        targetRoute = '/training';
                    } else if (hasCoord) {
                        targetRoute = '/coordination';
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

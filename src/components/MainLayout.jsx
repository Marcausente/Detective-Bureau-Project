import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function MainLayout() {
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let mounted = true;

        const getProfile = async (session) => {
            if (!session?.user) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error('Error fetching profile:', error);
                } else if (mounted) {
                    setProfile(data);
                }
            } catch (err) {
                console.error("Profile load error:", err);
            }
        };

        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                navigate('/');
            } else {
                getProfile(session);
            }
        });

        // Listen for changes
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                navigate('/');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                getProfile(session);
            }
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []); // Empty dependency to run once

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const allNavItems = [
        { name: 'Dashboard', path: '/dashboard', divisions: ['Detective Bureau'] },
        { name: 'Documentation', path: '/documentation', divisions: ['Detective Bureau'] },
        { name: 'Criminal Cases', path: '/cases', divisions: ['Detective Bureau'] },
        { name: 'Gangs', path: '/gangs', divisions: ['Detective Bureau'] },
        { name: 'Incidents', path: '/incidents', divisions: ['Detective Bureau'] },
        { name: 'Crime Map', path: '/crimemap', divisions: ['Detective Bureau'] },
        { name: 'Judicial Orders', path: '/warrants', divisions: ['Detective Bureau'] },
        { name: 'Interrogations', path: '/interrogations', divisions: ['Detective Bureau'] },
        { name: 'Personnel', path: '/personnel', divisions: ['Detective Bureau', 'Internal Affairs', 'DOJ'] },
        { name: 'Internal Affairs', path: '/internal-affairs', divisions: ['Internal Affairs'] },
        { name: 'Department of Justice', path: '/doj', divisions: ['DOJ'] },
    ];

    const navItems = allNavItems.filter(item => {
        if (!profile) return false;
        // Administrator Bypass
        if (profile.rol === 'Administrador') return true;

        if (!profile.divisions) return false;
        // Check if user has AT LEAST ONE of the required divisions for this item
        return item.divisions.some(div => profile.divisions.includes(div));
    });

    return (
        <div className="layout-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/LOGO_SAPD.png" alt="SAPD" className="sidebar-logo" />
                    <div className="sidebar-title">DETECTIVE BUREAU</div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {profile && (
                        <div className="user-profile-summary">
                            <div className="user-avatar-small">
                                {profile.profile_image ? (
                                    <img src={profile.profile_image} alt="Profile" />
                                ) : (
                                    <img src="/anon.png" alt="Profile" />
                                )}
                            </div>
                            <div className="user-info">
                                <div className="user-name">{profile.rango} {profile.nombre} {profile.apellido}</div>
                                <div className="user-badge">Badge #{profile.no_placa}</div>
                            </div>
                        </div>
                    )}
                    <div className="sidebar-actions">
                        <button onClick={() => navigate('/profile')} className="action-btn">Edit Profile</button>
                        <button onClick={handleLogout} className="action-btn logout">Logout</button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="layout-content">
                <header className="content-header">
                    {/* Breadcrumbs or Page Title could go here */}
                    <h2 className="page-title">{navItems.find(i => i.path === location.pathname)?.name || 'Detective Bureau'}</h2>
                </header>
                <div className="content-body">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default MainLayout;

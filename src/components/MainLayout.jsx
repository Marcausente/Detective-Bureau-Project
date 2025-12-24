import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function MainLayout() {
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

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
            } else {
                setProfile(data);
            }
        };

        fetchProfile();
    }, [navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const navItems = [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Documentation', path: '/documentation' },
        { name: 'Criminal Cases', path: '/cases' },
        { name: 'Gangs', path: '/gangs' },
        { name: 'Interrogations', path: '/interrogations' },
        { name: 'Personnel', path: '/personnel' },
    ];

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
                                {/* Placeholder for now if no image */}
                                {profile.profile_image ? <img src={profile.profile_image} alt="Profile" /> : profile.nombre[0]}
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

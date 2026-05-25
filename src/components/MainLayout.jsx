import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function MainLayout() {
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { isLSSD } = useTheme();
    const { t } = useLanguage();

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

    useEffect(() => {
        if (profile && profile.rol === 'Externo') {
            const allowedPaths = ['/cases', '/profile'];
            const isAllowed = allowedPaths.includes(location.pathname) || location.pathname.startsWith('/cases/');
            
            if (!isAllowed) {
                navigate('/cases');
            }
        }
    }, [profile, location.pathname, navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const allNavItems = [
        { name: t('dashboard'), path: '/dashboard', divisions: ['Detective Bureau'] },
        { name: t('documentation'), path: '/documentation', divisions: ['Detective Bureau'] },
        { name: t('criminalCases'), path: '/cases', divisions: ['Detective Bureau'] },
        { name: isLSSD ? t('gangUnit') : t('gangs'), path: '/gangs', divisions: ['Detective Bureau'] },
        { name: t('incidents'), path: '/incidents', divisions: ['Detective Bureau'] },
        { name: t('crimeMap'), path: '/crimemap', divisions: ['Detective Bureau'] },
        { name: t('judicialOrders'), path: '/warrants', divisions: ['Detective Bureau'] },
        { name: t('interrogations'), path: '/interrogations', divisions: ['Detective Bureau'] },
        { name: t('trainingProgram'), path: '/training', divisions: ['Detective Bureau'], roles: ['detective', 'coordinador'] },
        { name: t('personnel'), path: '/personnel', divisions: ['Detective Bureau', 'Internal Affairs', 'DOJ'] },
        { name: t('internalAffairs'), path: '/internal-affairs', divisions: ['Internal Affairs'] },
        { name: t('doj'), path: '/doj', divisions: ['DOJ'] },
        { name: t('adminPanel'), path: '/admin', divisions: ['SysAdmin'] }, // Only accessible via Administrator bypass
    ];

    const navItems = allNavItems.filter(item => {
        if (!profile) return false;
        // Administrator Bypass
        if (profile.rol === 'Administrador' || profile.rol === 'superadmin') return true;

        // Invitado restriction (mapped to Externo in DB)
        if (profile.rol === 'Externo') {
            return item.path === '/cases';
        }

        if (!profile.divisions) return false;
        
        // Filter by role if the item specifies exact roles
        if (item.roles) {
            const userRole = profile.rol ? profile.rol.toLowerCase() : '';
            const hasRole = item.roles.some(r => r.toLowerCase() === userRole);
            if (!hasRole) return false;
        }

        // Check if user has AT LEAST ONE of the required divisions for this item
        return item.divisions.some(div => profile.divisions.includes(div));
    });

    return (
        <div className="layout-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src={isLSSD ? "/lssd/SCUB.png" : "/LOGO_SAPD.png"} alt={isLSSD ? "SCUB" : "SAPD"} className="sidebar-logo" />
                    <div className="sidebar-title">{isLSSD ? t('scub') : t('detectiveBureau')}</div>
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
                                <div className="user-badge">{t('badge')}{profile.no_placa}</div>
                            </div>
                        </div>
                    )}
                    <div className="sidebar-actions">
                        <button onClick={() => navigate('/profile')} className="action-btn">{t('editProfile')}</button>
                        <button onClick={handleLogout} className="action-btn logout">{t('logout')}</button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="layout-content">
                <header className="content-header">
                    {/* Breadcrumbs or Page Title could go here */}
                    <h2 className="page-title">{navItems.find(i => i.path === location.pathname)?.name || (isLSSD ? t('scub') : t('detectiveBureau'))}</h2>
                </header>
                <div className="content-body">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default MainLayout;

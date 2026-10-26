import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getProfileImage } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import MinesweeperModal from './MinesweeperModal';
import SnakeModal from './SnakeModal';
import SpotlightModal from './SpotlightModal';
import '../index.css';

const getNavIcon = (path) => {
    switch (path) {
        case '/dashboard':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
            );
        case '/documentation':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
            );
        case '/cases':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
            );
        case '/gangs':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            );
        case '/incidents':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            );
        case '/complaints':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
            );
        case '/crimemap':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
            );
        case '/warrants':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
                    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
                    <path d="M7 21h10" />
                    <path d="M12 3v18" />
                    <path d="M3 7h18" />
                </svg>
            );
        case '/interrogations':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
            );
        case '/ballistics':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                </svg>
            );
        case '/personnel':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            );
        case '/training':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
            );
        case '/internal-affairs':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            );
        case '/doj':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                </svg>
            );
        case '/coordination':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            );
        case '/admin':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            );
        case '/air-support':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M4 6h16M12 6c-3 0-5 2-5 5v3h10v-3c0-3-2-5-5-5zM8 17l-4 3M16 17l4 3M6 21h12" />
                </svg>
            );
        case '/undercover':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12h20" />
                    <path d="M20 12v8H4v-8" />
                    <circle cx="8" cy="16" r="2" />
                    <circle cx="16" cy="16" r="2" />
                    <path d="M12 2a4 4 0 0 0-4 4v3h8V6a4 4 0 0 0-4-4z" />
                </svg>
            );
        default:
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                </svg>
            );
    }
};

const getShortLabel = (path, fullName, branding = {}, isLSSD = false) => {
    switch (path) {
        case '/dashboard': return 'Inicio';
        case '/documentation': return 'Documentos';
        case '/cases': return 'Casos';
        case '/gangs': return branding?.gangs_nav_label || (isLSSD ? 'Gang Unit' : 'Bandas');
        case '/incidents': return 'Incidentes';
        case '/complaints': return 'Denuncias';
        case '/crimemap': return 'Mapa';
        case '/warrants': return branding?.orders_nav_label || 'Órdenes';
        case '/interrogations': return 'Interrogatorios';
        case '/ballistics': return 'Balística';
        case '/personnel': return 'Personal';
        case '/training': return branding?.training_nav_label || 'Formación';
        case '/internal-affairs': return branding?.ia_nav_label || 'Asuntos Internos';
        case '/internal-affairs/publicacion-faltas': return `Publicación Faltas (${branding?.ia_nav_label || 'IA'})`;
        case '/internal-affairs/configuracion': return `Configuración (${branding?.ia_nav_label || 'IA'})`;
        case '/doj': return 'DOJ';
        case '/seb': return branding?.seb_nav_label || 'SEB';
        case '/air-support': return branding?.asd_nav_label || 'Air Support';
        case '/undercover': return branding?.undercover_nav_label || 'Undercover';
        case '/coordination': return branding?.coordination_nav_label || 'Coordinación';
        case '/admin': return 'Panel Admin';
        default: return fullName;
    }
};

function MainLayout() {
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { isLSSD, branding } = useTheme();
    const { t } = useLanguage();

    const [activeGame, setActiveGame] = useState(null);
    const [logoClicks, setLogoClicks] = useState(0);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showSpotlight, setShowSpotlight] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);

    useEffect(() => {
        let timeoutId = null;
        const handleResize = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setWindowWidth(window.innerWidth);
            }, 100);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Global Cmd+K / Ctrl+K keyboard shortcut listener for Spotlight Search
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowSpotlight(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (logoClicks > 0) {
            const timer = setTimeout(() => setLogoClicks(0), 3000);
            return () => clearTimeout(timer);
        }
    }, [logoClicks]);

    const handleLogoClick = () => {
        setLogoClicks(prev => {
            const next = prev + 1;
            if (next >= 5) {
                setActiveGame('minesweeper');
                return 0;
            }
            return next;
        });
    };

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

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                navigate('/');
            } else {
                getProfile(session);
            }
        });

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
    }, []);

    // Role & Division Access Calculation based on exact user specification:
    // - Detective Bureau (dashboard, docs, cases, gangs, incidents, complaints, crimemap, interrogations, ballistics): EXCLUSIVE to 'Detective Bureau' division
    // - Warrants: DOJ or Detective Bureau division
    // - Internal Affairs: ONLY 'Internal Affairs' division
    // - Comandancia: ONLY 'Comandancia' division
    // - Training: Detective Bureau division OR 'DTP' division/subdivision
    // - Air Support: 'ASD' division
    // - SEB: 'SEB' division
    // - Coordination: role 'Coordinador' / 'Coordinación', 'Administrador' or 'Comisionado'
    // - Admin Panel: ONLY role 'Administrador'
    // Role & Division Access Calculation based on exact user specifications:
    // - Administrador: Sees EVERYTHING (including Admin Panel)
    // - Comisionado: Sees EVERYTHING EXCEPT Admin Panel
    // - Coordinador: Sees everything EXCEPT Asuntos Internos, DOJ, SEB, Air Support, and Comandancia (which require the corresponding divisions), and NO Admin Panel
    // - Regular users: Require the corresponding division for each specific module
    const userRole = (profile?.rol || '').trim();
    const userRoleLower = userRole.toLowerCase();
    const isAdmin = userRoleLower === 'administrador' || userRoleLower === 'superadmin';
    const isComisionado = userRoleLower === 'comisionado';
    const isCoordinador = ['coordinador', 'coordinacion', 'coordinación'].includes(userRoleLower);

    const userDivisions = Array.isArray(profile?.divisions) ? profile.divisions : [];
    const userSubdivisions = Array.isArray(profile?.subdivisions) ? profile.subdivisions : [];

    const hasDBDivision = userDivisions.includes('Detective Bureau');
    const hasDBAccess = isAdmin || isComisionado || isCoordinador || hasDBDivision;

    const hasDOJDivision = userDivisions.includes('DOJ') || userSubdivisions.includes('DOJ');
    const hasDOJAccess = isAdmin || isComisionado || hasDOJDivision;

    const hasWarrantsAccess = isAdmin || isComisionado || isCoordinador || hasDBDivision || hasDOJDivision;

    const hasIADivision = userDivisions.includes('Internal Affairs') || userSubdivisions.includes('Internal Affairs');
    const hasIAAccess = isAdmin || isComisionado || hasIADivision;

    const hasComandanciaDivision = userDivisions.includes('Comandancia') || userSubdivisions.includes('Comandancia');
    const userRankLower = (profile?.rango || '').trim().toLowerCase();
    const isSargento = userRankLower.includes('sargento') || userRankLower.includes('sergeant') || userRoleLower.includes('sargento');
    const hasComandanciaAccess = isAdmin || isComisionado || hasComandanciaDivision;
    const hasSanctionsAccess = hasIAAccess || hasComandanciaAccess || isSargento;

    const hasDTPAccess = userDivisions.includes('DTP') || userSubdivisions.includes('DTP');
    const hasTrainingAccess = isAdmin || isComisionado || isCoordinador || hasDBDivision || hasDTPAccess;

    const hasASDDivision = userDivisions.includes('ASD') || userSubdivisions.includes('ASD') || userRoleLower === 'coordinador asd';
    const hasASDAccess = isAdmin || isComisionado || hasASDDivision;

    const hasSEBDivision = userDivisions.includes('SEB') || userSubdivisions.includes('SEB') || ['coordinador swat/seb', 'coordinador seb'].includes(userRoleLower);
    const hasSEBAccess = isAdmin || isComisionado || hasSEBDivision;

    const hasCoordinationAccess = isAdmin || isComisionado || isCoordinador;
    const hasAdminPanelAccess = isAdmin;
    const hasUDAccess = isAdmin || isComisionado || isCoordinador || userDivisions.some(d => ['Undercover', 'Undercover Division', 'UD'].includes(d)) || userSubdivisions.some(d => ['Undercover', 'Undercover Division', 'UD'].includes(d));

    const isPathAllowed = (pathname) => {
        if (!profile) return false;

        // Rol Externo
        if (userRole === 'Externo') {
            return pathname === '/cases' || pathname.startsWith('/cases/') || pathname === '/interrogations' || pathname === '/profile';
        }

        // Rutas comunes
        if (pathname === '/profile' || pathname.startsWith('/personnel')) {
            return true;
        }

        // Panel Admin: SOLO rol administrador
        if (pathname.startsWith('/admin')) {
            return hasAdminPanelAccess;
        }

        // Coordinación: rol coordinación, comisionado o administrador
        if (pathname.startsWith('/coordination')) {
            return hasCoordinationAccess;
        }

        // Comandancia: SOLO división comandancia
        if (pathname.startsWith('/comandancia')) {
            return hasComandanciaAccess;
        }

        // Apartado de Sanciones: Accesible para Asuntos Internos, Comandancia y Sargentos
        if (pathname.startsWith('/internal-affairs/sanctions')) {
            return hasSanctionsAccess;
        }

        // Asuntos Internos: Resto de módulos SOLO división asuntos internos
        if (pathname.startsWith('/internal-affairs')) {
            return hasIAAccess;
        }

        // SEB: división SEB
        if (pathname.startsWith('/seb')) {
            return hasSEBAccess;
        }

        // Air Support: división ASD
        if (pathname.startsWith('/air-support') || pathname === '/asd') {
            return hasASDAccess;
        }

        // DOJ: división DOJ
        if (pathname.startsWith('/doj')) {
            return hasDOJAccess;
        }

        // Órdenes: división DOJ o Detective Bureau
        if (pathname.startsWith('/warrants')) {
            return hasWarrantsAccess;
        }

        // Formación: Detective Bureau o DTP
        if (pathname.startsWith('/training')) {
            return hasTrainingAccess;
        }

        // Undercover: división Undercover
        if (pathname.startsWith('/undercover')) {
            return hasUDAccess;
        }

        // Módulos EXCLUSIVOS de Detective Bureau:
        // Inicio (/dashboard), Documentos (/documentation), Casos (/cases, /cases/:id), Bandas (/gangs),
        // Incidentes (/incidents), Denuncias (/complaints), Mapa (/crimemap), Interrogatorios (/interrogations), Balística (/ballistics)
        const dbPaths = [
            '/dashboard',
            '/documentation',
            '/cases',
            '/gangs',
            '/incidents',
            '/complaints',
            '/crimemap',
            '/interrogations',
            '/ballistics'
        ];

        if (dbPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
            return hasDBAccess;
        }

        return false;
    };

    useEffect(() => {
        if (!profile) return;

        if (!isPathAllowed(location.pathname)) {
            if (hasDBAccess) {
                navigate('/dashboard');
            } else if (hasComandanciaAccess) {
                navigate('/comandancia');
            } else if (hasIAAccess) {
                navigate('/internal-affairs');
            } else if (hasSEBAccess) {
                navigate('/seb');
            } else if (hasASDAccess) {
                navigate('/air-support');
            } else if (hasDOJAccess) {
                navigate('/doj');
            } else if (hasWarrantsAccess) {
                navigate('/warrants');
            } else if (hasTrainingAccess) {
                navigate('/training');
            } else if (hasCoordinationAccess) {
                navigate('/coordination');
            } else if (hasUDAccess) {
                navigate('/undercover');
            } else {
                navigate('/personnel');
            }
        }
    }, [profile, location.pathname, navigate, hasDBAccess, hasComandanciaAccess, hasIAAccess, hasSEBAccess, hasASDAccess, hasDOJAccess, hasWarrantsAccess, hasTrainingAccess, hasCoordinationAccess, hasUDAccess]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const allNavItems = [
        { name: t('dashboard'), path: '/dashboard' },
        { name: t('documentation'), path: '/documentation' },
        { name: t('criminalCases'), path: '/cases' },
        { name: isLSSD ? t('gangUnit') : t('gangs'), path: '/gangs' },
        { name: t('incidents'), path: '/incidents' },
        { name: t('complaints'), path: '/complaints' },
        { name: t('crimeMap'), path: '/crimemap' },
        { name: t('interrogations'), path: '/interrogations' },
        { name: t('ballistics'), path: '/ballistics' },
        { name: branding?.orders_nav_label || t('judicialOrders'), path: '/warrants' },
        { name: branding?.training_nav_label || t('trainingProgram'), path: '/training' },
        { name: t('personnel'), path: '/personnel' },
        { name: t('internalAffairs'), path: '/internal-affairs' },
        { name: t('doj'), path: '/doj' },
        { name: t('seb'), path: '/seb' },
        { name: t('airSupport') || 'Air Support', path: '/air-support' },
        { name: t('undercover') || 'Undercover', path: '/undercover' },
        { name: branding?.coordination_nav_label || t('coordination'), path: '/coordination' },
        { name: t('comandancia') || 'Comandancia', path: '/comandancia' },
        { name: t('adminPanel'), path: '/admin' },
    ];

    const navItems = allNavItems.filter(item => {
        return isPathAllowed(item.path);
    });

    const getResponsiveMaxPrimary = (width) => {
        if (width >= 1550) return 10;
        if (width >= 1380) return 9;
        if (width >= 1180) return 8;
        if (width >= 950) return 6;
        return 4;
    };

    const maxPrimary = getResponsiveMaxPrimary(windowWidth);

    // Force items into "Más ▾" in exact order, keeping user's primary/assigned divisions visible directly in the dock
    const forcedMorePaths = [
        '/warrants',
        '/training',
        ...(hasIAAccess && !hasDBAccess ? [] : ['/internal-affairs']),
        ...(hasDOJAccess && !hasDBAccess ? [] : ['/doj']),
        ...(hasASDAccess && !hasDBAccess ? [] : ['/air-support']),
        ...(hasSEBAccess && !hasDBAccess ? [] : ['/seb']),
        ...(hasComandanciaAccess && !hasDBAccess ? [] : ['/comandancia']),
        '/undercover',
        '/coordination',
        '/admin'
    ];

    const forcedMoreItems = navItems.filter(item => forcedMorePaths.includes(item.path));
    const eligiblePrimaryItems = navItems.filter(item => !forcedMorePaths.includes(item.path));

    const primaryItems = eligiblePrimaryItems.slice(0, maxPrimary);
    const overflowPrimaryItems = eligiblePrimaryItems.slice(maxPrimary);

    const moreItems = [...overflowPrimaryItems, ...forcedMoreItems];

    const activeMoreItem = moreItems.find(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));
    const isMoreActive = Boolean(activeMoreItem);

    const isRouteActive = (itemPath) => {
        if (location.pathname === itemPath) return true;
        if (location.pathname.startsWith(itemPath + '/')) return true;
        return false;
    };

    return (
        <div className="layout-container mac-app-shell">
            {/* macOS Top Navigation Toolbar Header */}
            <header className="mac-topbar-header">
                <div className="mac-topbar-left">
                    <div className="mac-window-dots">
                        <div
                            className="mac-window-dot close"
                            onClick={handleLogout}
                            title={`${t('logout')} (Salir del Sistema)`}
                            style={{ cursor: 'pointer' }}
                        ></div>
                        <div className="mac-window-dot min"></div>
                        <div className="mac-window-dot max"></div>
                    </div>
                    <img
                        src={branding?.topbar_logo || (isLSSD ? "/logowebp/SCUB.webp" : "/logowebp/LSSDlogo.webp")}
                        alt={branding?.topbar_name || (isLSSD ? "SCUB" : "SAPD")}
                        className="mac-topbar-logo"
                        onClick={handleLogoClick}
                        style={{ cursor: 'pointer' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = isLSSD ? "/logowebp/SCUB.webp" : "/logowebp/LSSDlogo.webp";
                        }}
                    />
                    <span className="mac-topbar-brand">{branding?.topbar_name || (isLSSD ? t('scub') : t('detectiveBureau'))}</span>
                </div>

                {/* Center macOS Floating Navigation Dock (100% Perfectly Centered) */}
                <nav className="mac-nav-dock">
                    {primaryItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`mac-dock-item ${isRouteActive(item.path) ? 'active' : ''}`}
                            title={item.name}
                            onClick={() => setShowMoreMenu(false)}
                        >
                            <span className="mac-dock-icon">{getNavIcon(item.path)}</span>
                            <span className="mac-dock-label">{getShortLabel(item.path, item.name, branding, isLSSD)}</span>
                        </Link>
                    ))}

                    {moreItems.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className={`mac-dock-item ${isMoreActive || showMoreMenu ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowMoreMenu(prev => !prev);
                                }}
                                style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                            >
                                <span className="mac-dock-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="1" />
                                        <circle cx="19" cy="12" r="1" />
                                        <circle cx="5" cy="12" r="1" />
                                    </svg>
                                </span>
                                <span className="mac-dock-label">
                                    {isMoreActive && activeMoreItem ? getShortLabel(activeMoreItem.path, activeMoreItem.name, branding, isLSSD) : 'Más'} ▾
                                </span>
                            </button>

                            {showMoreMenu && (
                                <>
                                    <div
                                        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99998 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMoreMenu(false);
                                        }}
                                    />
                                    <div className="mac-popover-menu">
                                        {moreItems.map(item => (
                                            <Link
                                                key={item.path}
                                                to={item.path}
                                                className={`mac-popover-item ${isRouteActive(item.path) ? 'active' : ''}`}
                                                onClick={() => setShowMoreMenu(false)}
                                            >
                                                <span className="mac-dock-icon">{getNavIcon(item.path)}</span>
                                                <span>{getShortLabel(item.path, item.name, branding, isLSSD)}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </nav>

                {/* Right macOS User Profile Chip & Spotlight Trigger */}
                <div className="mac-topbar-right">
                    {/* macOS Spotlight Search Trigger Button */}
                    <button
                        className="mac-spotlight-trigger-btn"
                        onClick={() => setShowSpotlight(true)}
                        title="Buscar (⌘K / Ctrl+K)"
                    >
                        <span className="mac-spotlight-key-badge">⌘K</span>
                        <span className="mac-spotlight-text">Buscar</span>
                    </button>

                    {profile && (
                        <div
                            className="mac-user-chip"
                            onClick={() => navigate('/profile')}
                            title={t('editProfile')}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="mac-user-avatar">
                                {getProfileImage(profile.profile_image) ? (
                                    <img src={getProfileImage(profile.profile_image)} alt="Profile" />
                                ) : (
                                    <img src="/logowebp/anon.webp" alt="Profile" />
                                )}
                            </div>
                            <div className="mac-user-details">
                                <span className="mac-user-name">{profile.rango} {profile.apellido}</span>
                                <span className="mac-user-badge">
                                    #{profile.no_placa}
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveGame('minesweeper');
                                        }}
                                        style={{
                                            opacity: 0.25,
                                            cursor: 'pointer',
                                            marginLeft: '6px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            transition: 'opacity 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = 0.8}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.25}
                                        title="Minijuegos Secretos"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="6" width="20" height="12" rx="4" />
                                            <path d="M6 12h4m-2-2v4" />
                                            <circle cx="15" cy="11" r="1" fill="currentColor" />
                                            <circle cx="18" cy="13" r="1" fill="currentColor" />
                                        </svg>
                                    </span>
                                </span>
                            </div>
                        </div>
                    )}
                    <button onClick={() => navigate('/profile')} className="mac-icon-action-btn" title={t('editProfile')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main Content Body Area */}
            <main className="layout-content mac-layout-body">
                <div className="content-body">
                    <Outlet />
                </div>
            </main>

            {/* macOS Spotlight Command Palette Modal */}
            <SpotlightModal
                isOpen={showSpotlight}
                onClose={() => setShowSpotlight(false)}
                navItems={navItems}
                handleLogout={handleLogout}
            />

            {activeGame === 'minesweeper' && (
                <MinesweeperModal
                    onClose={() => setActiveGame(null)}
                    profile={profile}
                    onSwitchGame={(game) => setActiveGame(game)}
                />
            )}
            {activeGame === 'snake' && (
                <SnakeModal
                    onClose={() => setActiveGame(null)}
                    profile={profile}
                    onSwitchGame={(game) => setActiveGame(game)}
                />
            )}
        </div>
    );
}

export default MainLayout;

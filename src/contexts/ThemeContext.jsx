import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export const BRANDING_PRESETS = {
    SCUB: {
        topbar_name: 'SCUB',
        topbar_logo: '/logowebp/SCUB.webp',
        app_title: 'Sheriff Criminal Unit Bureau',
        app_favicon: '/logowebp/SCUB.webp',
        dashboard_title: 'SHERIFF CRIMINAL UNIT',
        dashboard_subtitle: 'Sheriff Criminal Unit Bureau',
        cases_title: 'GENERAL CRIMES DIVISION',
        cases_subtitle: 'Sheriff Criminal Unit Bureau',
        cases_logo: '/logowebp/Generalcrimes.webp',
        complaints_title: 'Registro de Denuncias',
        complaints_logo: '/logowebp/Generalcrimes.webp',
        login_dept: "Los Santos Sheriff's Department",
        login_bureau: 'Sheriff Criminal Unit Bureau',
        login_logo: '/logowebp/SCUB.webp',
        login_bg: '/logowebp/fondolssd.webp'
    },
    DB: {
        topbar_name: 'DB',
        topbar_logo: '/logowebp/dblogo.webp',
        app_title: 'Detective Bureau',
        app_favicon: '/logowebp/dblogo.webp',
        dashboard_title: 'DETECTIVE BUREAU',
        dashboard_subtitle: 'Detective Bureau Division',
        cases_title: 'MAJOR CRIMES DIVISION',
        cases_subtitle: 'Detective Bureau Division',
        cases_logo: '/logowebp/mcd.webp',
        complaints_title: 'Registro de Denuncias',
        complaints_logo: '/logowebp/mcd.webp',
        login_dept: 'Los Santos Police Department',
        login_bureau: 'Detective Bureau',
        login_logo: '/logowebp/dblogo.webp',
        login_bg: '/logowebp/indeximage.webp'
    },
    LSSD: {
        topbar_name: 'LSSD',
        topbar_logo: '/logowebp/LSSDlogo.webp',
        app_title: "Los Santos County Sheriff's Department",
        app_favicon: '/logowebp/LSSDlogo.webp',
        dashboard_title: "LOS SANTOS COUNTY SHERIFF'S DEPT",
        dashboard_subtitle: "Los Santos Sheriff's Department",
        cases_title: 'INVESTIGATION DIVISION',
        cases_subtitle: "Los Santos Sheriff's Department",
        cases_logo: '/logowebp/LSSDlogo.webp',
        complaints_title: 'Registro de Denuncias y Quejas',
        complaints_logo: '/logowebp/LSSDlogo.webp',
        login_dept: "Los Santos County Sheriff's Department",
        login_bureau: 'División Central de Investigaciones',
        login_logo: '/logowebp/LSSDlogo.webp',
        login_bg: '/logowebp/fondolssd.webp'
    },
    SAPD: {
        topbar_name: 'SAPD',
        topbar_logo: '/logowebp/sanandreas.webp',
        app_title: 'San Andreas Police Department',
        app_favicon: '/logowebp/sanandreas.webp',
        dashboard_title: 'SAN ANDREAS POLICE DEPARTMENT',
        dashboard_subtitle: 'State Police Department',
        cases_title: 'CRIMINAL INVESTIGATION DIVISION',
        cases_subtitle: 'San Andreas Police Department',
        cases_logo: '/logowebp/sanandreas.webp',
        complaints_title: 'Registro de Denuncias y Querellas',
        complaints_logo: '/logowebp/sanandreas.webp',
        login_dept: 'San Andreas Police Department',
        login_bureau: 'Investigation Headquarters',
        login_logo: '/logowebp/sanandreas.webp',
        login_bg: '/logowebp/indeximage.webp'
    }
};

const DEFAULT_BRANDING = BRANDING_PRESETS.SCUB;
const LOCAL_STORAGE_BRANDING_KEY = 'app_custom_branding_v1';

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('LSPD'); // Global department theme
    const [userTheme, setUserThemeState] = useState(() => {
        return localStorage.getItem('user_selected_theme') || 'verde';
    });
    const [loadingTheme, setLoadingTheme] = useState(true);

    // Dynamic Branding State
    const [branding, setBrandingState] = useState(() => {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_BRANDING_KEY);
            if (saved) return { ...DEFAULT_BRANDING, ...JSON.parse(saved) };
        } catch (e) {}
        return DEFAULT_BRANDING;
    });

    // Fetch department global theme, branding settings, and sync user preference
    useEffect(() => {
        let mounted = true;

        const fetchInitialThemesAndBranding = async () => {
            try {
                // 1. Fetch global department theme & branding settings from app_settings
                const { data: appData } = await supabase
                    .from('app_settings')
                    .select('key, value');

                if (appData && mounted) {
                    const settingsMap = {};
                    appData.forEach(item => {
                        settingsMap[item.key] = item.value;
                    });

                    if (settingsMap['theme']) {
                        setTheme(settingsMap['theme']);
                    }

                    // Extract branding settings
                    const loadedBranding = { ...DEFAULT_BRANDING };
                    Object.keys(DEFAULT_BRANDING).forEach(k => {
                        const settingKey = `branding_${k}`;
                        if (settingsMap[settingKey] !== undefined && settingsMap[settingKey] !== '') {
                            loadedBranding[k] = settingsMap[settingKey];
                        }
                    });

                    setBrandingState(loadedBranding);
                    try {
                        localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(loadedBranding));
                    } catch (e) {}
                }

                // 2. Fetch logged in user's individual saved theme preference ONLY if not present in localStorage
                const savedLocal = localStorage.getItem('user_selected_theme');
                if (!savedLocal) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user && mounted) {
                        const { data: userData } = await supabase
                            .from('users')
                            .select('user_theme')
                            .eq('id', user.id)
                            .single();

                        if (userData?.user_theme && mounted) {
                            setUserThemeState(userData.user_theme);
                            localStorage.setItem('user_selected_theme', userData.user_theme);
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching themes and branding:", err);
            } finally {
                if (mounted) setLoadingTheme(false);
            }
        };

        fetchInitialThemesAndBranding();

        // Subscribe to real-time app setting changes (theme and branding_*)
        const subscription = supabase
            .channel('public:app_settings_branding')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings' },
                (payload) => {
                    const newRow = payload.new;
                    if (!newRow) return;

                    if (newRow.key === 'theme' && newRow.value) {
                        setTheme(newRow.value);
                    } else if (newRow.key && newRow.key.startsWith('branding_')) {
                        const field = newRow.key.replace('branding_', '');
                        setBrandingState(prev => {
                            const updated = { ...prev, [field]: newRow.value };
                            try {
                                localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(updated));
                            } catch (e) {}
                            return updated;
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(subscription);
        };
    }, []);

    // Set user theme locally and persist to Supabase & localStorage
    const setUserTheme = async (newTheme) => {
        setUserThemeState(newTheme);
        localStorage.setItem('user_selected_theme', newTheme);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('users').update({ user_theme: newTheme }).eq('id', user.id);
            }
        } catch (e) {
            // Non-blocking fallback
        }
    };

    // Save and apply branding updates
    const updateBranding = async (updates) => {
        const nextBranding = { ...branding, ...updates };
        setBrandingState(nextBranding);
        try {
            localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(nextBranding));
        } catch (e) {}

        // Persist to Supabase
        try {
            // 1. Try RPC save_app_branding
            const { error: rpcError } = await supabase.rpc('save_app_branding', { p_config: updates });
            if (rpcError) {
                console.warn('save_app_branding RPC fallback to direct upsert:', rpcError);
                // 2. Direct upsert fallback
                const upsertEntries = Object.entries(updates).map(([k, v]) => ({
                    key: `branding_${k}`,
                    value: String(v || ''),
                    updated_at: new Date().toISOString()
                }));
                for (const entry of upsertEntries) {
                    await supabase.from('app_settings').upsert(entry);
                }
            }
            return { success: true };
        } catch (err) {
            console.error('Error saving branding to supabase:', err);
            return { success: false, error: err.message };
        }
    };

    // Apply a quick preset
    const applyBrandingPreset = async (presetKey) => {
        const preset = BRANDING_PRESETS[presetKey];
        if (!preset) return;
        return await updateBranding(preset);
    };

    // Apply document title, favicon and CSS classes dynamically
    useEffect(() => {
        const favicon = document.querySelector("link[rel~='icon']");
        
        // Document Title
        if (branding.app_title) {
            document.title = branding.app_title;
        } else if (theme === 'LSSD' || userTheme === 'verde') {
            document.title = "Sheriff Criminal Unit Bureau";
        } else {
            document.title = "Detective Bureau";
        }

        // Favicon
        if (favicon) {
            if (branding.app_favicon) {
                favicon.href = branding.app_favicon;
            } else if (theme === 'LSSD' || userTheme === 'verde') {
                favicon.href = '/logowebp/SCUB.webp';
            } else {
                favicon.href = '/logowebp/dblogo.webp';
            }
        }

        // Set data attribute for global theme identification across non-react modules (e.g. PDF generator)
        document.body.setAttribute('data-dept-theme', theme);
        if (theme === 'LSSD' || userTheme === 'verde') {
            document.body.setAttribute('data-is-lssd', 'true');
        } else {
            document.body.removeAttribute('data-is-lssd');
        }

        // Remove all previous theme classes
        document.body.classList.remove('theme-gris', 'theme-lssd', 'theme-verde', 'theme-negro', 'theme-azul', 'theme-claro');
        
        if (userTheme === 'gris') {
            document.body.classList.add('theme-gris');
        } else if (userTheme && userTheme !== 'verde') {
            document.body.classList.add(`theme-${userTheme}`);
        } else {
            document.body.classList.add('theme-lssd');
        }
    }, [theme, userTheme, branding]);

    const changeTheme = async (newTheme) => {
        try {
            const { error } = await supabase.rpc('update_app_theme', { p_theme: newTheme });
            if (error) throw error;
        } catch (err) {
            console.error("Error updating theme:", err);
            throw err;
        }
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            changeTheme,
            loadingTheme,
            isLSSD: theme === 'LSSD' || userTheme === 'verde',
            userTheme,
            setUserTheme,
            branding,
            updateBranding,
            applyBrandingPreset,
            BRANDING_PRESETS
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);

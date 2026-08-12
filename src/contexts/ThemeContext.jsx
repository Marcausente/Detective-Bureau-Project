import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('LSPD'); // Global department theme
    const [userTheme, setUserThemeState] = useState(() => {
        return localStorage.getItem('user_selected_theme') || 'verde';
    });
    const [loadingTheme, setLoadingTheme] = useState(true);

    // Fetch department global theme and sync user preference from Supabase
    useEffect(() => {
        let mounted = true;

        const fetchInitialThemes = async () => {
            try {
                // 1. Fetch global department theme
                const { data: appData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'theme')
                    .single();

                if (appData && mounted) {
                    setTheme(appData.value);
                }

                // 2. Fetch logged in user's individual saved theme preference ONLY if not present in localStorage (Zero-egress optimization)
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
                console.error("Error fetching themes:", err);
            } finally {
                if (mounted) setLoadingTheme(false);
            }
        };

        fetchInitialThemes();

        // Subscribe to real-time app setting changes
        const subscription = supabase
            .channel('public:app_settings')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'key=eq.theme' },
                (payload) => {
                    if (payload.new && payload.new.value) {
                        setTheme(payload.new.value);
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

    // Apply CSS classes to document body dynamically
    useEffect(() => {
        const favicon = document.querySelector("link[rel~='icon']");
        if (theme === 'LSSD' || userTheme === 'verde') {
            document.title = "Sheriff Criminal Unit Bureau";
            if (favicon) favicon.href = '/logowebp/SCUB.webp';
        } else {
            document.title = "Detective Bureau";
            if (favicon) favicon.href = '/logowebp/dblogo.webp';
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
    }, [theme, userTheme]);

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
            setUserTheme
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);

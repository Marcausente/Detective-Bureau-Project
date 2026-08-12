import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('LSPD'); // Department theme
    const [userTheme, setUserThemeState] = useState(() => {
        return localStorage.getItem('user_selected_theme') || 'gris';
    });
    const [loadingTheme, setLoadingTheme] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchTheme = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'theme')
                    .single();

                if (!error && data && mounted) {
                    setTheme(data.value);
                }
            } catch (err) {
                console.error("Error fetching theme:", err);
            } finally {
                if (mounted) setLoadingTheme(false);
            }
        };

        fetchTheme();

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

    const setUserTheme = (newTheme) => {
        setUserThemeState(newTheme);
        localStorage.setItem('user_selected_theme', newTheme);
    };

    // Apply CSS classes to body
    useEffect(() => {
        const favicon = document.querySelector("link[rel~='icon']");
        if (theme === 'LSSD' || userTheme === 'verde') {
            document.title = "Sheriff Criminal Unit Bureau";
            if (favicon) favicon.href = '/logowebp/SCUB.webp';
        } else {
            document.title = "Detective Bureau";
            if (favicon) favicon.href = '/logowebp/dblogo.webp';
        }

        // Apply active theme class to document body
        document.body.classList.remove('theme-gris', 'theme-lssd', 'theme-verde', 'theme-negro', 'theme-azul', 'theme-claro');
        
        if (userTheme === 'verde') {
            document.body.classList.add('theme-lssd');
        } else if (userTheme && userTheme !== 'gris') {
            document.body.classList.add(`theme-${userTheme}`);
        } else {
            document.body.classList.add('theme-gris');
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

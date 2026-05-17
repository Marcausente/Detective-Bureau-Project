import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('LSPD'); // Default theme
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

        // Subscribe to real-time changes
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

    // Apply CSS class to body when theme changes
    useEffect(() => {
        if (theme === 'LSSD') {
            document.body.classList.add('theme-lssd');
        } else {
            document.body.classList.remove('theme-lssd');
        }
    }, [theme]);

    const changeTheme = async (newTheme) => {
        try {
            const { error } = await supabase.rpc('update_app_theme', { p_theme: newTheme });
            if (error) throw error;
            // The real-time subscription will update the local state for everyone, including the caller.
        } catch (err) {
            console.error("Error updating theme:", err);
            throw err;
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, changeTheme, loadingTheme, isLSSD: theme === 'LSSD' }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);

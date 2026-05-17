import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('en'); // Default language
    const [loadingLanguage, setLoadingLanguage] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchLanguage = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'language')
                    .single();

                if (!error && data && mounted) {
                    setLanguage(data.value);
                } else if (error && error.code === 'PGRST116') {
                    // Row doesn't exist, we might need to insert it
                    console.log("Language setting not found, defaulting to 'en'");
                }
            } catch (err) {
                console.error("Error fetching language:", err);
            } finally {
                if (mounted) setLoadingLanguage(false);
            }
        };

        fetchLanguage();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('public:app_settings:language')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'key=eq.language' },
                (payload) => {
                    if (payload.new && payload.new.value) {
                        setLanguage(payload.new.value);
                    }
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(subscription);
        };
    }, []);

    const changeLanguage = async (newLanguage) => {
        try {
            // First try calling an RPC if they made one
            const { error: rpcError } = await supabase.rpc('update_app_language', { p_language: newLanguage });
            
            if (rpcError) {
                console.log("RPC update_app_language failed or not found, falling back to standard update.", rpcError);
                
                // Check if the setting exists first
                const { data: existing } = await supabase
                    .from('app_settings')
                    .select('key')
                    .eq('key', 'language')
                    .single();

                if (!existing) {
                    // Row doesn't exist, insert it
                    const { error: insertError } = await supabase
                        .from('app_settings')
                        .insert([{ key: 'language', value: newLanguage }]);
                    
                    if (insertError) throw new Error("Could not insert language setting. You may need to create it manually in Supabase or add an RPC: " + insertError.message);
                } else {
                    // Row exists, update it
                    const { data, error: updateError } = await supabase
                        .from('app_settings')
                        .update({ value: newLanguage })
                        .eq('key', 'language')
                        .select();
                        
                    if (updateError) throw updateError;
                    
                    if (!data || data.length === 0) {
                        throw new Error("Update succeeded but 0 rows were affected. This usually means RLS policies are blocking the update. Please create an 'update_app_language' RPC in Supabase (like update_app_theme).");
                    }
                }
            }
            // Real-time subscription handles local state update
        } catch (err) {
            console.error("Error updating language:", err);
            throw err;
        }
    };

    const t = (key) => {
        // Fallback to 'en' if the key or language doesn't exist
        return translations[language]?.[key] || translations['en']?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, loadingLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);

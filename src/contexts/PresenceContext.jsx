import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PresenceContext = createContext();

export const PresenceProvider = ({ children }) => {
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        // Only track if user is authenticated (optional, but cleaner)
        // Or we can just track everyone. Let's ensure user is logged in to identify them.
        let room;

        const setupPresence = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return; // Retrieve user session first

            // Join the global presence channel
            room = supabase.channel('online-users');

            room
                .on('presence', { event: 'sync' }, () => {
                    const newState = room.presenceState();
                    const ids = new Set();
                    for (const id in newState) {
                        newState[id].forEach(p => {
                            if (p.user_id) ids.add(p.user_id);
                        });
                    }
                    setOnlineUsers(ids);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await room.track({
                            user_id: user.id,
                            online_at: new Date().toISOString()
                        });
                    }
                });
        };

        setupPresence();

        // Listen for auth changes to re-connect if user logs in/out
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && !room) {
                setupPresence();
            } else if (event === 'SIGNED_OUT') {
                if (room) {
                    supabase.removeChannel(room);
                    room = null;
                }
                setOnlineUsers(new Set());
            }
        });

        return () => {
            if (room) supabase.removeChannel(room);
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <PresenceContext.Provider value={{ onlineUsers }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () => {
    return useContext(PresenceContext);
};

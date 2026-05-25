import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PresenceContext = createContext();

export const PresenceProvider = ({ children }) => {
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        let isMounted = true;
        let room = null;

        const setupPresence = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!isMounted || !user) return;

            // Remove any existing channel with the same name before creating a new one
            if (room) {
                await supabase.removeChannel(room);
            }

            room = supabase.channel('online-users');

            room
                .on('presence', { event: 'sync' }, () => {
                    if (!isMounted) return;
                    const newState = room.presenceState();
                    const ids = new Set();
                    for (const id in newState) {
                        newState[id].forEach(p => {
                            if (p.user_id) ids.add(p.user_id);
                        });
                    }
                    setOnlineUsers(Array.from(ids));
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED' && isMounted) {
                        try {
                            await room.track({
                                user_id: user.id,
                                online_at: new Date().toISOString()
                            });
                        } catch (err) {
                            console.error("Presence track error:", err);
                        }
                    }
                });
        };

        setupPresence();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                setupPresence();
            } else if (event === 'SIGNED_OUT') {
                if (room) {
                    supabase.removeChannel(room);
                    room = null;
                }
                if (isMounted) setOnlineUsers([]);
            }
        });

        return () => {
            isMounted = false;
            if (room) supabase.removeChannel(room);
            authListener?.subscription?.unsubscribe();
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

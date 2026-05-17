import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function Admin() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/');
                return;
            }

            const { data: profile, error } = await supabase
                .from('users')
                .select('rol')
                .eq('id', user.id)
                .single();

            if (error || !profile || (profile.rol !== 'Administrador' && profile.rol !== 'superadmin')) {
                navigate('/dashboard');
            } else {
                setLoading(false);
            }
        };

        checkAccess();
    }, [navigate]);

    if (loading) return <div className="loading-container">Verifying Access...</div>;

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="doc-header">
                <div>
                    <h2 className="page-title">ADMIN PANEL</h2>
                    <h4 style={{ color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Administrator Controls
                    </h4>
                </div>
            </div>
            
            <div className="dashboard-grid">
                <section className="announcements-section" style={{ width: '100%', gridColumn: '1 / -1' }}>
                     <div className="empty-list">A la espera de instrucciones para el panel de administración.</div>
                </section>
            </div>
        </div>
    );
}

export default Admin;

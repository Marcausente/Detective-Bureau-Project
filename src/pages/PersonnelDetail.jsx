import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function PersonnelDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUserDetail();
    }, [id]);

    const fetchUserDetail = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setUser(data);
        } catch (err) {
            console.error('Error fetching user:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-container">Loading Profile...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;
    if (!user) return <div className="error-message">User not found.</div>;

    return (
        <div className="personnel-detail-container">
            <button className="back-button" onClick={() => navigate('/personnel')}>
                ← Back to Personnel
            </button>

            <div className="detail-card">
                <div className="detail-header">
                    <div className="detail-image-wrapper">
                        {user.profile_image ? (
                            <img src={user.profile_image} alt={`${user.nombre} ${user.apellido}`} className="detail-image" />
                        ) : (
                            <div className="detail-placeholder-image" />
                        )}
                    </div>
                    <div className="detail-title">
                        <h1 className="detail-name">{user.nombre} {user.apellido}</h1>
                        <h2 className="detail-rank">{user.rango}</h2>
                        <span className="detail-badge">Badge #{user.no_placa || '---'}</span>
                    </div>
                </div>

                <div className="detail-body">
                    <div className="detail-section">
                        <h3>Official Information</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Role</label>
                                <span>{user.rol}</span>
                            </div>
                            <div className="detail-item">
                                <label>Bureau Entry Date</label>
                                <span>{user.fecha_ingreso || 'Unknown'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Last Promotion</label>
                                <span>{user.fecha_ultimo_ascenso || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Email Contact</label>
                                <span>{user.email}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PersonnelDetail;

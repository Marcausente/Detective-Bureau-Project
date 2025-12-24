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

    // Evaluations State
    const [evaluations, setEvaluations] = useState([]);
    const [newEvaluation, setNewEvaluation] = useState('');
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalError, setEvalError] = useState(null);
    const [canViewEvaluations, setCanViewEvaluations] = useState(false);

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

            // Fetch evaluations after getting user
            fetchEvaluations(data.id);
        } catch (err) {
            console.error('Error fetching user:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchEvaluations = async (targetUserId) => {
        try {
            setEvalLoading(true);
            console.log("Fetching evaluations for target:", targetUserId);

            const { data, error } = await supabase.rpc('get_evaluations', {
                p_target_user_id: targetUserId
            });

            console.log("RPC Response:", { data, error });

            if (error) {
                console.warn("RPC Error (likely permission/RLS):", error.message);
                setCanViewEvaluations(false);
                setEvaluations([]);
            } else {
                console.log("Access Granted. Evaluations count:", data ? data.length : 0);
                setCanViewEvaluations(true);
                setEvaluations(data || []);
            }
        } catch (err) {
            console.error("Fetch Exception:", err);
            setCanViewEvaluations(false);
        } finally {
            setEvalLoading(false);
        }
    };

    const handleAddEvaluation = async (e) => {
        e.preventDefault();
        if (!newEvaluation.trim()) return;

        try {
            setEvalLoading(true);
            setEvalError(null);

            const { error } = await supabase.rpc('add_evaluation', {
                p_target_user_id: id,
                p_content: newEvaluation
            });

            if (error) throw error;

            setNewEvaluation('');
            // Refresh list
            fetchEvaluations(id);

        } catch (err) {
            console.error('Error adding evaluation:', err);
            setEvalError(err.message);
        } finally {
            setEvalLoading(false);
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
                                <label>Bureau Entry Date</label>
                                <span>{user.fecha_ingreso || 'Unknown'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Email Contact</label>
                                <span>{user.email}</span>
                            </div>
                        </div>
                    </div>

                    {/* Evaluations Section */}
                    {canViewEvaluations && (
                        <div className="detail-section" style={{ marginTop: '2rem' }}>
                            <h3>Officer Evaluations</h3>

                            <div className="evaluations-list">
                                {evaluations.length === 0 ? (
                                    <div className="empty-evals">No evaluations recorded.</div>
                                ) : (
                                    evaluations.map(ev => (
                                        <div key={ev.id} className="evaluation-card">
                                            <div className="eval-header">
                                                <span className="eval-author">{ev.author_rank} {ev.author_name}</span>
                                                <span className="eval-date">{new Date(ev.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="eval-content">{ev.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add Evaluation Form */}
                            <form onSubmit={handleAddEvaluation} className="add-evaluation-form">
                                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Add New Evaluation</h4>
                                {evalError && <div className="error-text" style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{evalError}</div>}
                                <textarea
                                    className="eval-textarea"
                                    value={newEvaluation}
                                    onChange={(e) => setNewEvaluation(e.target.value)}
                                    placeholder="Write your evaluation here..."
                                    rows="4"
                                />
                                <button
                                    type="submit"
                                    className="login-button"
                                    style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                                    disabled={evalLoading}
                                >
                                    {evalLoading ? 'Submitting...' : 'Submit Evaluation'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PersonnelDetail;

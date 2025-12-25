import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

// Rank Hierarchy Helper
const getRankLevel = (rank) => {
    switch (rank) {
        case 'Oficial II':
        case 'Oficial III':
        case 'Oficial III+':
            return 1;
        case 'Detective I':
            return 2;
        case 'Detective II':
            return 3;
        case 'Detective III':
            return 4;
        case 'Teniente':
        case 'Capitan':
            return 5;
        default:
            return 0;
    }
};

function PersonnelDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null); // The Target User
    const [viewer, setViewer] = useState(null); // The Current Logged-in User
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Evaluations State
    const [evaluations, setEvaluations] = useState([]);
    const [newEvaluation, setNewEvaluation] = useState('');
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalError, setEvalError] = useState(null);
    const [canViewEvaluations, setCanViewEvaluations] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Get Current User (Viewer) Auth & Profile
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                navigate('/');
                return;
            }

            const { data: viewerData, error: viewerError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (viewerError) throw viewerError;
            setViewer(viewerData);

            // 2. Get Target User Profile
            const { data: targetData, error: targetError } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (targetError) throw targetError;
            setUser(targetData);

            // 3. Check Permissions & Fetch Evaluations
            checkAndFetchEvaluations(viewerData, targetData);

        } catch (err) {
            console.error('Error loading data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const checkAndFetchEvaluations = async (viewerProfile, targetProfile) => {
        const viewerLevel = getRankLevel(viewerProfile.rango);
        const targetLevel = getRankLevel(targetProfile.rango);

        console.log(`Rank Check: Viewer (${viewerProfile.rango}, L${viewerLevel}) vs Target (${targetProfile.rango}, L${targetLevel})`);

        // Rule: Viewer MUST be strictly higher than Target
        if (viewerLevel > targetLevel) {
            setCanViewEvaluations(true);
            await fetchEvaluations(targetProfile.id);
        } else {
            setCanViewEvaluations(false);
            setEvaluations([]);
        }
    };

    const fetchEvaluations = async (targetUserId) => {
        try {
            setEvalLoading(true);
            const { data, error } = await supabase.rpc('get_evaluations', {
                p_target_user_id: targetUserId
            });

            if (error) {
                console.warn("RPC Error:", error.message);
                // If RPC fails (e.g. redundancy check), we just hide it
                // setCanViewEvaluations(false); 
            } else {
                setEvaluations(data || []);
            }
        } catch (err) {
            console.error("Fetch Eval Exception:", err);
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
                                <span>{user.fecha_ingreso ? new Date(user.fecha_ingreso).toLocaleDateString() : 'Unknown'}</span>
                            </div>
                            <div className="detail-item">
                                <label>Email Contact</label>
                                <span>{user.email}</span>
                            </div>
                        </div>
                    </div>

                    {/* Evaluations Section */}
                    {canViewEvaluations ? (
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
                    ) : (
                        /* Optional: Message explaining why they can't see it? Or just hidden.
                           Given the rules, keeping it hidden is cleaner, but debug text helps. */
                        user.rango !== 'Capitan' && user.rango !== 'Teniente' && (
                            <div className="detail-section" style={{ marginTop: '2rem', opacity: 0.5 }}>
                                <p style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>Evaluations are restricted to superior ranks.</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

export default PersonnelDetail;


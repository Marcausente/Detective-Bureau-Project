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

    // Interrogations State
    const [agentInterrogations, setAgentInterrogations] = useState([]);
    const [intLoading, setIntLoading] = useState(false);

    // Evaluations State
    const [evaluations, setEvaluations] = useState([]);
    const [newEvaluation, setNewEvaluation] = useState('');
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalError, setEvalError] = useState(null);
    const [canViewEvaluations, setCanViewEvaluations] = useState(false);

    // Assigned Cases State
    const [assignedCases, setAssignedCases] = useState([]);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Get Current User (Viewer) Auth & Profile
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (!authUser) {
                throw new Error("No authenticated session found.");
            }

            const { data: viewerData, error: viewerError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (viewerError) throw viewerError;
            if (!viewerData) throw new Error("Viewer (Self) Profile not found");
            setViewer(viewerData);

            // 2. Get Target User Profile
            const { data: targetData, error: targetError } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (targetError) throw targetError;
            if (!targetData) throw new Error("Target User Profile not found");
            setUser(targetData);

            // 3. Check Permissions & Fetch Evaluations
            if (viewerData && targetData) {
                checkAndFetchEvaluations(viewerData, targetData);
            }

            // 4. Fetch Interrogations where this agent was present
            fetchAgentInterrogations(targetData);

            // 5. Fetch Assigned Cases (SECURE RPC, filters by viewer permissions)
            const { data: casesData, error: casesError } = await supabase.rpc('get_personnel_visible_cases', {
                p_target_user_id: id
            });

            if (casesError) {
                console.error("Error fetching cases:", casesError);
            } else if (casesData) {
                setAssignedCases(casesData);
            }

        } catch (err) {
            console.error('Error loading data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchAgentInterrogations = async (targetUser) => {
        try {
            setIntLoading(true);
            // Fetch ALL interrogations (simplest approach for now given text-based storage)
            // In a larger app, we'd want a specific RPC with text search on the DB side.
            const { data, error } = await supabase.rpc('get_interrogations', {});

            if (error) throw error;

            if (data) {
                // Construct the search strings
                // The format stored is typically: "Rank Name Surname"
                // We should match loosely to be safe
                const fullName = `${targetUser.nombre} ${targetUser.apellido}`;

                const relevant = data.filter(item => {
                    if (!item.agents_present) return false;
                    // Check if the string contains the user's name (simplest reliable check)
                    return item.agents_present.includes(fullName);
                });
                setAgentInterrogations(relevant);
            }
        } catch (err) {
            console.error("Error loading agent interrogations:", err);
        } finally {
            setIntLoading(false);
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

    const handleDeleteEvaluation = async (evalId) => {
        if (!window.confirm("Are you sure you want to delete this evaluation?")) return;

        try {
            setEvalLoading(true);
            const { error } = await supabase.rpc('delete_evaluation', { p_evaluation_id: evalId });

            if (error) throw error;

            // Refresh list
            fetchEvaluations(id);
        } catch (err) {
            console.error("Error deleting evaluation:", err);
            alert("Error deleting evaluation: " + err.message);
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
                            <img src="/anon.png" alt="Anon" className="detail-image" />
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
                                <span className="detail-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', color: 'var(--accent-gold)' }}>Bureau Entry Date</span>
                                <span>{user.fecha_ingreso ? new Date(user.fecha_ingreso).toLocaleDateString() : 'Unknown'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', color: 'var(--accent-gold)' }}>Email Contact</span>
                                <span>{user.email}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h3>Assigned Criminal Cases</h3>
                        {assignedCases.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No cases currently assigned.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                                {assignedCases.map(c => (
                                    <div key={c.id}
                                        onClick={() => navigate(`/cases/${c.id}`)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)', padding: '0.8rem', borderRadius: '6px',
                                            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                                            borderLeft: c.status === 'Open' ? '3px solid #4ade80' : '3px solid #f87171'
                                        }}>
                                        <div style={{
                                            width: '12px', height: '12px', borderRadius: '50%',
                                            backgroundColor: c.status === 'Open' ? '#4ade80' : '#f87171',
                                            boxShadow: c.status === 'Open' ? '0 0 8px #4ade80' : 'none'
                                        }} />
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>#{c.case_number} - {c.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {new Date(c.created_at).toLocaleDateString()} • <span style={{ color: c.status === 'Open' ? '#4ade80' : '#f87171' }}>{c.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Interrogations History Section */}
                    <div className="detail-section" style={{ marginTop: '2rem' }}>
                        <h3>Interrogations Participation</h3>
                        {intLoading ? (
                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Checking records...</div>
                        ) : (
                            <div className="interrogations-list">
                                {agentInterrogations.length === 0 ? (
                                    <div className="empty-evals">No interrogation records found for this agent.</div>
                                ) : (
                                    agentInterrogations.map(int => (
                                        <div key={int.id} className="evaluation-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/interrogations?id=${int.id}`)}>
                                            <div className="eval-header">
                                                <span className="eval-author">{int.title}</span>
                                                <span className="eval-date">{int.interrogation_date}</span>
                                            </div>
                                            <div className="eval-content" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                Subjects: {int.subjects}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
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
                                        <div key={ev.id} className="evaluation-card" style={{ position: 'relative' }}>
                                            <button
                                                className="card-action-btn delete-btn"
                                                style={{ position: 'absolute', top: '10px', right: '10px' }}
                                                onClick={() => handleDeleteEvaluation(ev.id)}
                                                title="Delete Evaluation"
                                            >
                                                🗑️
                                            </button>
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
                                    name="newEvaluation"
                                    id="newEvaluation"
                                    aria-label="New Evaluation Content"
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


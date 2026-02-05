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
        case 'Internal Affairs Agent':
        case 'Department of Justice Agent':
            return 4.5; // Higher than D3, lower than Lt? Or equal? Assuming 4.5 or 5.
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

    // Equipment State
    const [equipment, setEquipment] = useState([]);
    const [equipmentTypes, setEquipmentTypes] = useState([]);
    const [showEquipmentTypesModal, setShowEquipmentTypesModal] = useState(false);
    const [showAssignEquipmentModal, setShowAssignEquipmentModal] = useState(false);
    const [equipmentTypeForm, setEquipmentTypeForm] = useState({ name: '', description: '' });
    const [editingEquipmentTypeId, setEditingEquipmentTypeId] = useState(null);
    const [assignEquipmentForm, setAssignEquipmentForm] = useState({ equipment_type_id: '', issued_date: '', serial_number: '' });

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

            // 6. Fetch Equipment Types
            const { data: equipTypesData, error: equipTypesError } = await supabase.rpc('get_equipment_types');
            if (equipTypesError) {
                console.error("Error fetching equipment types:", equipTypesError);
            } else {
                setEquipmentTypes(equipTypesData || []);
            }

            // 7. Fetch User Equipment
            const { data: equipData, error: equipError } = await supabase.rpc('get_user_equipment', { p_user_id: id });
            if (equipError) {
                console.error("Error fetching equipment:", equipError);
            } else {
                setEquipment(equipData || []);
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
        // Exclude IA and DOJ Agents from evaluations system entirely
        const excludedRanks = ['Internal Affairs Agent', 'Department of Justice Agent'];
        
        // If viewer is IA/DOJ agent, they cannot view anyone's evaluations
        if (excludedRanks.includes(viewerProfile.rango)) {
            setCanViewEvaluations(false);
            setEvaluations([]);
            return;
        }
        
        // If target is IA/DOJ agent, no one can view their evaluations
        if (excludedRanks.includes(targetProfile.rango)) {
            setCanViewEvaluations(false);
            setEvaluations([]);
            return;
        }

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

    // ===== EQUIPMENT HANDLERS =====
    const handleSaveEquipmentType = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('manage_equipment_type', {
                p_action: editingEquipmentTypeId ? 'update' : 'create',
                p_id: editingEquipmentTypeId,
                p_name: equipmentTypeForm.name,
                p_description: equipmentTypeForm.description
            });
            setEquipmentTypeForm({ name: '', description: '' });
            setEditingEquipmentTypeId(null);
            // Reload equipment types
            const { data } = await supabase.rpc('get_equipment_types');
            setEquipmentTypes(data || []);
        } catch (err) {
            alert('Error saving equipment type: ' + err.message);
        }
    };

    const handleDeleteEquipmentType = async (typeId) => {
        if (!window.confirm('Delete this equipment type? All assignments will be removed.')) return;
        try {
            await supabase.rpc('manage_equipment_type', { p_action: 'delete', p_id: typeId });
            const { data } = await supabase.rpc('get_equipment_types');
            setEquipmentTypes(data || []);
        } catch (err) {
            alert('Error deleting equipment type: ' + err.message);
        }
    };

    const handleAssignEquipment = async (e) => {
        e.preventDefault();
        try {
            await supabase.rpc('assign_equipment', {
                p_user_id: id,
                p_equipment_type_id: assignEquipmentForm.equipment_type_id,
                p_issued_date: assignEquipmentForm.issued_date,
                p_serial_number: assignEquipmentForm.serial_number || null
            });
            setShowAssignEquipmentModal(false);
            setAssignEquipmentForm({ equipment_type_id: '', issued_date: '', serial_number: '' });
            // Reload equipment
            const { data } = await supabase.rpc('get_user_equipment', { p_user_id: id });
            setEquipment(data || []);
        } catch (err) {
            alert('Error assigning equipment: ' + err.message);
        }
    };

    const handleUpdateEquipmentStatus = async (equipId, newStatus, returnDate = null) => {
        try {
            await supabase.rpc('update_equipment_status', {
                p_equipment_id: equipId,
                p_status: newStatus,
                p_return_date: returnDate
            });
            const { data } = await supabase.rpc('get_user_equipment', { p_user_id: id });
            setEquipment(data || []);
        } catch (err) {
            alert('Error updating equipment status: ' + err.message);
        }
    };

    const handleRemoveEquipment = async (equipId) => {
        if (!window.confirm('Remove this equipment assignment?')) return;
        try {
            await supabase.rpc('remove_equipment', { p_equipment_id: equipId });
            const { data } = await supabase.rpc('get_user_equipment', { p_user_id: id });
            setEquipment(data || []);
        } catch (err) {
            alert('Error removing equipment: ' + err.message);
        }
    };

    const getEquipmentStatusColor = (status) => {
        switch (status) {
            case 'Active': return '#4ade80';
            case 'Missing': return '#ef4444';
            case 'Retired': return '#94a3b8';
            default: return '#94a3b8';
        }
    };

    const getEquipmentStatusOptions = (currentStatus) => {
        return ['Active', 'Missing', 'Retired'].filter(s => s !== currentStatus);
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
                            <div className="detail-item">
                                <span className="detail-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', color: 'var(--accent-gold)' }}>Divisions</span>
                                <span>{user.divisions ? user.divisions.join(', ') : 'Detective Bureau'}</span>
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

                {/* Equipment Section */}
                <div className="detail-section" style={{ marginTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Equipment Assigned</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="login-button btn-secondary" 
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                onClick={() => setShowEquipmentTypesModal(true)}
                            >
                                Manage Types
                            </button>
                            <button 
                                className="login-button" 
                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                onClick={() => setShowAssignEquipmentModal(true)}
                            >
                                + Assign Equipment
                            </button>
                        </div>
                    </div>

                    {equipment.length === 0 ? (
                        <div className="empty-list">No equipment assigned</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {equipment.map(eq => (
                                <div key={eq.id} style={{
                                    padding: '1.5rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: `2px solid ${getEquipmentStatusColor(eq.status)}`,
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                                                {eq.equipment_name}
                                            </h4>
                                            {eq.equipment_description && (
                                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                                    {eq.equipment_description}
                                                </p>
                                            )}
                                            
                                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                                                {eq.serial_number && (
                                                    <div><strong>Serial:</strong> {eq.serial_number}</div>
                                                )}
                                                <div><strong>Issued:</strong> {new Date(eq.issued_date).toLocaleDateString()}</div>
                                                {eq.return_date && (
                                                    <div>
                                                        <strong>{eq.status === 'Missing' ? 'Missing since:' : 'Returned:'}</strong> {new Date(eq.return_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                                <div><strong>By:</strong> {eq.issued_by_name}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', ml: '1rem' }}>
                                            <span style={{
                                                padding: '0.3rem 0.8rem',
                                                borderRadius: '12px',
                                                background: getEquipmentStatusColor(eq.status) + '20',
                                                color: getEquipmentStatusColor(eq.status),
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold'
                                            }}>
                                                {eq.status}
                                            </span>

                                            <select
                                                className="form-input custom-select"
                                                style={{ width: 'auto', padding: '0.3rem', fontSize: '0.85rem' }}
                                                value=""
                                                onChange={(e) => handleUpdateEquipmentStatus(eq.id, e.target.value)}
                                            >
                                                <option value="">Change Status</option>
                                                {getEquipmentStatusOptions(eq.status).map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>

                                            <button
                                                className="card-action-btn delete-btn"
                                                onClick={() => handleRemoveEquipment(eq.id)}
                                                title="Remove Equipment"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Equipment Types Modal */}
            {showEquipmentTypesModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px' }}>
                        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Manage Equipment Types</h3>
                        
                        <form onSubmit={handleSaveEquipmentType} style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <div className="form-group">
                                <label className="form-label">Equipment Name *</label>
                                <input 
                                    required 
                                    className="form-input" 
                                    value={equipmentTypeForm.name} 
                                    onChange={(e) => setEquipmentTypeForm({ ...equipmentTypeForm, name: e.target.value })} 
                                    placeholder="e.g., Porra, Taser, Radio"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea 
                                    className="form-input" 
                                    rows="2" 
                                    value={equipmentTypeForm.description} 
                                    onChange={(e) => setEquipmentTypeForm({ ...equipmentTypeForm, description: e.target.value })} 
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" className="login-button">
                                    {editingEquipmentTypeId ? 'Update' : 'Create'} Type
                                </button>
                                {editingEquipmentTypeId && (
                                    <button 
                                        type="button" 
                                        className="login-button btn-secondary" 
                                        onClick={() => {
                                            setEditingEquipmentTypeId(null);
                                            setEquipmentTypeForm({ name: '', description: '' });
                                        }}
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                        </form>

                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {equipmentTypes.length === 0 ? (
                                <div className="empty-list">No equipment types created yet</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {equipmentTypes.map(type => (
                                        <div key={type.id} style={{
                                            padding: '1rem',
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{type.name}</div>
                                                {type.description && (
                                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                        {type.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="card-action-btn edit-btn"
                                                    onClick={() => {
                                                        setEditingEquipmentTypeId(type.id);
                                                        setEquipmentTypeForm({ name: type.name, description: type.description || '' });
                                                    }}
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    className="card-action-btn delete-btn"
                                                    onClick={() => handleDeleteEquipmentType(type.id)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <button 
                                className="login-button btn-secondary" 
                                onClick={() => {
                                    setShowEquipmentTypesModal(false);
                                    setEditingEquipmentTypeId(null);
                                    setEquipmentTypeForm({ name: '', description: '' });
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Equipment Modal */}
            {showAssignEquipmentModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Assign Equipment</h3>
                        <form onSubmit={handleAssignEquipment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Equipment Type *</label>
                                <select 
                                    required 
                                    className="form-input custom-select" 
                                    value={assignEquipmentForm.equipment_type_id} 
                                    onChange={(e) => setAssignEquipmentForm({ ...assignEquipmentForm, equipment_type_id: e.target.value })}
                                >
                                    <option value="">Select equipment...</option>
                                    {equipmentTypes.map(type => (
                                        <option key={type.id} value={type.id}>{type.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Issue Date *</label>
                                <input 
                                    type="date" 
                                    required 
                                    className="form-input" 
                                    value={assignEquipmentForm.issued_date} 
                                    onChange={(e) => setAssignEquipmentForm({ ...assignEquipmentForm, issued_date: e.target.value })} 
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Serial Number (Optional)</label>
                                <input 
                                    className="form-input" 
                                    value={assignEquipmentForm.serial_number} 
                                    onChange={(e) => setAssignEquipmentForm({ ...assignEquipmentForm, serial_number: e.target.value })} 
                                    placeholder="e.g., SN-12345"
                                />
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowAssignEquipmentModal(false)}>Cancel</button>
                                <button type="submit" className="login-button">Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PersonnelDetail;


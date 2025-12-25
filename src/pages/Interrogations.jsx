import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Interrogations() {
    const [interrogations, setInterrogations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        agents: '',
        subjects: '',
        transcription: '',
        url: ''
    });
    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_interrogations', {});
            if (error) throw error;
            setInterrogations(data || []);
        } catch (err) {
            console.error('Error loading interrogations:', err.message || err, err.details || '', err.hint || '');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setModalMode('create');
        const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY format roughly
        setFormData({
            title: `${today} - [Subject Name]`,
            date: new Date().toISOString().split('T')[0],
            agents: '',
            subjects: '',
            transcription: '',
            url: ''
        });
        setShowModal(true);
    };

    const openEdit = (item) => {
        setModalMode('update');
        setEditingId(item.id);
        setFormData({
            title: item.title,
            date: item.interrogation_date,
            agents: item.agents_present || '',
            subjects: item.subjects || '',
            transcription: item.transcription || '',
            url: item.media_url || ''
        });
        setShowModal(true);
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            const { error } = await supabase.rpc('manage_interrogation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_date: formData.date,
                p_agents: formData.agents,
                p_subjects: formData.subjects,
                p_transcription: formData.transcription,
                p_url: formData.url
            });
            if (error) throw error;
            setShowModal(false);
            loadData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this interrogation record?")) return;
        try {
            const { error } = await supabase.rpc('manage_interrogation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    const filteredItems = interrogations.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subjects?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.agents_present?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="documentation-container">
            <div className="doc-header">
                <h2 className="page-title">Interrogations Log</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="form-input"
                        style={{ width: '250px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={openCreate}>
                        + New Entry
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">Loading Logs...</div>
            ) : (
                <div className="interrogations-list">
                    {filteredItems.length === 0 ? (
                        <div className="empty-list">No interrogations found.</div>
                    ) : (
                        filteredItems.map(item => (
                            <div key={item.id} className="interrogation-card">
                                <div className="int-card-header">
                                    <span className="int-date">{item.interrogation_date}</span>
                                    {item.can_edit && (
                                        <div className="int-actions">
                                            <button onClick={() => openEdit(item)} className="card-action-btn edit-btn">✏️</button>
                                            <button onClick={() => handleDelete(item.id)} className="card-action-btn delete-btn">🗑️</button>
                                        </div>
                                    )}
                                </div>
                                <h3 className="int-title">{item.title}</h3>
                                <div className="int-details-grid">
                                    <div className="int-detail">
                                        <label>Agents:</label>
                                        <span>{item.agents_present || 'N/A'}</span>
                                    </div>
                                    <div className="int-detail">
                                        <label>Subjects:</label>
                                        <span>{item.subjects || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="int-transcription-preview">
                                    <label>Transcription / Notes:</label>
                                    <p>{item.transcription}</p>
                                </div>
                                {item.media_url && (
                                    <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="int-link-btn">
                                        ▶ View Recording / Evidence
                                    </a>
                                )}
                                <div className="int-author-footer">Filed by: {item.author_name}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '700px', width: '90%' }}>
                        <h3>{modalMode === 'create' ? 'New Interrogation Log' : 'Edit Log'}</h3>
                        <form onSubmit={handleAction} style={{ textAlign: 'left', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-input" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label className="form-label">Title (Template: DD/MM/YYYY - Name)</label>
                                    <input className="form-input" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Agents Present</label>
                                <input className="form-input" placeholder="e.g. Det. Vance, Of. Smith" value={formData.agents} onChange={e => setFormData({ ...formData, agents: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Subject(s) Interrogated</label>
                                <input className="form-input" placeholder="e.g. John Doe" value={formData.subjects} onChange={e => setFormData({ ...formData, subjects: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Relevant Information / Transcription</label>
                                <textarea
                                    className="form-input"
                                    rows="10"
                                    placeholder="Enter detailed notes here..."
                                    value={formData.transcription}
                                    onChange={e => setFormData({ ...formData, transcription: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Recording / Evidence Link (YouTube/Drive)</label>
                                <input type="url" className="form-input" placeholder="https://..." value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                            </div>

                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="login-button" disabled={submitLoading}>{submitLoading ? 'Saving...' : 'Save Log'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Interrogations;

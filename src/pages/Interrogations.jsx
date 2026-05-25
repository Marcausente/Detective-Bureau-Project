import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Interrogations() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useLanguage();
    const [interrogations, setInterrogations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Personnel State (for Agent Selection)
    const [personnel, setPersonnel] = useState([]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        agents: '', // Stored as string to match BBDD
        subjects: '',
        transcription: '',
        url: ''
    });
    // Temporary state to hold array of currently selected agent names in the modal
    const [selectedAgents, setSelectedAgents] = useState([]);

    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        loadData();
        fetchPersonnel();
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

    const fetchPersonnel = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('nombre, apellido, rango, no_placa')
                .order('nombre'); // basic sort, we'll custom sort below

            if (error) throw error;

            if (data) {
                // Rank Priorities (Same as Personnel.jsx)
                const rankPriority = {
                    'Sheriff': 150,
                    'Undersheriff': 140,
                    'Assistant Sheriff': 130,
                    'Division Chief': 120,
                    'Comandante': 110,
                    'Capitan': 100,
                    'Teniente': 90,
                    'Internal Affairs Agent': 85,
                    'Department of Justice Agent': 85,
                    'Detective III': 80,
                    'Detective II': 70,
                    'Detective I': 60,
                    'Oficial III+': 50,
                    'Oficial III': 40,
                    'Deputy Sheriff Bonus II': 35,
                    'Oficial II': 30,
                    'Deputy Sheriff Bonus I': 20,
                    'Oficial I': 15,
                    'Deputy Sheriff': 10
                };
                const getRankPriority = (rank) => rankPriority[rank] || 0;

                // Sort by Rank DESC, then Name ASC
                const sorted = data.sort((a, b) => {
                    const rankDiff = getRankPriority(b.rango) - getRankPriority(a.rango);
                    if (rankDiff !== 0) return rankDiff;
                    return a.nombre.localeCompare(b.nombre);
                });

                setPersonnel(sorted);
            }
        } catch (err) {
            console.error('Error fetching personnel:', err);
        }
    };

    const openCreate = () => {
        setModalMode('create');
        const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
        setFormData({
            title: `${today} - [Subject Name]`,
            date: new Date().toISOString().split('T')[0],
            agents: '',
            subjects: '',
            transcription: '',
            url: ''
        });
        setSelectedAgents([]);
        setShowModal(true);
    };

    const openEdit = (item) => {
        setModalMode('update');
        setEditingId(item.id);
        const currentAgents = item.agents_present ? item.agents_present.split(',').map(s => s.trim()).filter(Boolean) : [];
        setFormData({
            title: item.title,
            date: item.interrogation_date,
            agents: item.agents_present || '',
            subjects: item.subjects || '',
            transcription: item.transcription || '',
            url: item.media_url || ''
        });
        setSelectedAgents(currentAgents);
        setShowModal(true);
    };

    const toggleAgent = (agentName) => {
        let newSelection;
        if (selectedAgents.includes(agentName)) {
            newSelection = selectedAgents.filter(name => name !== agentName);
        } else {
            newSelection = [...selectedAgents, agentName];
        }
        setSelectedAgents(newSelection);
        setFormData(prev => ({ ...prev, agents: newSelection.join(', ') }));
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        // Ensure formData.agents is synced with selectedAgents just in case
        const finalAgents = selectedAgents.join(', ');

        try {
            const { error } = await supabase.rpc('manage_interrogation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_date: formData.date,
                p_agents: finalAgents,
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

    const filteredItems = interrogations.filter(item => {
        // 1. If ID param exists, show ONLY that item
        const paramId = searchParams.get('id');
        if (paramId) {
            return item.id === paramId;
        }
        // 2. Otherwise apply search term
        return (
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.subjects?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.agents_present?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    const clearIdFilter = () => {
        setSearchParams({});
    };

    // Filter agents for selection (simple search inside modal could be added, but list is likely short enough)

    return (
        <div className="documentation-container">
            <div className="doc-header">
                <h2 className="page-title">{t('interrogationsLogTitle')}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {searchParams.get('id') && (
                        <button className="login-button btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem', marginRight: '0.5rem' }} onClick={clearIdFilter}>
                            {t('showAllBtn')}
                        </button>
                    )}
                    <input
                        type="text"
                        placeholder={t('searchLogsPlaceholder')}
                        className="form-input"
                        style={{ width: '250px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!!searchParams.get('id')}
                    />
                    <button className="login-button" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={openCreate}>
                        {t('newEntryBtn')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">{t('loadingLogs')}</div>
            ) : (
                <div className="interrogations-list">
                    {filteredItems.length === 0 ? (
                        <div className="empty-list">{t('noInterrogationsFound')}</div>
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
                                        <label>{t('agentsLabel')}</label>
                                        <span>{item.agents_present || 'N/A'}</span>
                                    </div>
                                    <div className="int-detail">
                                        <label>{t('subjectsLabel')}</label>
                                        <span>{item.subjects || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="int-transcription-preview">
                                    <label>{t('transcriptionNotesLabel')}</label>
                                    <p>{item.transcription}</p>
                                </div>
                                {item.media_url && (
                                    <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="int-link-btn">
                                        {t('viewRecordingBtn')}
                                    </a>
                                )}
                                <div className="int-author-footer">{t('filedByLabel')} {item.author_name}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3>{modalMode === 'create' ? t('newInterrogationLogTitle') : t('editLogTitle')}</h3>
                        <form onSubmit={handleAction} style={{ textAlign: 'left', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ flex: '1 1 200px' }}>
                                    <label className="form-label">{t('dateLabel')}</label>
                                    <input type="date" className="form-input" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: '2 1 300px' }}>
                                    <label className="form-label">{t('titleTemplateLabel')}</label>
                                    <input className="form-input" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                </div>
                            </div>

                            {/* Custom Agent Selector */}
                            <div className="form-group">
                                <label className="form-label">{t('agentsPresentLabel')}</label>
                                <div className="agent-selector-container" style={{
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: '0.5rem'
                                }}>
                                    {personnel.map(p => {
                                        const fullName = `${p.rango} ${p.nombre} ${p.apellido}`;
                                        const isSelected = selectedAgents.includes(fullName);
                                        return (
                                            <div
                                                key={p.no_placa + p.nombre} // somewhat unique key
                                                onClick={() => toggleAgent(fullName)}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    border: isSelected ? '1px solid var(--accent-gold)' : '1px solid transparent',
                                                    background: isSelected ? 'rgba(207, 181, 59, 0.1)' : 'transparent',
                                                    color: isSelected ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <div style={{
                                                    width: '16px', height: '16px', borderRadius: '4px',
                                                    border: '1px solid var(--text-secondary)',
                                                    background: isSelected ? 'var(--accent-gold)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {isSelected && <span style={{ color: 'black', fontSize: '10px' }}>✓</span>}
                                                </div>
                                                {fullName}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    {t('selectedLabel')} {selectedAgents.length > 0 ? selectedAgents.join(', ') : t('noneSelected')}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('subjectsInterrogatedLabel')}</label>
                                <input className="form-input" placeholder="e.g. John Doe" value={formData.subjects} onChange={e => setFormData({ ...formData, subjects: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('relevantInfoLabel')}</label>
                                <textarea
                                    className="form-input"
                                    rows="10"
                                    placeholder={t('enterNotesPlaceholder')}
                                    value={formData.transcription}
                                    onChange={e => setFormData({ ...formData, transcription: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('recordingLinkLabel')}</label>
                                <input type="url" className="form-input" placeholder="https://..." value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                            </div>

                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)}>{t('cancelBtnLog')}</button>
                                <button type="submit" className="login-button" disabled={submitLoading}>{submitLoading ? 'Saving...' : t('saveLogBtn')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Interrogations;

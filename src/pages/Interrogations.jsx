import { useState, useEffect, useMemo } from 'react';
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
    const [expandedCards, setExpandedCards] = useState({});

    const [submitLoading, setSubmitLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('users').select('rol').eq('id', user.id).single();
                setCurrentUser(data);
            }
        };
        getCurrentUser();
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
            console.error('Error loading interrogations:', err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPersonnel = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('nombre, apellido, rango, no_placa')
                .order('nombre');

            if (error) throw error;

            if (data) {
                const rankPriority = {
                    'Sheriff': 150,
                    'Undersheriff': 140,
                    'Assistant Sheriff': 130,
                    'Division Chief': 120,
                    'Comandante': 110,
                    'Capitan': 100,
                    'Teniente': 90,
                    'Internal Affairs Agent': 87,
                    'SEB Agent': 86,
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
            title: `${today} - [Nombre del Sujeto]`,
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
        if (!window.confirm("¿Estás seguro de que deseas eliminar este registro de interrogatorio?")) return;
        try {
            const { error } = await supabase.rpc('manage_interrogation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const toggleCardExpanded = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredItems = useMemo(() => {
        const paramId = searchParams.get('id');
        if (paramId) {
            return interrogations.filter(item => item.id === paramId);
        }
        if (!searchTerm || searchTerm.trim() === '') return interrogations;
        const term = searchTerm.toLowerCase().trim();
        return interrogations.filter(item => (
            (item.title && item.title.toLowerCase().includes(term)) ||
            (item.subjects && item.subjects.toLowerCase().includes(term)) ||
            (item.agents_present && item.agents_present.toLowerCase().includes(term)) ||
            (item.transcription && item.transcription.toLowerCase().includes(term)) ||
            (item.author_name && item.author_name.toLowerCase().includes(term))
        ));
    }, [interrogations, searchParams, searchTerm]);

    const clearIdFilter = () => {
        setSearchParams({});
    };

    const withMediaCount = useMemo(() => interrogations.filter(i => i.media_url).length, [interrogations]);

    return (
        <div
            id="interrogations-page"
            style={{
                width: '100%',
                height: 'calc(100vh - 80px)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'transparent',
                padding: '1rem 1.5rem 0 1.5rem',
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            {/* Apple Command Topbar */}
            <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                marginBottom: '0.9rem',
                padding: '0.3rem 0.5rem',
                gap: '1rem',
                flexWrap: 'wrap',
                width: '100%',
                boxSizing: 'border-box',
                flexShrink: 0
            }}>
                {/* Left: Brand Title & Apple Status LED */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 12px #22c55e',
                            display: 'inline-block'
                        }}></span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.015em' }}>
                                {t('interrogationsLogTitle') || 'Registro de Interrogatorios'}
                            </h2>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                <span>Total: <strong style={{ color: '#60a5fa' }}>{interrogations.length}</strong></span>
                                <span>•</span>
                                <span>Con Grabación: <strong style={{ color: '#4ade80' }}>{withMediaCount}</strong></span>
                                <span>•</span>
                                <span>Resultados: <strong style={{ color: '#f1f5f9' }}>{filteredItems.length}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Search & Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Clear URL ID parameter button */}
                    {searchParams.get('id') && (
                        <button
                            type="button"
                            onClick={clearIdFilter}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '0.38rem 1rem',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '20px',
                                color: '#cbd5e1',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {t('showAllBtn') || 'Mostrar todos'}
                        </button>
                    )}

                    {/* Apple Search Input */}
                    <div className="int-search-pill">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder={t('searchLogsPlaceholder') || 'Buscar registros, agente, sujeto...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={!!searchParams.get('id')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#fff',
                                fontSize: '0.82rem',
                                width: '100%',
                            }}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 }}
                            >✕</button>
                        )}
                    </div>

                    {/* New Interrogation Entry Button */}
                    {currentUser && (
                        <button
                            type="button"
                            className="int-new-btn"
                            onClick={openCreate}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {t('newEntryBtn') || 'Nuevo Registro'}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        {t('loadingLogs') || 'Cargando registros...'}
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem', paddingBottom: '1rem' }} className="custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="int-empty-state">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="int-empty-icon">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="22" />
                            </svg>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                {t('noInterrogationsFound') || 'No se encontraron registros de interrogatorios'}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {filteredItems.map(item => {
                                const isLongTranscription = item.transcription && item.transcription.length > 280;
                                const isExpanded = !!expandedCards[item.id];
                                const agentsList = item.agents_present ? item.agents_present.split(',').map(s => s.trim()).filter(Boolean) : [];
                                const subjectsList = item.subjects ? item.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

                                return (
                                    <div
                                        key={item.id}
                                        className="int-grid-card"
                                    >
                                        <div>
                                            {/* Window Top Controls & Date Badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                                {/* macOS window dots */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: '#94a3b8',
                                                        marginLeft: '6px',
                                                        letterSpacing: '0.03em'
                                                    }}>
                                                        #INT-{String(item.id).substring(0, 6).toUpperCase()}
                                                    </span>
                                                </div>

                                                {/* Date Badge */}
                                                <div style={{
                                                    background: 'rgba(59, 130, 246, 0.12)',
                                                    color: '#60a5fa',
                                                    padding: '3px 9px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                        <line x1="16" y1="2" x2="16" y2="6" />
                                                        <line x1="8" y1="2" x2="8" y2="6" />
                                                        <line x1="3" y1="10" x2="21" y2="10" />
                                                    </svg>
                                                    {item.interrogation_date}
                                                </div>
                                            </div>

                                            {/* Interrogation Title */}
                                            <h3 style={{
                                                margin: '0 0 0.75rem 0',
                                                fontSize: '1.1rem',
                                                fontWeight: 700,
                                                color: '#f8fafc',
                                                lineHeight: 1.35,
                                                letterSpacing: '-0.01em'
                                            }}>
                                                {item.title}
                                            </h3>

                                            {/* Metadata Grid (Agents & Subjects) */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
                                                {/* Agents Present */}
                                                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                        {t('agentsLabel') || 'Agentes Presentes'}
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {agentsList.length > 0 ? (
                                                            agentsList.map((agent, aIdx) => (
                                                                <span key={aIdx} style={{
                                                                    background: 'rgba(251, 191, 36, 0.1)',
                                                                    color: '#fef08a',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.72rem',
                                                                    border: '1px solid rgba(251, 191, 36, 0.2)',
                                                                    fontWeight: 500
                                                                }}>
                                                                    {agent}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Subjects Interrogated */}
                                                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                            <circle cx="9" cy="7" r="4" />
                                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                        </svg>
                                                        {t('subjectsLabel') || 'Sujetos Interrogados'}
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {subjectsList.length > 0 ? (
                                                            subjectsList.map((subj, sIdx) => (
                                                                <span key={sIdx} style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    color: '#fca5a5',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.72rem',
                                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                    fontWeight: 500
                                                                }}>
                                                                    {subj}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N/A</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Transcription / Notes Section */}
                                            {item.transcription && (
                                                <div style={{
                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                    padding: '0.75rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                                    marginBottom: '0.85rem'
                                                }}>
                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                                        📝 {t('transcriptionNotesLabel') || 'Transcripción y Notas'}
                                                    </div>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '0.83rem',
                                                        color: '#cbd5e1',
                                                        lineHeight: 1.45,
                                                        whiteSpace: 'pre-line',
                                                        maxHeight: (!isExpanded && isLongTranscription) ? '120px' : 'none',
                                                        overflow: 'hidden',
                                                        position: 'relative'
                                                    }}>
                                                        {item.transcription}
                                                    </p>
                                                    {isLongTranscription && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCardExpanded(item.id)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: '#60a5fa',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                marginTop: '4px',
                                                                padding: 0
                                                            }}
                                                        >
                                                            {isExpanded ? 'Mostrar menos ▲' : 'Mostrar más ▼'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Recording Link Pill */}
                                            {item.media_url && (
                                                <div style={{ marginBottom: '0.85rem' }}>
                                                    <a
                                                        href={item.media_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            background: 'rgba(99, 102, 241, 0.15)',
                                                            color: '#a5b4fc',
                                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                                            padding: '5px 12px',
                                                            borderRadius: '20px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            textDecoration: 'none',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                            <polygon points="5 3 19 12 5 21 5 3" />
                                                        </svg>
                                                        {t('viewRecordingBtn') || 'Ver / Escuchar Grabación'}
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Footer: Author & Actions */}
                                        <div style={{
                                            display: 'flex',
                                            justify: 'space-between',
                                            alignItems: 'center',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                            paddingTop: '0.65rem',
                                            marginTop: '0.35rem'
                                        }}>
                                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span>{t('filedByLabel') || 'Archivado por:'}</span>
                                                <strong style={{ color: '#e2e8f0' }}>{item.author_name || 'Agente'}</strong>
                                            </div>

                                            {item.can_edit && (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(item)}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.06)',
                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                            color: '#60a5fa',
                                                            borderRadius: '8px',
                                                            width: '28px',
                                                            height: '28px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justify: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title={t('editLogTitle') || 'Editar'}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item.id)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                                            color: '#f87171',
                                                            borderRadius: '8px',
                                                            width: '28px',
                                                            height: '28px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justify: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title="Eliminar"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* macOS Style Modal Window */}
            {showModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '750px',
                        width: '92vw',
                        maxHeight: '88vh',
                        overflowY: 'auto',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        {/* Titlebar with window dots */}
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowModal(false)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {modalMode === 'create' ? (t('newInterrogationLogTitle') || 'Nuevo Registro de Interrogatorio') : (t('editLogTitle') || 'Editar Interrogatorio')}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleAction} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Date & Title inputs */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.85rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('dateLabel') || 'Fecha'}
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '10px',
                                            color: '#ffffff',
                                            fontSize: '0.88rem',
                                            padding: '0.65rem 0.9rem'
                                        }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('titleTemplateLabel') || 'Título del Interrogatorio'}
                                    </label>
                                    <input
                                        className="form-input"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ej: Toma de declaración John Doe"
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '10px',
                                            color: '#ffffff',
                                            fontSize: '0.88rem',
                                            padding: '0.65rem 0.9rem'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Custom Agent Selector Grid */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', marginBottom: '0.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                    {t('agentsPresentLabel') || 'Seleccionar Agentes Presentes'}
                                </label>
                                <div className="custom-scrollbar" style={{
                                    border: '1px solid rgba(255, 255, 255, 0.16)',
                                    borderRadius: '12px',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.65)',
                                    maxHeight: '190px',
                                    overflowY: 'auto',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                                    gap: '0.5rem'
                                }}>
                                    {personnel.map(p => {
                                        const fullName = `${p.rango} ${p.nombre} ${p.apellido}`;
                                        const isSelected = selectedAgents.includes(fullName);
                                        return (
                                            <div
                                                key={p.no_placa + p.nombre}
                                                onClick={() => toggleAgent(fullName)}
                                                style={{
                                                    padding: '0.45rem 0.65rem',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.78rem',
                                                    border: isSelected ? '1px solid rgba(251, 191, 36, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    background: isSelected ? 'rgba(251, 191, 36, 0.16)' : 'rgba(30, 41, 59, 0.6)',
                                                    color: isSelected ? '#fef08a' : '#cbd5e1',
                                                    transition: 'all 0.18s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <div style={{
                                                    width: '15px',
                                                    height: '15px',
                                                    borderRadius: '4px',
                                                    border: isSelected ? '1px solid #fbbf24' : '1px solid #64748b',
                                                    background: isSelected ? '#fbbf24' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justify: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {isSelected && <span style={{ color: '#0f172a', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                                                </div>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {fullName}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                                    {t('selectedLabel') || 'Seleccionados:'} {selectedAgents.length > 0 ? (
                                        <strong style={{ color: '#fbbf24' }}>{selectedAgents.join(', ')}</strong>
                                    ) : (
                                        <em>{t('noneSelected') || 'Ninguno'}</em>
                                    )}
                                </div>
                            </div>

                            {/* Subjects Interrogated Input */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    {t('subjectsInterrogatedLabel') || 'Sujeto(s) Interrogados'}
                                </label>
                                <input
                                    className="form-input"
                                    placeholder="Ej: John Doe, Mark Smith"
                                    value={formData.subjects}
                                    onChange={e => setFormData({ ...formData, subjects: e.target.value })}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                            </div>

                            {/* Transcription & Relevant Info */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    {t('relevantInfoLabel') || 'Transcripción y Notas Relevantes'}
                                </label>
                                <textarea
                                    className="eval-textarea"
                                    rows="7"
                                    placeholder={t('enterNotesPlaceholder') || 'Escribe las notas de la declaración, preguntas clave, confesión...'}
                                    value={formData.transcription}
                                    onChange={e => setFormData({ ...formData, transcription: e.target.value })}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        padding: '0.65rem 0.9rem',
                                        lineHeight: 1.5
                                    }}
                                />
                            </div>

                            {/* Media Recording URL */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    {t('recordingLinkLabel') || 'Enlace a Grabación de Audio / Video'}
                                </label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://drive.google.com/... o https://youtube.com/..."
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                            </div>

                            {/* Modal Actions Footer */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="login-button btn-secondary"
                                    onClick={() => setShowModal(false)}
                                    style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}
                                >
                                    {t('cancelBtnLog') || 'Cancelar'}
                                </button>
                                <button
                                    type="submit"
                                    className="login-button"
                                    disabled={submitLoading}
                                    style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }}
                                >
                                    {submitLoading ? 'Guardando...' : (t('saveLogBtn') || 'Guardar Registro')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Interrogations;


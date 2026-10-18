import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function DOJInterrogations() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [interrogations, setInterrogations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Personnel State (for Agent Selection)
    const [personnel, setPersonnel] = useState([]);
    const [agentSearch, setAgentSearch] = useState('');

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
        url: '',
        case_id: ''
    });
    const [selectedAgents, setSelectedAgents] = useState([]);
    const [expandedCards, setExpandedCards] = useState({});
    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        loadData();
        fetchPersonnel();
        fetchDOJCases();
    }, []);

    useEffect(() => {
        const searchVal = searchParams.get('search');
        const idVal = searchParams.get('id');
        if (searchVal) {
            setSearchTerm(searchVal);
        } else if (idVal && interrogations.length > 0) {
            const item = interrogations.find(i => String(i.id) === String(idVal));
            if (item) {
                setSearchTerm(item.title);
            }
        }
    }, [searchParams, interrogations]);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_doj_interrogations', { p_case_id: null });
            if (error) throw error;
            setInterrogations(data || []);
        } catch (err) {
            console.error('Error loading DOJ interrogations:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDOJCases = async () => {
        try {
            const { data } = await supabase.from('doj_cases').select('id, case_number, title').order('case_number', { ascending: false });
            setCases(data || []);
        } catch (err) {
            console.error('Error fetching cases for selector:', err);
        }
    };

    const fetchPersonnel = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, nombre, apellido, rango, no_placa, divisions, rol')
                .order('nombre');

            if (error) throw error;

            if (data) {
                const dojUsers = data.filter(u =>
                    (u.divisions && u.divisions.includes('DOJ')) ||
                    u.rol === 'Administrador'
                );

                const rankPriority = {
                    'Sheriff': 150,
                    'Undersheriff': 140,
                    'Assistant Sheriff': 130,
                    'Division Chief': 120,
                    'Comandante': 110,
                    'Capitan': 100,
                    'Teniente': 90,
                    'Department of Justice Agent': 88,
                    'Internal Affairs Agent': 87,
                    'SEB Agent': 86,
                    'ASD Agent': 86,
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

                const sorted = dojUsers.sort((a, b) => {
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
        setEditingId(null);
        setFormData({
            title: '',
            date: new Date().toISOString().split('T')[0],
            agents: '',
            subjects: '',
            transcription: '',
            url: '',
            case_id: ''
        });
        setSelectedAgents([]);
        setAgentSearch('');
        setShowModal(true);
    };

    const openEdit = (item) => {
        setModalMode('update');
        setEditingId(item.id);

        const currentAgents = item.agents_present
            ? item.agents_present.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        setSelectedAgents(currentAgents);
        setFormData({
            title: item.title,
            date: item.interrogation_date || new Date().toISOString().split('T')[0],
            agents: item.agents_present || '',
            subjects: item.subjects || '',
            transcription: item.transcription || '',
            url: item.meddoj_url || '',
            case_id: item.case_id || ''
        });
        setAgentSearch('');
        setShowModal(true);
    };

    const toggleAgentSelection = (agentName) => {
        let updated;
        if (selectedAgents.includes(agentName)) {
            updated = selectedAgents.filter(name => name !== agentName);
        } else {
            updated = [...selectedAgents, agentName];
        }
        setSelectedAgents(updated);
        setFormData(prev => ({
            ...prev,
            agents: updated.join(', ')
        }));
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);

        const finalAgents = selectedAgents.join(', ');

        try {
            const { error } = await supabase.rpc('manage_doj_interrogation', {
                p_action: modalMode,
                p_id: editingId,
                p_title: formData.title,
                p_date: formData.date,
                p_agents: finalAgents,
                p_subjects: formData.subjects,
                p_transcription: formData.transcription,
                p_url: formData.url,
                p_case_id: formData.case_id || null
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
        if (!window.confirm(language === 'es' ? "¿Eliminar este registro de interrogatorio?" : "Delete this interrogation record?")) return;
        try {
            const { error } = await supabase.rpc('manage_doj_interrogation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    const toggleCardExpand = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredItems = interrogations.filter(item => {
        const q = searchTerm.toLowerCase();
        return (
            item.title?.toLowerCase().includes(q) ||
            item.subjects?.toLowerCase().includes(q) ||
            item.agents_present?.toLowerCase().includes(q)
        );
    });

    const filteredPersonnel = personnel.filter(p => {
        const fullName = `${p.rango} ${p.nombre} ${p.apellido}`.toLowerCase();
        return fullName.includes(agentSearch.toLowerCase());
    });

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Command Header Banner */}
            <div 
                className="mac-command-banner" 
                style={{
                    marginBottom: '1.75rem',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <img
                        src="/logowebp/doj-logo.webp"
                        alt="DOJ Logo"
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 14px rgba(16, 185, 129, 0.35))' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/logowebp/dojlogo.webp";
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/doj')}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '20px',
                                    padding: '0.2rem 0.65rem',
                                    color: '#cbd5e1',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al DOJ' : 'DOJ Hub'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'Registro Pericial & Deposiciones' : 'Subject Interviews & Depositions'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'INTERROGATORIOS Y ACTAS JUDICIALES' : 'DOJ INTERROGATIONS REGISTRY'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div className="mac-input-with-icon" style={{ width: '260px' }}>
                        <span className="mac-input-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="mac-form-input has-icon"
                            style={{ padding: '0.55rem 0.85rem 0.55rem 2.6rem', fontSize: '0.85rem' }}
                            placeholder={language === 'es' ? "Buscar por sujeto o acta..." : "Search subjects, agents..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* New Interrogation Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={openCreate}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.6rem 1.1rem',
                            background: 'rgba(16, 185, 129, 0.25)',
                            border: '1px solid rgba(16, 185, 129, 0.5)',
                            color: '#6ee7b7',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nueva Acta' : 'New Interrogation'}</span>
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#10b981', width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginBottom: '0.5rem' }}></span>
                    <div>{language === 'es' ? 'Cargando actas de interrogatorios...' : 'Loading interrogation registry...'}</div>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                        {language === 'es' ? 'No se encontraron actas de interrogatorio' : 'No interrogations found'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Pulse el botón superior para registrar una nueva diligencia' : 'Click the button above to log a new interrogation'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {filteredItems.map(item => {
                        const isExpanded = !!expandedCards[item.id];
                        return (
                            <div
                                key={item.id}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderLeft: '4px solid #10b981',
                                    borderRadius: '18px',
                                    padding: '1.4rem 1.6rem',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.4)'
                                }}
                            >
                                {/* Top Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            padding: '0.2rem 0.65rem',
                                            borderRadius: '9999px',
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            border: '1px solid rgba(16, 185, 129, 0.35)',
                                            color: '#34d399'
                                        }}>
                                            📅 {item.interrogation_date}
                                        </span>

                                        {item.linked_case_number && (
                                            <span 
                                                onClick={() => navigate(`/doj/cases/${item.case_id}`)}
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    padding: '0.2rem 0.65rem',
                                                    borderRadius: '9999px',
                                                    background: 'rgba(59, 130, 246, 0.15)',
                                                    border: '1px solid rgba(59, 130, 246, 0.35)',
                                                    color: '#60a5fa',
                                                    cursor: 'pointer'
                                                }}
                                                title={language === 'es' ? 'Ir al sumario vinculado' : 'View linked case'}
                                            >
                                                🔗 DOJ-CASE #{String(item.linked_case_number).padStart(3, '0')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Edit / Delete actions */}
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <button
                                            onClick={() => openEdit(item)}
                                            title={language === 'es' ? 'Editar' : 'Edit'}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: '#cbd5e1',
                                                borderRadius: '8px',
                                                padding: '0.3rem 0.55rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            title={language === 'es' ? 'Eliminar' : 'Delete'}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                borderRadius: '8px',
                                                padding: '0.3rem 0.55rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Title */}
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 1rem 0', letterSpacing: '-0.015em' }}>
                                    {item.title}
                                </h3>

                                {/* Meta Grid */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                    gap: '0.85rem',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '12px',
                                    padding: '0.85rem 1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                            {language === 'es' ? 'Sujetos Declarantes / Imputados' : 'Interviewed Subjects'}
                                        </div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>
                                            {item.subjects || 'N/A'}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                            {language === 'es' ? 'Fiscales / Agentes Presentes' : 'Agents Present'}
                                        </div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#cbd5e1' }}>
                                            {item.agents_present || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* Transcription / Notes Preview */}
                                {item.transcription && (
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.15)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '10px',
                                        padding: '0.85rem 1rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                                            {language === 'es' ? 'Transcripción & Resumen Pericial' : 'Deposition Summary & Notes'}
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.86rem',
                                            lineHeight: 1.55,
                                            color: '#cbd5e1',
                                            whiteSpace: 'pre-line',
                                            maxHeight: isExpanded ? 'none' : '90px',
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}>
                                            {item.transcription}
                                        </p>
                                        {item.transcription.length > 200 && (
                                            <button
                                                type="button"
                                                onClick={() => toggleCardExpand(item.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#34d399',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    padding: '0.4rem 0 0 0',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {isExpanded ? (language === 'es' ? 'Mostrar menos ▲' : 'Show less ▲') : (language === 'es' ? 'Leer transcripción completa ▼' : 'Read full deposition ▼')}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Footer Links & Meta */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                    {item.meddoj_url ? (
                                        <a
                                            href={item.meddoj_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                background: 'rgba(16, 185, 129, 0.15)',
                                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                                color: '#34d399',
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="5 3 19 12 5 21 5 3"/>
                                            </svg>
                                            <span>{language === 'es' ? 'Ver Grabación / Evidencia Audiovisual ↗' : 'View Recording / Footage ↗'}</span>
                                        </a>
                                    ) : (
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                            {language === 'es' ? 'Sin grabación externa' : 'No external audio link'}
                                        </span>
                                    )}

                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {language === 'es' ? 'Registrado por:' : 'Filed by:'} <strong style={{ color: '#94a3b8' }}>{item.author_name || 'DOJ Officer'}</strong>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* macOS Modal: Create / Edit Interrogation */}
            {showModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div
                        className="mac-modal-container"
                        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                DOJ • DEPOSITION LOG
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                            {modalMode === 'create'
                                ? (language === 'es' ? 'Registro de Nueva Acta de Interrogatorio' : 'Register New Deposition')
                                : (language === 'es' ? 'Modificar Acta de Interrogatorio' : 'Edit Deposition')}
                        </h2>
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
                            {language === 'es' 
                                ? 'Documente las declaraciones de los sujetos, fiscales intervinientes y grabaciones.' 
                                : 'Log subject depositions, interviewing agents, and recordings.'}
                        </p>

                        <form onSubmit={handleAction}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Fecha de la Diligencia *' : 'Date *'}</label>
                                    <input
                                        type="date"
                                        className="mac-form-input"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Vincular a Sumario (Opcional)' : 'Link to Case (Optional)'}</label>
                                    <select
                                        className="mac-form-select"
                                        value={formData.case_id}
                                        onChange={e => setFormData({ ...formData, case_id: e.target.value })}
                                    >
                                        <option value="">{language === 'es' ? '-- Sin sumario vinculado --' : '-- No case linked --'}</option>
                                        {cases.map(c => (
                                            <option key={c.id} value={c.id}>
                                                DOJ-CASE #{String(c.case_number).padStart(3, '0')} - {c.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Título / Asunto del Interrogatorio *' : 'Interrogation Title *'}
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    required
                                    placeholder={language === 'es' ? "Ej: 14/10/2026 — Interrogatorio a John Doe (Fraude Fiscal)" : "e.g. 10/14/2026 - Deposition: John Doe"}
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Sujetos Interrogados / Imputados *' : 'Interrogated Subjects *'}
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    required
                                    placeholder={language === 'es' ? "Ej: John Doe, Marcus Vance" : "e.g. Subject Full Name(s)"}
                                    value={formData.subjects}
                                    onChange={e => setFormData({ ...formData, subjects: e.target.value })}
                                />
                            </div>

                            {/* Custom Multi-Agent Selector */}
                            <div className="mac-form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label className="mac-form-label" style={{ margin: 0 }}>
                                        {language === 'es' ? 'Fiscales / Agentes Presentes' : 'Agents Present'}
                                    </label>
                                    <span style={{ fontSize: '0.74rem', color: '#60a5fa', fontWeight: 600 }}>
                                        {selectedAgents.length} {language === 'es' ? 'seleccionados' : 'selected'}
                                    </span>
                                </div>

                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder={language === 'es' ? "Filtrar por nombre o rango..." : "Filter agent by name..."}
                                    value={agentSearch}
                                    onChange={e => setAgentSearch(e.target.value)}
                                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}
                                />

                                <div style={{
                                    maxHeight: '140px',
                                    overflowY: 'auto',
                                    background: 'rgba(0, 0, 0, 0.35)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '0.5rem',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                    gap: '0.4rem'
                                }}>
                                    {filteredPersonnel.map(p => {
                                        const fullName = `${p.rango} ${p.nombre} ${p.apellido}`;
                                        const isSelected = selectedAgents.includes(fullName);
                                        return (
                                            <div
                                                key={p.id || fullName}
                                                onClick={() => toggleAgentSelection(fullName)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.35rem 0.55rem',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                                    border: isSelected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent'
                                                }}
                                            >
                                                <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#10b981', pointerEvents: 'none' }} />
                                                <span style={{ fontSize: '0.8rem', color: isSelected ? '#ffffff' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {fullName}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Transcripción de la Declaración & Notas' : 'Deposition Transcription & Summary'}
                                </label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows="5"
                                    placeholder={language === 'es' ? "Detalle las preguntas, respuestas, confesiones y manifestaciones del declarante..." : "Enter questioning transcription, testimony and evidence details..."}
                                    value={formData.transcription}
                                    onChange={e => setFormData({ ...formData, transcription: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Enlace a Grabación / Audiovisual (Opcional)' : 'Recording Video / Audio Link (Optional)'}
                                </label>
                                <input
                                    type="url"
                                    className="mac-form-input"
                                    placeholder="https://..."
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                />
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitLoading}
                                    style={{
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        cursor: submitLoading ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                                    }}
                                >
                                    {submitLoading ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar Acta' : 'Save Record')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJInterrogations;

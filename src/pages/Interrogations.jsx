import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import {
    DEFAULT_WIPE_FOLDER,
    getActiveInterrogationsWipeFolder,
    setActiveInterrogationsWipeFolder,
    getInterrogationsWipeFoldersList,
    createInterrogationsWipeFolder,
    deleteInterrogationsWipeFolder,
    moveInterrogationsToWipeFolder,
    getInterrogationsWipeFoldersStats
} from '../services/interrogationsWipeService';
import '../index.css';

function Interrogations() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useLanguage();
    const [interrogations, setInterrogations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // --- WIPE MANAGEMENT STATE ---
    const [activeWipeFolder, setActiveWipeFolderState] = useState(DEFAULT_WIPE_FOLDER);
    const [viewingWipeFolder, setViewingWipeFolder] = useState(DEFAULT_WIPE_FOLDER);
    const [wipeFolders, setWipeFolders] = useState([DEFAULT_WIPE_FOLDER]);
    const [wipeStats, setWipeStats] = useState({});
    const [selectedInterrogationIds, setSelectedInterrogationIds] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [showWipeManagerModal, setShowWipeManagerModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [newWipeFolderName, setNewWipeFolderName] = useState('');
    const [targetMoveFolder, setTargetMoveFolder] = useState('');
    const [isCreatingNewMoveFolder, setIsCreatingNewMoveFolder] = useState(false);
    const [moveMode, setMoveMode] = useState('selected'); // 'selected' | 'all'
    const [wipeActionLoading, setWipeActionLoading] = useState(false);

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

    const isAdmin = Boolean(
        currentUser && (
            (currentUser.rol || '').toLowerCase().trim() === 'administrador' ||
            (currentUser.rol || '').toLowerCase().trim() === 'superadmin' ||
            (currentUser.rol || '').toLowerCase().includes('admin')
        )
    );
    const isAyudante = (currentUser?.rol || '').toLowerCase().trim() === 'ayudante';

    useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            let uProfile = null;
            if (user) {
                const { data } = await supabase.from('users').select('id, rol').eq('id', user.id).single();
                uProfile = data;
                if (isMounted) setCurrentUser(data);
            }

            const activeWipe = await getActiveInterrogationsWipeFolder();
            const folders = await getInterrogationsWipeFoldersList();
            const stats = await getInterrogationsWipeFoldersStats();

            if (isMounted) {
                setActiveWipeFolderState(activeWipe);
                setViewingWipeFolder(activeWipe);
                setWipeFolders(folders);
                setWipeStats(stats);
                loadData(activeWipe, uProfile);
                fetchPersonnel();
            }
        };
        loadInitial();
        return () => { isMounted = false; };
    }, []);

    // Re-fetch when viewingWipeFolder changes
    useEffect(() => {
        if (currentUser) {
            loadData(viewingWipeFolder);
        }
    }, [viewingWipeFolder]);

    const loadData = async (targetWipe = viewingWipeFolder, userProfile = currentUser) => {
        try {
            setLoading(true);
            const user = userProfile || currentUser;
            const userIsAdmin = Boolean(
                user && (
                    (user.rol || '').toLowerCase().trim() === 'administrador' ||
                    (user.rol || '').toLowerCase().trim() === 'superadmin' ||
                    (user.rol || '').toLowerCase().includes('admin')
                )
            );

            const wipeToQuery = userIsAdmin
                ? (targetWipe || activeWipeFolder || DEFAULT_WIPE_FOLDER)
                : (activeWipeFolder || DEFAULT_WIPE_FOLDER);

            const [rpcRes, wipesRes] = await Promise.allSettled([
                supabase.rpc('get_interrogations', {}),
                supabase.from('interrogations').select('id, wipe_folder')
            ]);

            const wipeMap = new Map();
            if (wipesRes.status === 'fulfilled' && wipesRes.value?.data) {
                wipesRes.value.data.forEach(r => {
                    wipeMap.set(r.id, (r.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER);
                });
            }

            const rawData = (rpcRes.status === 'fulfilled' && !rpcRes.value.error)
                ? (rpcRes.value.data || [])
                : [];

            const enriched = rawData.map(item => {
                const folder = (item.wipe_folder || wipeMap.get(item.id) || DEFAULT_WIPE_FOLDER).trim();
                return { ...item, wipe_folder: folder };
            });

            const filtered = enriched.filter(item => {
                const f = item.wipe_folder || DEFAULT_WIPE_FOLDER;
                if (wipeToQuery === DEFAULT_WIPE_FOLDER) {
                    return !f || f === DEFAULT_WIPE_FOLDER;
                }
                return f.toLowerCase() === wipeToQuery.toLowerCase();
            });

            setInterrogations(filtered);

            // Update stats
            const stats = await getInterrogationsWipeFoldersStats();
            setWipeStats(stats);
        } catch (err) {
            console.error('Error loading interrogations:', err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeViewingWipe = (newFolder) => {
        setViewingWipeFolder(newFolder);
        setSelectedInterrogationIds([]);
    };

    const handleMakeActiveWipe = async (folder) => {
        if (!folder) return;
        setWipeActionLoading(true);
        try {
            await setActiveInterrogationsWipeFolder(folder);
            setActiveWipeFolderState(folder);
            alert(`Carpeta "${folder}" establecida como la carpeta activa visible para todos los agentes.`);
        } catch (err) {
            alert('Error al establecer carpeta activa: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleCreateNewFolder = async () => {
        const clean = newWipeFolderName.trim();
        if (!clean) return;
        setWipeActionLoading(true);
        try {
            const updated = await createInterrogationsWipeFolder(clean);
            setWipeFolders(updated);
            setNewWipeFolderName('');
            setViewingWipeFolder(clean);
            await loadData(clean);
            alert(`Carpeta "${clean}" creada correctamente.`);
        } catch (err) {
            alert('Error al crear carpeta: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleDeleteFolder = async (folder) => {
        if (folder === DEFAULT_WIPE_FOLDER) {
            alert('No puedes eliminar la carpeta base "Actual".');
            return;
        }
        if (!window.confirm(`¿Estás seguro de eliminar la carpeta "${folder}"? Los interrogatorios en esta carpeta volverán a la carpeta "Actual".`)) {
            return;
        }
        setWipeActionLoading(true);
        try {
            const updated = await deleteInterrogationsWipeFolder(folder, DEFAULT_WIPE_FOLDER);
            setWipeFolders(updated);
            if (viewingWipeFolder === folder) {
                setViewingWipeFolder(DEFAULT_WIPE_FOLDER);
                await loadData(DEFAULT_WIPE_FOLDER);
            } else {
                const stats = await getInterrogationsWipeFoldersStats();
                setWipeStats(stats);
            }
            alert(`Carpeta "${folder}" eliminada.`);
        } catch (err) {
            alert('Error al eliminar carpeta: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleOpenMoveModal = (scope = 'all') => {
        setMoveMode(scope);
        const diffFolder = wipeFolders.find(f => f !== viewingWipeFolder) || '';
        setTargetMoveFolder(diffFolder);
        setIsCreatingNewMoveFolder(false);
        setShowMoveModal(true);
    };

    const handleExecuteMove = async () => {
        const finalTarget = (targetMoveFolder || '').trim();
        if (!finalTarget) {
            alert('Selecciona o escribe una carpeta de destino válida.');
            return;
        }
        if (finalTarget === viewingWipeFolder && moveMode === 'all') {
            alert('La carpeta de destino debe ser diferente a la carpeta actual.');
            return;
        }
        setWipeActionLoading(true);
        try {
            if (moveMode === 'selected') {
                if (selectedInterrogationIds.length === 0) {
                    alert('No hay interrogatorios seleccionados.');
                    setWipeActionLoading(false);
                    return;
                }
                await moveInterrogationsToWipeFolder({
                    interrogationIds: selectedInterrogationIds,
                    targetFolder: finalTarget
                });
            } else {
                await moveInterrogationsToWipeFolder({
                    interrogationIds: 'all',
                    targetFolder: finalTarget,
                    sourceFolder: viewingWipeFolder
                });
            }

            const folders = await getInterrogationsWipeFoldersList();
            setWipeFolders(folders);
            setSelectedInterrogationIds([]);
            setSelectionMode(false);
            setShowMoveModal(false);
            await loadData(viewingWipeFolder);
            alert(`Interrogatorios trasladados exitosamente a la carpeta "${finalTarget}".`);
        } catch (err) {
            alert('Error al mover interrogatorios: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const toggleInterrogationSelection = (id) => {
        setSelectedInterrogationIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectAllInterrogations = () => {
        setSelectedInterrogationIds(filteredItems.map(i => i.id));
    };

    const deselectAllInterrogations = () => {
        setSelectedInterrogationIds([]);
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
                    'ASD Agent': 86,
                    'Department of Justice Agent': 85,
                    'Detective III': 80,
                    'Sargento II': 75,
                    'Detective II': 70,
                    'Sargento I': 65,
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

            if (modalMode === 'create') {
                const folderToAssign = viewingWipeFolder || activeWipeFolder || DEFAULT_WIPE_FOLDER;
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.id) {
                    const { data: latest } = await supabase
                        .from('interrogations')
                        .select('id')
                        .eq('author_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (latest && latest[0]) {
                        await supabase
                            .from('interrogations')
                            .update({ wipe_folder: folderToAssign })
                            .eq('id', latest[0].id);
                    }
                }
            }

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
                    {/* WIPE CONTROLS FOR ADMINS DIRECTLY IN NAVBAR */}
                    {isAdmin && !isAyudante && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'rgba(0, 0, 0, 0.45)',
                                border: viewingWipeFolder !== activeWipeFolder ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '20px',
                                padding: '0.22rem 0.65rem',
                                gap: '0.35rem'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: viewingWipeFolder !== activeWipeFolder ? '#fbbf24' : '#94a3b8' }}>📁</span>
                                <select
                                    className="mac-select"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: viewingWipeFolder !== activeWipeFolder ? '#fcd34d' : '#ffffff',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        outline: 'none',
                                        padding: '0.1rem 0.2rem'
                                    }}
                                    value={viewingWipeFolder}
                                    onChange={(e) => handleChangeViewingWipe(e.target.value)}
                                    title="Carpeta de Wipe de interrogatorios"
                                >
                                    {wipeFolders.map(folder => (
                                        <option key={folder} value={folder} style={{ background: '#1e293b', color: '#fff' }}>
                                            {folder === activeWipeFolder ? `⭐ ${folder} (Activa)` : `📁 ${folder}`}
                                            {wipeStats[folder]?.total != null ? ` (${wipeStats[folder].total})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                className={`mac-btn ${selectionMode ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.18)' }}
                                onClick={() => {
                                    setSelectionMode(!selectionMode);
                                    if (selectionMode) setSelectedInterrogationIds([]);
                                }}
                                title="Seleccionar interrogatorios a dedo"
                            >
                                {selectionMode ? '✕ Cancelar' : '☑️ Seleccionar'}
                            </button>

                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.18)' }}
                                onClick={() => handleOpenMoveModal('all')}
                                title="Almacenar interrogatorios de esta carpeta en otra"
                            >
                                📦 Mover
                            </button>

                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.18)' }}
                                onClick={() => setShowWipeManagerModal(true)}
                                title="Gestión de carpetas de Wipe"
                            >
                                ⚙️ Wipes
                            </button>
                        </div>
                    )}

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

            {/* Selection Toolbar (When selectionMode is active) */}
            {isAdmin && !isAyudante && selectionMode && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    padding: '0.55rem 1rem',
                    marginBottom: '0.75rem',
                    flexShrink: 0,
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 700 }}>
                            ☑️ {selectedInterrogationIds.length} seleccionado(s)
                        </span>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                            onClick={selectAllInterrogations}
                        >
                            Seleccionar todos
                        </button>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                            onClick={deselectAllInterrogations}
                        >
                            Deseleccionar
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-primary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
                            disabled={selectedInterrogationIds.length === 0}
                            onClick={() => handleOpenMoveModal('selected')}
                        >
                            📦 Mover seleccionados a...
                        </button>
                    </div>
                </div>
            )}

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
                                const isSelected = selectedInterrogationIds.includes(item.id);

                                return (
                                    <div
                                        key={item.id}
                                        className="int-grid-card"
                                        onClick={() => {
                                            if (selectionMode) {
                                                toggleInterrogationSelection(item.id);
                                            }
                                        }}
                                        style={{
                                            cursor: selectionMode ? 'pointer' : 'default',
                                            boxShadow: isSelected
                                                ? '0 0 0 2px #10b981, 0 8px 24px rgba(16, 185, 129, 0.25)'
                                                : undefined
                                        }}
                                    >
                                        <div>
                                            {/* Window Top Controls & Date Badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                                {/* macOS window dots */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {isAdmin && selectionMode && (
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(isSelected)}
                                                            onChange={() => toggleInterrogationSelection(item.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                accentColor: '#10b981',
                                                                cursor: 'pointer',
                                                                marginRight: '6px'
                                                            }}
                                                            title="Seleccionar interrogatorio"
                                                        />
                                                    )}
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
                                                    {isAdmin && item.wipe_folder && item.wipe_folder !== 'Actual' && (
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            padding: '0.12rem 0.45rem',
                                                            borderRadius: '4px',
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            color: '#94a3b8',
                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                            marginLeft: '6px'
                                                        }} title={`Carpeta de wipe: ${item.wipe_folder}`}>
                                                            📁 {item.wipe_folder}
                                                        </span>
                                                    )}
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

            {/* Modal: Gestión de Carpetas de Wipe (ADMIN ONLY) */}
            {isAdmin && showWipeManagerModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '640px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowWipeManagerModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                ⚙️ Gestión de Wipes - Interrogatorios
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                marginBottom: '1.25rem',
                                fontSize: '0.82rem',
                                color: '#cbd5e1',
                                lineHeight: 1.5
                            }}>
                                💡 <strong>Sistema de Wipes de Interrogatorios:</strong> Solo los administradores pueden gestionar y alternar entre carpetas. Los agentes regulares siempre verán únicamente la carpeta marcada como <strong>⭐ Activa</strong>.
                            </div>

                            {/* Create New Folder Section */}
                            <div className="mac-form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>
                                    ➕ Crear Nueva Carpeta de Wipe
                                </label>
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <input
                                        type="text"
                                        className="mac-input"
                                        style={{ flex: 1 }}
                                        placeholder="Ej: Wipe 2026, Temporada 3, Wipe Invierno..."
                                        value={newWipeFolderName}
                                        onChange={(e) => setNewWipeFolderName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCreateNewFolder();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="mac-btn mac-btn-primary"
                                        style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                                        disabled={wipeActionLoading || !newWipeFolderName.trim()}
                                        onClick={handleCreateNewFolder}
                                    >
                                        Crear Carpeta
                                    </button>
                                </div>
                            </div>

                            {/* Existing Folders List */}
                            <label className="mac-form-label" style={{ fontSize: '0.84rem', marginBottom: '0.6rem', display: 'block' }}>
                                📁 Carpetas Registradas ({wipeFolders.length})
                            </label>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {wipeFolders.map(folder => {
                                    const isActive = folder === activeWipeFolder;
                                    const isViewing = folder === viewingWipeFolder;
                                    const stats = wipeStats[folder] || { total: 0, withMedia: 0 };

                                    return (
                                        <div
                                            key={folder}
                                            style={{
                                                background: isActive 
                                                    ? 'rgba(16, 185, 129, 0.08)' 
                                                    : 'rgba(0, 0, 0, 0.3)',
                                                border: isActive 
                                                    ? '1.5px solid rgba(16, 185, 129, 0.4)' 
                                                    : '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '12px',
                                                padding: '0.9rem 1.1rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.65rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                                                        {folder}
                                                    </span>

                                                    {isActive && (
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800,
                                                            color: '#34d399',
                                                            background: 'rgba(16, 185, 129, 0.2)',
                                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '9999px',
                                                            letterSpacing: '0.04em'
                                                        }}>
                                                            ★ ACTIVA EN LA WEB
                                                        </span>
                                                    )}

                                                    {isViewing && (
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            color: '#60a5fa',
                                                            background: 'rgba(59, 130, 246, 0.18)',
                                                            border: '1px solid rgba(59, 130, 246, 0.35)',
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '9999px'
                                                        }}>
                                                            👁️ Viendo ahora
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                    {!isViewing && (
                                                        <button
                                                            type="button"
                                                            className="mac-btn mac-btn-secondary"
                                                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                                                            onClick={() => {
                                                                handleChangeViewingWipe(folder);
                                                                setShowWipeManagerModal(false);
                                                            }}
                                                        >
                                                            👁️ Ver
                                                        </button>
                                                    )}

                                                    {!isActive && (
                                                        <button
                                                            type="button"
                                                            className="mac-btn mac-btn-primary"
                                                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem', background: '#059669' }}
                                                            disabled={wipeActionLoading}
                                                            onClick={() => handleMakeActiveWipe(folder)}
                                                        >
                                                            ⭐ Hacer Activa
                                                        </button>
                                                    )}

                                                    {folder !== DEFAULT_WIPE_FOLDER && (
                                                        <button
                                                            type="button"
                                                            className="mac-btn mac-btn-secondary"
                                                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem', color: '#f87171' }}
                                                            disabled={wipeActionLoading}
                                                            onClick={() => handleDeleteFolder(folder)}
                                                            title="Eliminar carpeta de wipe"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Folder Statistics */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                fontSize: '0.78rem',
                                                color: '#94a3b8',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                                paddingTop: '0.45rem',
                                                flexWrap: 'wrap'
                                            }}>
                                                <span><strong>Total:</strong> {stats.total} interrogatorio(s)</span>
                                                <span style={{ color: '#4ade80' }}>🎥 Con grabación: {stats.withMedia}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mac-modal-actions">
                            <button
                                type="button"
                                className="mac-btn mac-btn-primary"
                                onClick={() => setShowWipeManagerModal(false)}
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Move Interrogations into Wipe Folder (ADMIN ONLY) */}
            {isAdmin && showMoveModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '560px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowMoveModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                📦 Almacenar Interrogatorios en Wipe
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            {/* Scope Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">¿Qué interrogatorios deseas trasladar?</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {selectedInterrogationIds.length > 0 && (
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            background: moveMode === 'selected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)',
                                            border: moveMode === 'selected' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '0.65rem 0.85rem',
                                            cursor: 'pointer',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}>
                                            <input
                                                type="radio"
                                                name="moveMode"
                                                value="selected"
                                                checked={moveMode === 'selected'}
                                                onChange={() => setMoveMode('selected')}
                                            />
                                            <span>
                                                Mover los <strong>{selectedInterrogationIds.length}</strong> interrogatorios seleccionados a dedo
                                            </span>
                                        </label>
                                    )}

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        background: moveMode === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)',
                                        border: moveMode === 'all' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '0.65rem 0.85rem',
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}>
                                        <input
                                            type="radio"
                                            name="moveMode"
                                            value="all"
                                            checked={moveMode === 'all'}
                                            onChange={() => setMoveMode('all')}
                                        />
                                        <span>
                                            Mover <strong>TODOS</strong> los interrogatorios de la carpeta "{viewingWipeFolder}" (Total: {wipeStats[viewingWipeFolder]?.total || interrogations.length})
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Destination Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">Carpeta de Destino</label>
                                
                                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                    <button
                                        type="button"
                                        className={`mac-btn ${!isCreatingNewMoveFolder ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem' }}
                                        onClick={() => setIsCreatingNewMoveFolder(false)}
                                    >
                                        Elegir existente
                                    </button>
                                    <button
                                        type="button"
                                        className={`mac-btn ${isCreatingNewMoveFolder ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem' }}
                                        onClick={() => {
                                            setIsCreatingNewMoveFolder(true);
                                            setTargetMoveFolder('');
                                        }}
                                    >
                                        ➕ Crear nueva
                                    </button>
                                </div>

                                {!isCreatingNewMoveFolder ? (
                                    <select
                                        className="mac-select"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                        value={targetMoveFolder}
                                        onChange={(e) => setTargetMoveFolder(e.target.value)}
                                    >
                                        <option value="">-- Selecciona carpeta destino --</option>
                                        {wipeFolders.map(f => (
                                            <option key={f} value={f}>
                                                📁 {f} {f === activeWipeFolder ? '(Activa en web)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="mac-input"
                                        style={{ width: '100%' }}
                                        placeholder="Nombre de la nueva carpeta de wipe..."
                                        value={targetMoveFolder}
                                        onChange={(e) => setTargetMoveFolder(e.target.value)}
                                        autoFocus
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mac-modal-actions">
                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                onClick={() => setShowMoveModal(false)}
                                disabled={wipeActionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="mac-btn mac-btn-primary"
                                onClick={handleExecuteMove}
                                disabled={wipeActionLoading || !targetMoveFolder.trim()}
                            >
                                {wipeActionLoading ? 'Moviendo...' : 'Confirmar Traslado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Interrogations;


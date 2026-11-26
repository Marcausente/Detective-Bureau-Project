import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import {
    DEFAULT_WIPE_FOLDER,
    getActiveDOJInterrogationsWipeFolder,
    setActiveDOJInterrogationsWipeFolder,
    getDOJInterrogationsWipeFoldersList,
    createDOJInterrogationsWipeFolder,
    deleteDOJInterrogationsWipeFolder,
    moveDOJInterrogationsToWipeFolder,
    getDOJInterrogationsWipeFoldersStats
} from '../services/dojInterrogationsWipeService';
import '../index.css';

function DOJInterrogations() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [interrogations, setInterrogations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Wipe Management State
    const [activeWipeFolder, setActiveWipeFolderState] = useState(DEFAULT_WIPE_FOLDER);
    const [viewingWipeFolder, setViewingWipeFolder] = useState(DEFAULT_WIPE_FOLDER);
    const [wipeFolders, setWipeFolders] = useState([DEFAULT_WIPE_FOLDER]);
    const [wipeStats, setWipeStats] = useState({});
    const [selectedInterrogationIds, setSelectedInterrogationIds] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [showWipeManagerModal, setShowWipeManagerModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveMode, setMoveMode] = useState('all'); // 'all' | 'selected'
    const [targetMoveFolder, setTargetMoveFolder] = useState('');
    const [isCreatingNewMoveFolder, setIsCreatingNewMoveFolder] = useState(false);
    const [newWipeFolderName, setNewWipeFolderName] = useState('');
    const [wipeActionLoading, setWipeActionLoading] = useState(false);

    // Current user & admin check
    const [currentUser, setCurrentUser] = useState(null);
    const isAdmin = Boolean(
        currentUser && (
            (currentUser.rol || '').toLowerCase().trim() === 'administrador' ||
            (currentUser.rol || '').toLowerCase().trim() === 'superadmin' ||
            (currentUser.rol || '').toLowerCase().includes('admin')
        )
    );

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
        let isMounted = true;
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            let uProfile = null;
            if (user) {
                const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
                uProfile = data;
                if (isMounted) setCurrentUser(data);
            }
            const activeWipe = await getActiveDOJInterrogationsWipeFolder();
            const folders = await getDOJInterrogationsWipeFoldersList();
            const stats = await getDOJInterrogationsWipeFoldersStats();

            if (isMounted) {
                setActiveWipeFolderState(activeWipe);
                setViewingWipeFolder(activeWipe);
                setWipeFolders(folders);
                setWipeStats(stats);
                loadData(activeWipe, uProfile);
                fetchPersonnel();
                fetchDOJCases();
            }
        };
        init();
        return () => { isMounted = false; };
    }, []);

    // Re-fetch when viewingWipeFolder changes
    useEffect(() => {
        if (currentUser) {
            loadData(viewingWipeFolder);
        }
    }, [viewingWipeFolder]);

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
                supabase.rpc('get_doj_interrogations', { p_case_id: null }),
                supabase.from('doj_interrogations').select('id, wipe_folder')
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
            const stats = await getDOJInterrogationsWipeFoldersStats();
            setWipeStats(stats);
        } catch (err) {
            console.error('Error loading DOJ interrogations:', err);
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
            await setActiveDOJInterrogationsWipeFolder(folder);
            setActiveWipeFolderState(folder);
            alert(language === 'es'
                ? `Carpeta "${folder}" establecida como la carpeta activa visible para todos los agentes.`
                : `Folder "${folder}" set as the active folder visible to all agents.`);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleCreateNewFolder = async () => {
        const clean = newWipeFolderName.trim();
        if (!clean) return;
        setWipeActionLoading(true);
        try {
            const updated = await createDOJInterrogationsWipeFolder(clean);
            setWipeFolders(updated);
            setNewWipeFolderName('');
            setViewingWipeFolder(clean);
            await loadData(clean);
            alert(language === 'es' ? `Carpeta "${clean}" creada correctamente.` : `Folder "${clean}" created successfully.`);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleDeleteFolder = async (folder) => {
        if (folder === DEFAULT_WIPE_FOLDER) {
            alert(language === 'es' ? 'No puedes eliminar la carpeta base "Actual".' : 'Cannot delete the base "Actual" folder.');
            return;
        }
        const confirmMsg = language === 'es'
            ? `¿Estás seguro de eliminar la carpeta "${folder}"? Los interrogatorios en esta carpeta volverán a la carpeta "Actual".`
            : `Are you sure you want to delete folder "${folder}"? Interrogations in this folder will be moved to "Actual".`;
        if (!window.confirm(confirmMsg)) return;

        setWipeActionLoading(true);
        try {
            const updated = await deleteDOJInterrogationsWipeFolder(folder, DEFAULT_WIPE_FOLDER);
            setWipeFolders(updated);
            if (viewingWipeFolder === folder) {
                setViewingWipeFolder(DEFAULT_WIPE_FOLDER);
                await loadData(DEFAULT_WIPE_FOLDER);
            } else {
                const stats = await getDOJInterrogationsWipeFoldersStats();
                setWipeStats(stats);
            }
            alert(language === 'es' ? `Carpeta "${folder}" eliminada.` : `Folder "${folder}" deleted.`);
        } catch (err) {
            alert('Error: ' + err.message);
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
            alert(language === 'es' ? 'Selecciona o escribe una carpeta de destino válida.' : 'Select or enter a valid destination folder.');
            return;
        }
        if (finalTarget === viewingWipeFolder && moveMode === 'all') {
            alert(language === 'es' ? 'La carpeta de destino debe ser diferente a la carpeta actual.' : 'The destination folder must be different from the current folder.');
            return;
        }
        setWipeActionLoading(true);
        try {
            if (moveMode === 'selected') {
                if (selectedInterrogationIds.length === 0) {
                    alert(language === 'es' ? 'No hay interrogatorios seleccionados.' : 'No interrogations selected.');
                    setWipeActionLoading(false);
                    return;
                }
                await moveDOJInterrogationsToWipeFolder({
                    interrogationIds: selectedInterrogationIds,
                    targetFolder: finalTarget
                });
            } else {
                await moveDOJInterrogationsToWipeFolder({
                    interrogationIds: 'all',
                    targetFolder: finalTarget,
                    sourceFolder: viewingWipeFolder
                });
            }

            const folders = await getDOJInterrogationsWipeFoldersList();
            setWipeFolders(folders);
            setSelectedInterrogationIds([]);
            setSelectionMode(false);
            setShowMoveModal(false);
            await loadData(viewingWipeFolder);
            alert(language === 'es'
                ? `Interrogatorios trasladados exitosamente a la carpeta "${finalTarget}".`
                : `Interrogations successfully moved to folder "${finalTarget}".`);
        } catch (err) {
            alert('Error: ' + err.message);
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
        const folderToAssign = viewingWipeFolder || DEFAULT_WIPE_FOLDER;

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
                p_case_id: formData.case_id || null,
                p_wipe_folder: folderToAssign
            });

            if (error) {
                // Fallback si la RPC aún no tiene p_wipe_folder en la base de datos
                const { error: err2 } = await supabase.rpc('manage_doj_interrogation', {
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
                if (err2) throw err2;

                if (modalMode === 'create' && folderToAssign !== DEFAULT_WIPE_FOLDER) {
                    const { data: latest } = await supabase
                        .from('doj_interrogations')
                        .select('id')
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (latest && latest[0]?.id) {
                        await supabase
                            .from('doj_interrogations')
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {/* WIPE CONTROLS FOR ADMINS */}
                    {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'rgba(0, 0, 0, 0.45)',
                                border: viewingWipeFolder !== activeWipeFolder ? '1px solid #f59e0b' : '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '20px',
                                padding: '0.22rem 0.65rem',
                                gap: '0.35rem'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: viewingWipeFolder !== activeWipeFolder ? '#fbbf24' : '#10b981' }}>📁</span>
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
                                    title="Carpeta de Wipe de Interrogatorios del DOJ"
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
                                style={{
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.78rem',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    background: selectionMode ? '#10b981' : undefined
                                }}
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

                    {/* Search Bar */}
                    <div className="mac-input-with-icon" style={{ width: '240px' }}>
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

            {/* Banner: Viewing Non-Active Wipe Folder */}
            {isAdmin && viewingWipeFolder !== activeWipeFolder && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.12) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    borderRadius: '12px',
                    padding: '0.55rem 1rem',
                    marginBottom: '1rem',
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                        <span style={{ fontSize: '0.84rem', color: '#fef3c7', fontWeight: 600 }}>
                            {language === 'es' ? 'Estás visualizando la carpeta de wipe archivada:' : 'Viewing archived wipe folder:'} <strong style={{ color: '#fbbf24' }}>"{viewingWipeFolder}"</strong>. {language === 'es' ? 'Los agentes regulares solo ven la carpeta activa' : 'Regular agents only see the active folder'} (<strong style={{ color: '#fbbf24' }}>"{activeWipeFolder}"</strong>).
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.76rem', padding: '0.3rem 0.75rem', border: '1px solid rgba(245, 158, 11, 0.4)' }}
                            onClick={() => handleChangeViewingWipe(activeWipeFolder)}
                        >
                            ↩️ {language === 'es' ? 'Volver a carpeta activa' : 'Back to active folder'}
                        </button>
                        <button
                            type="button"
                            className="mac-btn mac-btn-primary"
                            style={{ fontSize: '0.76rem', padding: '0.3rem 0.75rem', background: '#d97706', borderColor: '#b45309' }}
                            disabled={wipeActionLoading}
                            onClick={() => handleMakeActiveWipe(viewingWipeFolder)}
                        >
                            ⭐ {language === 'es' ? 'Hacer Activa para todos' : 'Make Active for all'}
                        </button>
                    </div>
                </div>
            )}

            {/* Selection Toolbar (When selectionMode is active) */}
            {isAdmin && selectionMode && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.12) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    padding: '0.55rem 1rem',
                    marginBottom: '1rem',
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: 700 }}>
                            ☑️ {selectedInterrogationIds.length} {language === 'es' ? 'seleccionado(s)' : 'selected'}
                        </span>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                            onClick={selectAllInterrogations}
                        >
                            {language === 'es' ? 'Seleccionar todos' : 'Select all'}
                        </button>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                            onClick={deselectAllInterrogations}
                        >
                            {language === 'es' ? 'Deseleccionar' : 'Deselect all'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-primary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', background: '#10b981', borderColor: '#059669' }}
                            disabled={selectedInterrogationIds.length === 0}
                            onClick={() => handleOpenMoveModal('selected')}
                        >
                            📦 {language === 'es' ? 'Mover seleccionados a...' : 'Move selected to...'}
                        </button>
                    </div>
                </div>
            )}

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
                        const isSelected = selectedInterrogationIds.includes(item.id);
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
                                    boxShadow: isSelected
                                        ? '0 0 0 2px #10b981, 0 8px 24px -6px rgba(16, 185, 129, 0.4)'
                                        : '0 8px 24px -6px rgba(0, 0, 0, 0.4)',
                                    cursor: selectionMode ? 'pointer' : 'default'
                                }}
                                onClick={selectionMode ? () => toggleInterrogationSelection(item.id) : undefined}
                            >
                                {/* Top Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        {selectionMode && (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleInterrogationSelection(item.id);
                                                }}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    cursor: 'pointer',
                                                    accentColor: '#10b981',
                                                    marginRight: '2px'
                                                }}
                                            />
                                        )}
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

                                        {/* Wipe Folder Tag */}
                                        {item.wipe_folder && (
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                padding: '0.2rem 0.65rem',
                                                borderRadius: '9999px',
                                                background: item.wipe_folder === activeWipeFolder ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.18)',
                                                border: item.wipe_folder === activeWipeFolder ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                                                color: item.wipe_folder === activeWipeFolder ? '#6ee7b7' : '#fcd34d'
                                            }}>
                                                📁 {item.wipe_folder}
                                            </span>
                                        )}

                                        {item.linked_case_number && (
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/doj/cases/${item.case_id}`);
                                                }}
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
            {/* Modal: Wipe Folders Manager (ADMIN ONLY) */}
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
                                ⚙️ {language === 'es' ? 'Gestión de Carpetas de Wipe • Interrogatorios DOJ' : 'Wipe Folders Manager • DOJ Interrogations'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                                {language === 'es'
                                    ? 'Crea carpetas para archivar actas de interrogatorios del Departamento de Justicia correspondientes a temporadas o wipes anteriores. Solo los administradores pueden alternar o ver carpetas archivadas.'
                                    : 'Create folders to archive DOJ interrogation records from previous seasons or wipes. Only administrators can view and switch between archived folders.'}
                            </p>

                            {/* Create New Wipe Folder Form */}
                            <div style={{
                                display: 'flex',
                                gap: '0.6rem',
                                background: 'rgba(0, 0, 0, 0.35)',
                                padding: '0.75rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                marginBottom: '1.25rem'
                            }}>
                                <input
                                    type="text"
                                    className="mac-input"
                                    placeholder={language === 'es' ? 'Nombre de nueva carpeta (ej: Wipe 2025, Temporada 1)...' : 'New folder name (e.g., Wipe 2025)...'}
                                    value={newWipeFolderName}
                                    onChange={(e) => setNewWipeFolderName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateNewFolder(); } }}
                                    style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    type="button"
                                    className="mac-btn mac-btn-primary"
                                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.95rem', background: '#10b981', borderColor: '#059669' }}
                                    disabled={wipeActionLoading || !newWipeFolderName.trim()}
                                    onClick={handleCreateNewFolder}
                                >
                                    ➕ {language === 'es' ? 'Crear Carpeta' : 'Create Folder'}
                                </button>
                            </div>

                            {/* Folders List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto' }} className="custom-scrollbar">
                                {wipeFolders.map(folder => {
                                    const isActive = folder === activeWipeFolder;
                                    const isViewing = folder === viewingWipeFolder;
                                    const stats = wipeStats[folder] || { total: 0, withMedia: 0, linkedCases: 0 };

                                    return (
                                        <div
                                            key={folder}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.5rem',
                                                background: isViewing ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.25)',
                                                border: isActive ? '1px solid #10b981' : (isViewing ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)'),
                                                borderRadius: '10px',
                                                padding: '0.75rem 0.95rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '1rem' }}>📁</span>
                                                    <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>{folder}</strong>
                                                    {isActive && (
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            color: '#34d399',
                                                            background: 'rgba(16, 185, 129, 0.18)',
                                                            border: '1px solid rgba(16, 185, 129, 0.35)',
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '9999px'
                                                        }}>
                                                            ⭐ {language === 'es' ? 'Carpeta Activa (Visible para todos)' : 'Active Folder'}
                                                        </span>
                                                    )}
                                                    {isViewing && (
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            color: '#60a5fa',
                                                            background: 'rgba(59, 130, 246, 0.18)',
                                                            border: '1px solid rgba(59, 130, 246, 0.35)',
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '9999px'
                                                        }}>
                                                            👁️ {language === 'es' ? 'Viendo ahora' : 'Viewing now'}
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
                                                            👁️ {language === 'es' ? 'Ver' : 'View'}
                                                        </button>
                                                    )}

                                                    {!isActive && (
                                                        <button
                                                            type="button"
                                                            className="mac-btn mac-btn-primary"
                                                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem', background: '#059669', borderColor: '#047857' }}
                                                            disabled={wipeActionLoading}
                                                            onClick={() => handleMakeActiveWipe(folder)}
                                                        >
                                                            ⭐ {language === 'es' ? 'Hacer Activa' : 'Make Active'}
                                                        </button>
                                                    )}

                                                    {folder !== DEFAULT_WIPE_FOLDER && (
                                                        <button
                                                            type="button"
                                                            className="mac-btn mac-btn-secondary"
                                                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem', color: '#f87171' }}
                                                            disabled={wipeActionLoading}
                                                            onClick={() => handleDeleteFolder(folder)}
                                                            title={language === 'es' ? 'Eliminar carpeta de wipe' : 'Delete wipe folder'}
                                                        >
                                                            🗑️ {language === 'es' ? 'Borrar' : 'Delete'}
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
                                                <span><strong>Total:</strong> {stats.total} {language === 'es' ? 'interrogatorio(s)' : 'log(s)'}</span>
                                                <span style={{ color: '#4ade80' }}>🎥 {language === 'es' ? 'Con grabación:' : 'With media:'} {stats.withMedia}</span>
                                                <span style={{ color: '#fbbf24' }}>🔗 {language === 'es' ? 'Casos vinculados:' : 'Linked cases:'} {stats.linkedCases}</span>
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
                                style={{ background: '#10b981', borderColor: '#059669' }}
                                onClick={() => setShowWipeManagerModal(false)}
                            >
                                {language === 'es' ? 'Listo' : 'Done'}
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
                                📦 {language === 'es' ? 'Almacenar Interrogatorios en Wipe' : 'Store Interrogations in Wipe'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            {/* Scope Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? '¿Qué interrogatorios deseas trasladar?' : 'Which interrogations do you want to move?'}
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {selectedInterrogationIds.length > 0 && (
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            background: moveMode === 'selected' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(0, 0, 0, 0.3)',
                                            border: moveMode === 'selected' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '0.65rem 0.85rem',
                                            cursor: 'pointer',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}>
                                            <input
                                                type="radio"
                                                name="dojMoveMode"
                                                value="selected"
                                                checked={moveMode === 'selected'}
                                                onChange={() => setMoveMode('selected')}
                                            />
                                            <span>
                                                {language === 'es'
                                                    ? <>Mover los <strong>{selectedInterrogationIds.length}</strong> interrogatorios seleccionados a dedo</>
                                                    : <>Move the <strong>{selectedInterrogationIds.length}</strong> selected interrogation logs</>}
                                            </span>
                                        </label>
                                    )}

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        background: moveMode === 'all' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(0, 0, 0, 0.3)',
                                        border: moveMode === 'all' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '0.65rem 0.85rem',
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}>
                                        <input
                                            type="radio"
                                            name="dojMoveMode"
                                            value="all"
                                            checked={moveMode === 'all'}
                                            onChange={() => setMoveMode('all')}
                                        />
                                        <span>
                                            {language === 'es'
                                                ? <>Mover <strong>TODOS</strong> los interrogatorios de la carpeta "{viewingWipeFolder}" (Total: {wipeStats[viewingWipeFolder]?.total || interrogations.length})</>
                                                : <>Move <strong>ALL</strong> interrogations in folder "{viewingWipeFolder}" (Total: {wipeStats[viewingWipeFolder]?.total || interrogations.length})</>}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Destination Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Carpeta de Destino' : 'Destination Folder'}</label>
                                
                                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                    <button
                                        type="button"
                                        className={`mac-btn ${!isCreatingNewMoveFolder ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem', background: !isCreatingNewMoveFolder ? '#10b981' : undefined, borderColor: !isCreatingNewMoveFolder ? '#059669' : undefined }}
                                        onClick={() => setIsCreatingNewMoveFolder(false)}
                                    >
                                        {language === 'es' ? 'Elegir existente' : 'Choose existing'}
                                    </button>
                                    <button
                                        type="button"
                                        className={`mac-btn ${isCreatingNewMoveFolder ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem', background: isCreatingNewMoveFolder ? '#10b981' : undefined, borderColor: isCreatingNewMoveFolder ? '#059669' : undefined }}
                                        onClick={() => {
                                            setIsCreatingNewMoveFolder(true);
                                            setTargetMoveFolder('');
                                        }}
                                    >
                                        ➕ {language === 'es' ? 'Crear nueva' : 'Create new'}
                                    </button>
                                </div>

                                {!isCreatingNewMoveFolder ? (
                                    <select
                                        className="mac-select"
                                        style={{ width: '100%', padding: '0.55rem' }}
                                        value={targetMoveFolder}
                                        onChange={(e) => setTargetMoveFolder(e.target.value)}
                                    >
                                        <option value="">{language === 'es' ? '-- Selecciona carpeta destino --' : '-- Select destination folder --'}</option>
                                        {wipeFolders.map(f => (
                                            <option key={f} value={f}>
                                                📁 {f} {f === activeWipeFolder ? (language === 'es' ? '(Activa en web)' : '(Active)') : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="mac-input"
                                        placeholder={language === 'es' ? 'Nombre de la nueva carpeta de destino...' : 'Name of new destination folder...'}
                                        value={targetMoveFolder}
                                        onChange={(e) => setTargetMoveFolder(e.target.value)}
                                        style={{ width: '100%', padding: '0.55rem' }}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mac-modal-actions">
                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                onClick={() => setShowMoveModal(false)}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                className="mac-btn mac-btn-primary"
                                style={{ background: '#10b981', borderColor: '#059669' }}
                                disabled={wipeActionLoading || !targetMoveFolder.trim()}
                                onClick={handleExecuteMove}
                            >
                                {wipeActionLoading
                                    ? (language === 'es' ? 'Moviendo...' : 'Moving...')
                                    : (language === 'es' ? '📦 Mover Interrogatorios' : '📦 Move Interrogations')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJInterrogations;

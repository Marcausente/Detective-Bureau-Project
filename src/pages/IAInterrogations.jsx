import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import {
    DEFAULT_WIPE_FOLDER,
    getActiveIAInterrogationsWipeFolder,
    setActiveIAInterrogationsWipeFolder,
    getIAInterrogationsWipeFoldersList,
    createIAInterrogationsWipeFolder,
    deleteIAInterrogationsWipeFolder,
    moveIAInterrogationsToWipeFolder,
    getIAInterrogationsWipeFoldersStats
} from '../services/iaInterrogationsWipeService';
import '../index.css';

function IAInterrogations() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language, t } = useLanguage();
    const [interrogations, setInterrogations] = useState([]);
    const [iaCases, setIaCases] = useState([]);
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
    const [currentUser, setCurrentUser] = useState(null);

    const isAdmin = Boolean(
        currentUser && (
            (currentUser.rol || '').toLowerCase().trim() === 'administrador' ||
            (currentUser.rol || '').toLowerCase().trim() === 'superadmin' ||
            (currentUser.rol || '').toLowerCase().includes('admin')
        )
    );

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
            const activeWipe = await getActiveIAInterrogationsWipeFolder();
            const folders = await getIAInterrogationsWipeFoldersList();
            const stats = await getIAInterrogationsWipeFoldersStats();

            if (isMounted) {
                setActiveWipeFolderState(activeWipe);
                setViewingWipeFolder(activeWipe);
                setWipeFolders(folders);
                setWipeStats(stats);
                loadData(activeWipe, uProfile);
                fetchPersonnel();
                fetchIACases();
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
        } else if (!searchVal && !idVal) {
            setSearchTerm('');
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
                supabase.rpc('get_ia_interrogations', { p_case_id: null }),
                supabase.from('ia_interrogations').select('id, wipe_folder')
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
            const stats = await getIAInterrogationsWipeFoldersStats();
            setWipeStats(stats);
        } catch (err) {
            console.error('Error loading IA interrogations:', err);
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
            await setActiveIAInterrogationsWipeFolder(folder);
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
            const updated = await createIAInterrogationsWipeFolder(clean);
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
            const updated = await deleteIAInterrogationsWipeFolder(folder, DEFAULT_WIPE_FOLDER);
            setWipeFolders(updated);
            if (viewingWipeFolder === folder) {
                setViewingWipeFolder(DEFAULT_WIPE_FOLDER);
                await loadData(DEFAULT_WIPE_FOLDER);
            } else {
                const stats = await getIAInterrogationsWipeFoldersStats();
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
                await moveIAInterrogationsToWipeFolder({
                    interrogationIds: selectedInterrogationIds,
                    targetFolder: finalTarget
                });
            } else {
                await moveIAInterrogationsToWipeFolder({
                    interrogationIds: 'all',
                    targetFolder: finalTarget,
                    sourceFolder: viewingWipeFolder
                });
            }

            const folders = await getIAInterrogationsWipeFoldersList();
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

    const fetchIACases = async () => {
        try {
            const { data, error } = await supabase
                .from('ia_cases')
                .select('id, case_number, title')
                .order('case_number', { ascending: false });
            if (error) throw error;
            setIaCases(data || []);
        } catch (err) {
            console.error('Error fetching IA cases for selector:', err);
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
                const iaUsers = data.filter(u => {
                    const rank = (u.rango || '').toLowerCase().trim();
                    const rol = (u.rol || '').toLowerCase().trim();
                    const isIARank = rank === 'internal affairs agent' || rank.includes('internal affairs') || rank.includes('iab');
                    const isIADiv = (u.divisions && u.divisions.includes('Internal Affairs'));
                    const isIARole = rol === 'coordinador ia' || rol === 'administrador';
                    return isIARank || isIADiv || isIARole;
                });

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

                const sorted = iaUsers.sort((a, b) => {
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
        const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
        setFormData({
            title: `${today} - [${language === 'es' ? 'Nombre del Sujeto' : 'Subject Name'}]`,
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
        const currentAgents = item.agents_present ? item.agents_present.split(',').map(s => s.trim()).filter(Boolean) : [];
        setFormData({
            title: item.title || '',
            date: item.interrogation_date || new Date().toISOString().split('T')[0],
            agents: item.agents_present || '',
            subjects: item.subjects || '',
            transcription: item.transcription || '',
            url: item.media_url || '',
            case_id: item.case_id || ''
        });
        setSelectedAgents(currentAgents);
        setAgentSearch('');
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
        const folderToAssign = viewingWipeFolder || DEFAULT_WIPE_FOLDER;

        try {
            const { error } = await supabase.rpc('manage_ia_interrogation', {
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
                const { error: err2 } = await supabase.rpc('manage_ia_interrogation', {
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
                        .from('ia_interrogations')
                        .select('id')
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (latest && latest[0]?.id) {
                        await supabase
                            .from('ia_interrogations')
                            .update({ wipe_folder: folderToAssign })
                            .eq('id', latest[0].id);
                    }
                }
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            alert((language === 'es' ? 'Error al guardar registro: ' : 'Error saving record: ') + err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const confirmMsg = language === 'es' 
            ? '¿Estás seguro de que deseas eliminar este registro de interrogatorio de Asuntos Internos?' 
            : 'Are you sure you want to delete this Internal Affairs interrogation log?';
        if (!window.confirm(confirmMsg)) return;

        try {
            const { error } = await supabase.rpc('manage_ia_interrogation', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert((language === 'es' ? 'Error al eliminar: ' : 'Error deleting: ') + err.message);
        }
    };

    const toggleCardExpanded = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredPersonnel = useMemo(() => {
        if (!agentSearch || agentSearch.trim() === '') return personnel;
        const q = agentSearch.toLowerCase().trim();
        return personnel.filter(p => 
            `${p.rango} ${p.nombre} ${p.apellido} ${p.no_placa}`.toLowerCase().includes(q)
        );
    }, [personnel, agentSearch]);

    const filteredItems = useMemo(() => {
        const paramId = searchParams.get('id');
        if (paramId) {
            return interrogations.filter(item => String(item.id) === String(paramId));
        }
        if (!searchTerm || searchTerm.trim() === '') return interrogations;
        const term = searchTerm.toLowerCase().trim();
        return interrogations.filter(item => (
            (item.title && item.title.toLowerCase().includes(term)) ||
            (item.subjects && item.subjects.toLowerCase().includes(term)) ||
            (item.agents_present && item.agents_present.toLowerCase().includes(term)) ||
            (item.transcription && item.transcription.toLowerCase().includes(term)) ||
            (item.author_name && item.author_name.toLowerCase().includes(term)) ||
            (item.linked_case_number && String(item.linked_case_number).includes(term)) ||
            (item.linked_case_title && item.linked_case_title.toLowerCase().includes(term))
        ));
    }, [interrogations, searchParams, searchTerm]);

    const clearIdFilter = () => {
        setSearchParams({});
    };

    const withMediaCount = useMemo(() => interrogations.filter(i => i.media_url).length, [interrogations]);
    const linkedCasesCount = useMemo(() => interrogations.filter(i => i.linked_case_number).length, [interrogations]);

    const canManageItem = (item) => {
        if (!currentUser) return false;
        if (item.can_edit) return true;
        if (currentUser.rol === 'Administrador') return true;
        const r = (currentUser.rango || '').toLowerCase();
        if (['sheriff', 'undersheriff', 'assistant sheriff', 'division chief', 'comandante'].includes(r)) return true;
        return false;
    };

    return (
        <div
            id="ia-interrogations-page"
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
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.9rem',
                padding: '0.3rem 0.5rem',
                gap: '1rem',
                flexWrap: 'wrap',
                width: '100%',
                boxSizing: 'border-box',
                flexShrink: 0
            }}>
                {/* Left: Back Link & Brand Title with Apple Status LED */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <button
                        onClick={() => navigate('/internal-affairs')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '20px',
                            color: '#fca5a5',
                            padding: '0.35rem 0.9rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)'
                        }}
                    >
                        <span>←</span>
                        <span>{language === 'es' ? 'Volver a Asuntos Internos' : 'Back to Internal Affairs'}</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            boxShadow: '0 0 12px #ef4444',
                            display: 'inline-block'
                        }}></span>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.015em' }}>
                                    {language === 'es' ? 'Interrogatorios • Asuntos Internos' : 'IA Interrogations • Internal Affairs'}
                                </h2>
                                <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    background: 'rgba(239, 68, 68, 0.18)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    padding: '2px 7px',
                                    borderRadius: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    {language === 'es' ? 'Acceso Restringido' : 'Restricted Access'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                <span>Total: <strong style={{ color: '#f87171' }}>{interrogations.length}</strong></span>
                                <span>•</span>
                                <span>{language === 'es' ? 'Con Grabación:' : 'With Recording:'} <strong style={{ color: '#4ade80' }}>{withMediaCount}</strong></span>
                                <span>•</span>
                                <span>{language === 'es' ? 'Vinculados:' : 'Linked:'} <strong style={{ color: '#fbbf24' }}>{linkedCasesCount}</strong></span>
                                <span>•</span>
                                <span>{language === 'es' ? 'Resultados:' : 'Results:'} <strong style={{ color: '#f1f5f9' }}>{filteredItems.length}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Search & Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* WIPE CONTROLS FOR ADMINS */}
                    {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'rgba(0, 0, 0, 0.45)',
                                border: viewingWipeFolder !== activeWipeFolder ? '1px solid #f59e0b' : '1px solid rgba(239, 68, 68, 0.35)',
                                borderRadius: '20px',
                                padding: '0.22rem 0.65rem',
                                gap: '0.35rem'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: viewingWipeFolder !== activeWipeFolder ? '#fbbf24' : '#f87171' }}>📁</span>
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
                                    title="Carpeta de Wipe de Asuntos Internos"
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
                                    background: selectionMode ? '#ef4444' : undefined
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

                    {/* Clear URL ID parameter button */}
                    {(searchParams.get('id') || searchParams.get('search')) && (
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
                            {language === 'es' ? 'Mostrar todos' : 'Show all'}
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
                            placeholder={language === 'es' ? 'Buscar registros, agente, sujeto, caso...' : 'Search logs, agent, subject, case...'}
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

                    {/* New IA Interrogation Entry Button */}
                    <button
                        type="button"
                        className="int-new-btn"
                        onClick={openCreate}
                        style={{
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.45) 100%)',
                            borderColor: 'rgba(248, 113, 113, 0.45)',
                            color: '#fca5a5',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.25)'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {language === 'es' ? 'Nuevo Registro IA' : 'New IA Log'}
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
                    marginBottom: '0.75rem',
                    flexShrink: 0,
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
                    background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.12) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '12px',
                    padding: '0.55rem 1rem',
                    marginBottom: '0.75rem',
                    flexShrink: 0,
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: 700 }}>
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
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', background: '#ef4444', borderColor: '#dc2626' }}
                            disabled={selectedInterrogationIds.length === 0}
                            onClick={() => handleOpenMoveModal('selected')}
                        >
                            📦 {language === 'es' ? 'Mover seleccionados a...' : 'Move selected to...'}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', border: '2px solid #ef4444', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        {language === 'es' ? 'Cargando registros de Asuntos Internos...' : 'Loading IA interrogation logs...'}
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem', paddingBottom: '1rem' }} className="custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="int-empty-state">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" className="int-empty-icon">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="22" />
                            </svg>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1', marginTop: '0.5rem' }}>
                                {language === 'es' ? 'No se encontraron registros de interrogatorios de IA' : 'No IA interrogation logs found'}
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
                                const canManage = canManageItem(item);
                                const isSelected = selectedInterrogationIds.includes(item.id);

                                return (
                                    <div
                                        key={item.id}
                                        className="int-grid-card"
                                        style={{
                                            borderLeft: isSelected ? '4px solid #ef4444' : '4px solid #ef4444',
                                            boxShadow: isSelected ? '0 0 0 2px #ef4444, 0 8px 24px rgba(239, 68, 68, 0.25)' : undefined,
                                            cursor: selectionMode ? 'pointer' : 'default',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={selectionMode ? () => toggleInterrogationSelection(item.id) : undefined}
                                    >
                                        <div>
                                            {/* Window Top Controls, IA Badge & Date Badge */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                                {/* macOS window dots + Checkbox in selection mode */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                                accentColor: '#ef4444',
                                                                marginRight: '4px'
                                                            }}
                                                        />
                                                    )}
                                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: '#f87171',
                                                        marginLeft: '6px',
                                                        letterSpacing: '0.03em'
                                                    }}>
                                                        #IA-INT-{String(item.id).substring(0, 6).toUpperCase()}
                                                    </span>

                                                    {/* Wipe Folder Tag */}
                                                    {item.wipe_folder && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            background: item.wipe_folder === activeWipeFolder ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.18)',
                                                            color: item.wipe_folder === activeWipeFolder ? '#fca5a5' : '#fcd34d',
                                                            border: item.wipe_folder === activeWipeFolder ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.35)',
                                                            padding: '1px 6px',
                                                            borderRadius: '8px',
                                                            marginLeft: '4px'
                                                        }}>
                                                            📁 {item.wipe_folder}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Date Badge */}
                                                <div style={{
                                                    background: 'rgba(239, 68, 68, 0.12)',
                                                    color: '#fca5a5',
                                                    padding: '3px 9px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
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

                                            {/* Linked Case Tag if applicable */}
                                            {item.linked_case_number && (
                                                <div style={{ marginBottom: '0.6rem' }}>
                                                    <span
                                                        onClick={() => {
                                                            if (item.case_id) {
                                                                navigate(`/internal-affairs/cases/${item.case_id}`);
                                                            }
                                                        }}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#fca5a5',
                                                            border: '1px solid rgba(239, 68, 68, 0.35)',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            cursor: item.case_id ? 'pointer' : 'default'
                                                        }}
                                                        title={item.linked_case_title || ''}
                                                    >
                                                        🔗 {language === 'es' ? 'Caso IA-' : 'Case IA-'}{String(item.linked_case_number).padStart(3, '0')}
                                                        {item.linked_case_title && <span style={{ color: '#cbd5e1', fontWeight: 500 }}>• {item.linked_case_title}</span>}
                                                    </span>
                                                </div>
                                            )}

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
                                                        {language === 'es' ? 'Agentes de IA Presentes' : 'IA Agents Present'}
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
                                                        {language === 'es' ? 'Sujeto(s) / Agente(s) Investigados' : 'Investigated Subject(s)'}
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {subjectsList.length > 0 ? (
                                                            subjectsList.map((subj, sIdx) => (
                                                                <span key={sIdx} style={{
                                                                    background: 'rgba(239, 68, 68, 0.12)',
                                                                    color: '#fca5a5',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.72rem',
                                                                    border: '1px solid rgba(239, 68, 68, 0.22)',
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
                                                        📝 {language === 'es' ? 'Resumen / Transcripción y Notas' : 'Summary / Transcription & Notes'}
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
                                                                color: '#f87171',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                marginTop: '4px',
                                                                padding: 0
                                                            }}
                                                        >
                                                            {isExpanded ? (language === 'es' ? 'Mostrar menos ▲' : 'Show less ▲') : (language === 'es' ? 'Mostrar más ▼' : 'Show more ▼')}
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
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#fca5a5',
                                                            border: '1px solid rgba(239, 68, 68, 0.35)',
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
                                                        {language === 'es' ? 'Ver / Escuchar Grabación / Evidencia' : 'View / Listen Recording / Evidence'}
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Footer: Author & Actions */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                            paddingTop: '0.65rem',
                                            marginTop: '0.35rem'
                                        }}>
                                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span>{language === 'es' ? 'Registrado por:' : 'Filed by:'}</span>
                                                <strong style={{ color: '#e2e8f0' }}>{item.author_name || (language === 'es' ? 'Agente de IA' : 'IA Agent')}</strong>
                                            </div>

                                            {canManage && (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(item)}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.06)',
                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                            color: '#fca5a5',
                                                            borderRadius: '8px',
                                                            width: '28px',
                                                            height: '28px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title={language === 'es' ? 'Editar Registro' : 'Edit Log'}
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
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title={language === 'es' ? 'Eliminar Registro' : 'Delete Log'}
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
                        maxWidth: '780px',
                        width: '92vw',
                        maxHeight: '88vh',
                        overflowY: 'auto',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        {/* Titlebar with window dots */}
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowModal(false)} title={language === 'es' ? 'Cerrar' : 'Close'} />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#fca5a5', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {modalMode === 'create' 
                                        ? (language === 'es' ? 'Nuevo Registro de Interrogatorio • IA' : 'New IA Interrogation Log') 
                                        : (language === 'es' ? 'Editar Registro de Interrogatorio • IA' : 'Edit IA Interrogation Log')}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleAction} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Date, Title and Optional Case Linking in Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.85rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {language === 'es' ? 'Fecha' : 'Date'}
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
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {language === 'es' ? 'Título del Interrogatorio' : 'Interrogation Title'}
                                    </label>
                                    <input
                                        className="form-input"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder={language === 'es' ? 'DD/MM/AAAA - Nombre del Sujeto' : 'DD/MM/YYYY - Subject Name'}
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

                            {/* Optional Case Linking */}
                            {iaCases.length > 0 && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>🔗</span>
                                        {language === 'es' ? 'Vincular a Caso de Asuntos Internos (Opcional)' : 'Link to IA Case (Optional)'}
                                    </label>
                                    <select
                                        className="form-input"
                                        value={formData.case_id}
                                        onChange={e => setFormData({ ...formData, case_id: e.target.value })}
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
                                    >
                                        <option value="">{language === 'es' ? '-- Sin vincular a un caso específico --' : '-- Not linked to a specific case --'}</option>
                                        {iaCases.map(c => (
                                            <option key={c.id} value={c.id}>
                                                IA-{String(c.case_number).padStart(3, '0')} • {c.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Custom Agent Selector Grid with Search */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                        {language === 'es' ? 'Agentes de Asuntos Internos Presentes' : 'IA Agents Present'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={language === 'es' ? 'Filtrar agentes...' : 'Filter agents...'}
                                        value={agentSearch}
                                        onChange={e => setAgentSearch(e.target.value)}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '12px',
                                            color: '#cbd5e1',
                                            fontSize: '0.74rem',
                                            padding: '2px 8px',
                                            outline: 'none',
                                            width: '150px'
                                        }}
                                    />
                                </div>

                                <div className="custom-scrollbar" style={{
                                    border: '1px solid rgba(255, 255, 255, 0.16)',
                                    borderRadius: '12px',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.65)',
                                    maxHeight: '180px',
                                    overflowY: 'auto',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                                    gap: '0.5rem'
                                }}>
                                    {filteredPersonnel.map(p => {
                                        const fullName = `${p.rango} ${p.nombre} ${p.apellido}`;
                                        const isSelected = selectedAgents.includes(fullName);
                                        return (
                                            <div
                                                key={(p.no_placa || '') + p.nombre + p.apellido}
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
                                                    justifyContent: 'center',
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
                                    {language === 'es' ? 'Seleccionados:' : 'Selected:'} {selectedAgents.length > 0 ? (
                                        <strong style={{ color: '#fbbf24' }}>{selectedAgents.join(', ')}</strong>
                                    ) : (
                                        <em>{language === 'es' ? 'Ninguno' : 'None'}</em>
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
                                    {language === 'es' ? 'Sujeto(s) / Agente(s) Interrogado(s)' : 'Interrogated Subject(s)'}
                                </label>
                                <input
                                    className="form-input"
                                    placeholder={language === 'es' ? 'Ej: John Doe, Oficial Mike Jones #102' : 'e.g. John Doe, Officer Mike Jones #102'}
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
                                    {language === 'es' ? 'Transcripción y Notas Relevantes' : 'Transcription and Relevant Notes'}
                                </label>
                                <textarea
                                    className="eval-textarea"
                                    rows="7"
                                    placeholder={language === 'es' ? 'Escribe las notas de la declaración, preguntas clave, confesión, observaciones...' : 'Enter declaration notes, key questions, confession, observations...'}
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
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    {language === 'es' ? 'Enlace a Grabación de Audio / Video / Evidencia' : 'Recording Audio / Video / Evidence Link'}
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
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="login-button"
                                    disabled={submitLoading}
                                    style={{
                                        width: 'auto',
                                        padding: '0.5rem 1.6rem',
                                        borderRadius: '10px',
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                                        borderColor: '#ef4444',
                                        color: '#ffffff'
                                    }}
                                >
                                    {submitLoading ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar Registro' : 'Save Log')}
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
                                ⚙️ {language === 'es' ? 'Gestión de Carpetas de Wipe • Asuntos Internos' : 'Wipe Folders Manager • Internal Affairs'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                                {language === 'es'
                                    ? 'Crea carpetas para archivar interrogatorios de Asuntos Internos correspondientes a temporadas o wipes anteriores. Solo los administradores pueden alternar o ver carpetas archivadas.'
                                    : 'Create folders to archive Internal Affairs interrogations from previous seasons or wipes. Only administrators can view and switch between archived folders.'}
                            </p>

                            {/* Create New Wipe Folder Form */}
                            <div style={{
                                display: 'flex',
                                gap: '0.6rem',
                                background: 'rgba(0, 0, 0, 0.35)',
                                padding: '0.75rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
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
                                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.95rem', background: '#ef4444', borderColor: '#dc2626' }}
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
                                                background: isViewing ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 0, 0, 0.25)',
                                                border: isActive ? '1px solid #ef4444' : (isViewing ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)'),
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
                                                            color: '#f87171',
                                                            background: 'rgba(239, 68, 68, 0.18)',
                                                            border: '1px solid rgba(239, 68, 68, 0.35)',
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
                                                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem', background: '#b91c1c', borderColor: '#991b1b' }}
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
                                style={{ background: '#ef4444', borderColor: '#dc2626' }}
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
                                            background: moveMode === 'selected' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0, 0, 0, 0.3)',
                                            border: moveMode === 'selected' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '0.65rem 0.85rem',
                                            cursor: 'pointer',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}>
                                            <input
                                                type="radio"
                                                name="iaMoveMode"
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
                                        background: moveMode === 'all' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0, 0, 0, 0.3)',
                                        border: moveMode === 'all' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '0.65rem 0.85rem',
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}>
                                        <input
                                            type="radio"
                                            name="iaMoveMode"
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
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem', background: !isCreatingNewMoveFolder ? '#ef4444' : undefined, borderColor: !isCreatingNewMoveFolder ? '#dc2626' : undefined }}
                                        onClick={() => setIsCreatingNewMoveFolder(false)}
                                    >
                                        {language === 'es' ? 'Elegir existente' : 'Choose existing'}
                                    </button>
                                    <button
                                        type="button"
                                        className={`mac-btn ${isCreatingNewMoveFolder ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem', background: isCreatingNewMoveFolder ? '#ef4444' : undefined, borderColor: isCreatingNewMoveFolder ? '#dc2626' : undefined }}
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
                                style={{ background: '#ef4444', borderColor: '#dc2626' }}
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

export default IAInterrogations;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import {
    DEFAULT_WIPE_FOLDER,
    getActiveDOJCasesWipeFolder,
    setActiveDOJCasesWipeFolder,
    getDOJCasesWipeFoldersList,
    createDOJCasesWipeFolder,
    deleteDOJCasesWipeFolder,
    moveDOJCasesToWipeFolder,
    getDOJCasesWipeFoldersStats
} from '../services/dojCasesWipeService';
import '../index.css';

function DOJCases() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Open'); // Open, Closed, Archived
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Current user & admin check (declared before usage to avoid TDZ)
    const [currentUser, setCurrentUser] = useState(null);
    const isAdmin = Boolean(
        currentUser && (
            (currentUser.rol || '').toLowerCase().trim() === 'administrador' ||
            (currentUser.rol || '').toLowerCase().trim() === 'superadmin' ||
            (currentUser.rol || '').toLowerCase().includes('admin')
        )
    );
    const canDeleteCases = Boolean(
        currentUser && (
            isAdmin ||
            ['Coordinador', 'Administrador', 'Comisionado', 'Director', 'Fundador', 'Superadmin'].includes(currentUser.rol) ||
            ['sheriff', 'undersheriff', 'assistant sheriff', 'division chief', 'comandante', 'capitan', 'teniente'].includes((currentUser.rango || '').toLowerCase().trim())
        )
    );

    // --- WIPE MANAGEMENT STATE ---
    const [activeWipeFolder, setActiveWipeFolderState] = useState(DEFAULT_WIPE_FOLDER);
    const [viewingWipeFolder, setViewingWipeFolder] = useState(DEFAULT_WIPE_FOLDER);
    const [wipeFolders, setWipeFolders] = useState([DEFAULT_WIPE_FOLDER]);
    const [wipeStats, setWipeStats] = useState({});
    const [selectedCaseIds, setSelectedCaseIds] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [showWipeManagerModal, setShowWipeManagerModal] = useState(false);
    const [showMoveCasesModal, setShowMoveCasesModal] = useState(false);
    const [moveScope, setMoveScope] = useState('selected'); // 'selected' | 'all'
    const [moveTargetType, setMoveTargetType] = useState('existing'); // 'existing' | 'new'
    const [targetMoveFolder, setTargetMoveFolder] = useState('');
    const [newMoveFolderInput, setNewMoveFolderInput] = useState('');
    const [newFolderInput, setNewFolderInput] = useState('');
    const [wipeActionLoading, setWipeActionLoading] = useState(false);

    // Form State
    const [newCase, setNewCase] = useState({
        title: '',
        location: '',
        occurred_at: '',
        description: '',
        assignments: [], // Array of user IDs
        initialImage: null
    });
    const [users, setUsers] = useState([]); // DOJ Users for assignment
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            let uData = null;
            if (user) {
                const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
                uData = data;
                if (isMounted) setCurrentUser(data);
            }
            const active = await getActiveDOJCasesWipeFolder();
            const folders = await getDOJCasesWipeFoldersList();
            const stats = await getDOJCasesWipeFoldersStats();
            if (isMounted) {
                setActiveWipeFolderState(active);
                setViewingWipeFolder(active);
                setWipeFolders(folders);
                setWipeStats(stats);
            }
            const userIsAdmin = Boolean(
                uData && (
                    (uData.rol || '').toLowerCase().trim() === 'administrador' ||
                    (uData.rol || '').toLowerCase().trim() === 'superadmin' ||
                    (uData.rol || '').toLowerCase().includes('admin')
                )
            );
            await fetchCases(uData, active, active, userIsAdmin);
            await fetchDOJUsers();
        };
        init();
        return () => { isMounted = false; };
    }, [filter]);

    const fetchCases = async (userData = null, targetWipe = null, activeWipe = null, adminFlag = null) => {
        setLoading(true);
        try {
            const u = userData || currentUser;
            const userIsAdmin = adminFlag !== null ? adminFlag : Boolean(
                u && (
                    (u.rol || '').toLowerCase().trim() === 'administrador' ||
                    (u.rol || '').toLowerCase().trim() === 'superadmin' ||
                    (u.rol || '').toLowerCase().includes('admin')
                )
            );

            const curActive = activeWipe || activeWipeFolder || DEFAULT_WIPE_FOLDER;
            const wipeToQuery = userIsAdmin
                ? (targetWipe || viewingWipeFolder || curActive)
                : curActive;

            const [rpcRes, wipesRes] = await Promise.allSettled([
                supabase.rpc('get_doj_cases', { p_status_filter: filter }),
                supabase.from('doj_cases').select('id, wipe_folder')
            ]);

            const wipeMap = new Map();
            if (wipesRes.status === 'fulfilled' && wipesRes.value?.data) {
                wipesRes.value.data.forEach(r => {
                    wipeMap.set(r.id, (r.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER);
                });
            }

            const rawCases = rpcRes.status === 'fulfilled' && rpcRes.value?.data ? rpcRes.value.data : [];
            const enriched = rawCases.map(c => {
                const folder = (c.wipe_folder || wipeMap.get(c.id) || DEFAULT_WIPE_FOLDER).trim();
                return { ...c, wipe_folder: folder };
            });

            const filteredByWipe = enriched.filter(c => {
                if (wipeToQuery === DEFAULT_WIPE_FOLDER) {
                    return !c.wipe_folder || c.wipe_folder === DEFAULT_WIPE_FOLDER;
                }
                return c.wipe_folder === wipeToQuery;
            });

            setCases(filteredByWipe);
        } catch (err) {
            console.error('Error fetching DOJ cases:', err);
            setCases([]);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeViewingWipe = async (folder) => {
        setViewingWipeFolder(folder);
        setSelectedCaseIds([]);
        await fetchCases(currentUser, folder);
    };

    const handleMakeActiveWipe = async (folder) => {
        if (!isAdmin) return;
        setWipeActionLoading(true);
        try {
            const ok = await setActiveDOJCasesWipeFolder(folder);
            if (ok) {
                setActiveWipeFolderState(folder);
                const stats = await getDOJCasesWipeFoldersStats();
                setWipeStats(stats);
                alert(`✓ Carpeta "${folder}" establecida como la carpeta activa que se ve en la página.`);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleCreateNewFolder = async (e) => {
        e?.preventDefault?.();
        const trimmed = (newFolderInput || '').trim();
        if (!trimmed) {
            alert('Introduce un nombre para la carpeta de Wipe.');
            return;
        }

        setWipeActionLoading(true);
        try {
            const updated = await createDOJCasesWipeFolder(trimmed);
            setWipeFolders(updated);
            setNewFolderInput('');
            const stats = await getDOJCasesWipeFoldersStats();
            setWipeStats(stats);
            alert(`✓ Carpeta "${trimmed}" creada correctamente.`);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleDeleteFolder = async (folder) => {
        if (!isAdmin) return;
        if (folder === DEFAULT_WIPE_FOLDER) {
            alert('No se puede eliminar la carpeta predeterminada "Actual".');
            return;
        }

        const confirmDelete = window.confirm(
            `¿Estás seguro de que deseas eliminar la carpeta de wipe "${folder}"?\n\n` +
            `Si contiene casos guardados, serán transferidos automáticamente a la carpeta "${DEFAULT_WIPE_FOLDER}".`
        );
        if (!confirmDelete) return;

        setWipeActionLoading(true);
        try {
            const updated = await deleteDOJCasesWipeFolder(folder, DEFAULT_WIPE_FOLDER);
            setWipeFolders(updated);
            if (viewingWipeFolder === folder) {
                setViewingWipeFolder(DEFAULT_WIPE_FOLDER);
            }
            const active = await getActiveDOJCasesWipeFolder();
            setActiveWipeFolderState(active);
            const stats = await getDOJCasesWipeFoldersStats();
            setWipeStats(stats);
            await fetchCases(currentUser, viewingWipeFolder === folder ? DEFAULT_WIPE_FOLDER : viewingWipeFolder);
            alert(`✓ Carpeta "${folder}" eliminada.`);
        } catch (err) {
            alert('Error eliminando carpeta: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const handleDeleteCase = async (e, caseId, caseNumber) => {
        e.stopPropagation();
        const confirmMsg = language === 'es'
            ? `¿Estás seguro de que deseas eliminar PERMANENTEMENTE el caso DOJ #${String(caseNumber).padStart(3, '0')}? Esta acción no se puede deshacer.`
            : `Are you sure you want to PERMANENTLY delete DOJ Case #${String(caseNumber).padStart(3, '0')}? This action cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const { error } = await supabase.rpc('delete_doj_case_fully', { p_case_id: caseId });
            if (error) {
                const fallback = await supabase.from('doj_cases').delete().eq('id', caseId);
                if (fallback.error) throw fallback.error;
            }
            await fetchCases();
        } catch (err) {
            alert('Error deleting case: ' + err.message);
        }
    };

    const handleOpenMoveModal = (scope = null) => {
        if (scope === 'selected' || (selectedCaseIds.length > 0 && scope !== 'all')) {
            setMoveScope('selected');
        } else {
            setMoveScope('all');
        }

        const otherFolder = wipeFolders.find(f => f !== viewingWipeFolder) || '';
        if (otherFolder) {
            setTargetMoveFolder(otherFolder);
            setMoveTargetType('existing');
        } else {
            setTargetMoveFolder('');
            setMoveTargetType('new');
        }
        setNewMoveFolderInput('');
        setShowMoveCasesModal(true);
    };

    const handleConfirmMoveCases = async () => {
        let destination = targetMoveFolder;
        if (moveTargetType === 'new') {
            destination = (newMoveFolderInput || '').trim();
            if (!destination) {
                alert('Por favor introduce un nombre para la nueva carpeta de Wipe.');
                return;
            }
        }

        if (!destination) {
            alert('Por favor selecciona o crea una carpeta de destino.');
            return;
        }

        if (destination === viewingWipeFolder && moveScope === 'all') {
            alert('La carpeta de destino debe ser diferente a la carpeta actual.');
            return;
        }

        setWipeActionLoading(true);
        try {
            if (moveScope === 'selected') {
                if (selectedCaseIds.length === 0) {
                    alert('No hay casos seleccionados a mano.');
                    return;
                }
                await moveDOJCasesToWipeFolder({
                    caseIds: selectedCaseIds,
                    targetFolder: destination
                });
                alert(`✓ Se han movido ${selectedCaseIds.length} caso(s) a la carpeta "${destination}".`);
            } else {
                await moveDOJCasesToWipeFolder({
                    caseIds: 'all',
                    sourceFolder: viewingWipeFolder,
                    targetFolder: destination
                });
                alert(`✓ Todos los casos de "${viewingWipeFolder}" se han almacenado en la carpeta de wipe "${destination}".`);
            }

            setShowMoveCasesModal(false);
            setSelectedCaseIds([]);
            setSelectionMode(false);

            const updatedFolders = await getDOJCasesWipeFoldersList();
            setWipeFolders(updatedFolders);
            const stats = await getDOJCasesWipeFoldersStats();
            setWipeStats(stats);
            await fetchCases(currentUser, viewingWipeFolder);
        } catch (err) {
            alert('Error al mover los casos: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const toggleCaseSelection = (id) => {
        setSelectedCaseIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAllFiltered = () => {
        const filteredIds = filteredCases.map(c => c.id);
        const allAlreadySelected = filteredIds.length > 0 && filteredIds.every(id => selectedCaseIds.includes(id));
        if (allAlreadySelected) {
            setSelectedCaseIds(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedCaseIds(Array.from(new Set([...selectedCaseIds, ...filteredIds])));
        }
    };

    const fetchDOJUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango, rol, divisions, profile_image').order('rango');
        if (data) {
            const dojUsers = data.filter(u =>
                (u.divisions && u.divisions.includes('DOJ')) ||
                u.rol === 'Administrador'
            );
            setUsers(dojUsers);
        }
    };

    const handleCreateCase = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const timestamp = new Date(newCase.occurred_at).toISOString();

            let imageUrl = newCase.initialImage;
            if (imageUrl && imageUrl.startsWith('data:')) {
                imageUrl = await uploadImageToStorage(imageUrl, 'cases');
            }

            const { data: newId, error } = await supabase.rpc('create_doj_case', {
                p_title: newCase.title,
                p_location: newCase.location,
                p_occurred_at: timestamp,
                p_description: newCase.description,
                p_assigned_ids: newCase.assignments,
                p_image: imageUrl
            });

            if (error) throw error;

            if (newId) {
                const folderToAssign = viewingWipeFolder || activeWipeFolder || DEFAULT_WIPE_FOLDER;
                try {
                    await supabase
                        .from('doj_cases')
                        .update({ wipe_folder: folderToAssign })
                        .eq('id', newId);
                } catch (errWipe) {
                    console.warn('Could not set wipe_folder on new DOJ case:', errWipe);
                }
            }

            setShowCreateModal(false);
            setNewCase({
                title: '',
                location: '',
                occurred_at: '',
                description: '',
                assignments: [],
                initialImage: null
            });
            navigate(`/doj/cases/${newId}`);

        } catch (err) {
            alert('Error creating DOJ case: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleAssignment = (userId) => {
        const current = newCase.assignments;
        if (current.includes(userId)) {
            setNewCase({ ...newCase, assignments: current.filter(id => id !== userId) });
        } else {
            setNewCase({ ...newCase, assignments: [...current, userId] });
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                setNewCase({ ...newCase, initialImage: dataUrl });
            };
        };
    };

    const statusColors = {
        'Open': '#10b981',     // Emerald
        'Closed': '#ef4444',   // Rose / Red
        'Archived': '#64748b'  // Slate Gray
    };

    const filteredCases = cases.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const caseNumStr = String(c.case_number).padStart(3, '0');
        return c.title?.toLowerCase().includes(q) ||
            c.location?.toLowerCase().includes(q) ||
            caseNumStr.includes(q);
    });

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Command Header Banner */}
            <div 
                className="mac-command-banner" 
                style={{ 
                    marginBottom: '1.75rem', 
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <img
                        src="/logowebp/doj-logo.webp"
                        alt="DOJ Logo"
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 14px rgba(37, 99, 235, 0.45))' }}
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
                                    gap: '4px',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al DOJ' : 'Back to DOJ Hub'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'Department of Justice • Fiscalía' : 'Department of Justice • Inquiries'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'INVESTIGACIONES JUDICIALES' : 'LEGAL INVESTIGATIONS'}
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
                            placeholder={language === 'es' ? "Buscar sumario, delito o lugar..." : "Search case or location..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* New Case Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={() => setShowCreateModal(true)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            padding: '0.6rem 1.1rem', 
                            background: 'rgba(59, 130, 246, 0.25)', 
                            border: '1px solid rgba(59, 130, 246, 0.5)', 
                            color: '#93c5fd',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nueva Investigación' : 'New Investigation'}</span>
                    </button>
                </div>
            </div>

            {/* Admin Wipe Management Bar (ONLY VISIBLE FOR ADMINISTRATORS) */}
            {isAdmin && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '14px',
                    padding: '0.75rem 1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.85rem',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontSize: '1.05rem' }}>📁</span> Carpeta de Wipe:
                        </span>

                        <select
                            className="mac-form-input"
                            style={{
                                padding: '0.35rem 0.8rem',
                                fontSize: '0.84rem',
                                width: 'auto',
                                minWidth: '190px',
                                background: 'rgba(0, 0, 0, 0.5)',
                                color: '#ffffff',
                                borderColor: viewingWipeFolder !== activeWipeFolder ? '#f59e0b' : 'rgba(255, 255, 255, 0.25)',
                                fontWeight: 600
                            }}
                            value={viewingWipeFolder}
                            onChange={(e) => handleChangeViewingWipe(e.target.value)}
                        >
                            {wipeFolders.map(folder => (
                                <option key={folder} value={folder}>
                                    {folder} {folder === activeWipeFolder ? '★ (Activa en la web)' : ''}
                                </option>
                            ))}
                        </select>

                        {viewingWipeFolder !== activeWipeFolder ? (
                            <span style={{
                                fontSize: '0.74rem',
                                color: '#fbbf24',
                                background: 'rgba(245, 158, 11, 0.18)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                padding: '0.22rem 0.65rem',
                                borderRadius: '9999px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}>
                                🔒 Vista archivada (Solo Admin)
                            </span>
                        ) : (
                            <span style={{
                                fontSize: '0.74rem',
                                color: '#34d399',
                                background: 'rgba(16, 185, 129, 0.18)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                padding: '0.22rem 0.65rem',
                                borderRadius: '9999px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}>
                                🌐 Activa (Visible para todos)
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className={`mac-btn ${selectionMode ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                            onClick={() => {
                                setSelectionMode(!selectionMode);
                                if (selectionMode) setSelectedCaseIds([]);
                            }}
                        >
                            {selectionMode ? '✕ Cancelar selección' : '☑️ Seleccionar a dedo'}
                        </button>

                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                            onClick={() => handleOpenMoveModal()}
                        >
                            📦 Almacenar en Wipe
                        </button>

                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                            onClick={() => setShowWipeManagerModal(true)}
                        >
                            ⚙️ Gestión de Wipes
                        </button>
                    </div>
                </div>
            )}

            {/* Selection Toolbar (When selectionMode is active) */}
            {isAdmin && selectionMode && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '0.65rem 1.1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    <span style={{ fontSize: '0.86rem', color: '#10b981', fontWeight: 700 }}>
                        ✓ {selectedCaseIds.length} caso(s) seleccionado(s) a dedo
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                            onClick={handleSelectAllFiltered}
                        >
                            {filteredCases.length > 0 && filteredCases.every(c => selectedCaseIds.includes(c.id))
                                ? 'Desmarcar visibles'
                                : '✓ Seleccionar todos los casos visibles'}
                        </button>
                        {selectedCaseIds.length > 0 && (
                            <button
                                type="button"
                                className="mac-btn mac-btn-primary"
                                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                                onClick={() => handleOpenMoveModal('selected')}
                            >
                                📦 Mover {selectedCaseIds.length} caso(s) a Wipe...
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Filter Pill Tabs */}
            <div className="mac-doc-tabs" style={{ marginBottom: '1.75rem' }}>
                {[
                    {
                        id: 'Open',
                        label: language === 'es' ? 'Sumarios Abiertos' : 'Open Cases',
                        color: '#10b981',
                        icon: (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        )
                    },
                    {
                        id: 'Closed',
                        label: language === 'es' ? 'Sumarios Cerrados' : 'Closed Cases',
                        color: '#ef4444',
                        icon: (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        )
                    },
                    {
                        id: 'Archived',
                        label: language === 'es' ? 'Sumarios Archivados' : 'Archived Cases',
                        color: '#64748b',
                        icon: (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="21 8 21 21 3 21 3 8"/>
                                <rect x="1" y="3" width="22" height="5"/>
                                <line x1="10" y1="12" x2="14" y2="12"/>
                            </svg>
                        )
                    }
                ].map(status => (
                    <button
                        key={status.id}
                        className={`mac-doc-tab ${filter === status.id ? 'active' : ''}`}
                        onClick={() => setFilter(status.id)}
                        style={{
                            borderColor: filter === status.id ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
                            backgroundColor: filter === status.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            color: filter === status.id ? '#ffffff' : '#94a3b8'
                        }}
                    >
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                    </button>
                ))}
            </div>

            {/* Cases List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#3b82f6', width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginBottom: '0.5rem' }}></span>
                    <div>{language === 'es' ? 'Cargando investigaciones del Departamento de Justicia...' : 'Loading DOJ investigations...'}</div>
                </div>
            ) : filteredCases.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        {language === 'es' ? `No se encontraron investigaciones en estado ${filter}` : `No ${filter.toLowerCase()} investigations found.`}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Utilice el botón superior para abrir un nuevo sumario' : 'Use the button above to register a new investigation'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                    {filteredCases.map(c => {
                        const statusColor = statusColors[c.status] || '#64748b';
                        return (
                            <div
                                key={c.id}
                                onClick={() => {
                                    if (selectionMode) {
                                        toggleCaseSelection(c.id);
                                    } else {
                                        navigate(`/doj/cases/${c.id}`);
                                    }
                                }}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderLeft: `4px solid ${statusColor}`,
                                    borderRadius: '18px',
                                    padding: '1.4rem 1.6rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                                    position: 'relative',
                                    boxShadow: selectedCaseIds.includes(c.id) ? '0 0 0 2px #10b981, 0 14px 30px -8px rgba(16, 185, 129, 0.4)' : undefined
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = selectedCaseIds.includes(c.id)
                                        ? '0 0 0 2px #10b981, 0 18px 36px rgba(16, 185, 129, 0.45)'
                                        : `0 14px 30px -8px rgba(0,0,0,0.5), 0 0 0 1px ${statusColor}40`;
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                                    e.currentTarget.style.borderLeftColor = statusColor;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = selectedCaseIds.includes(c.id)
                                        ? '0 0 0 2px #10b981, 0 14px 30px -8px rgba(16, 185, 129, 0.4)'
                                        : 'none';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderLeftColor = statusColor;
                                }}
                            >
                                {/* Top Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        {isAdmin && selectionMode && (
                                            <input
                                                type="checkbox"
                                                checked={selectedCaseIds.includes(c.id)}
                                                onChange={() => toggleCaseSelection(c.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    accentColor: '#10b981',
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            />
                                        )}
                                        <span style={{ 
                                            fontFamily: 'monospace', 
                                            fontWeight: 700, 
                                            fontSize: '0.8rem', 
                                            color: '#60a5fa',
                                            background: 'rgba(59, 130, 246, 0.12)',
                                            border: '1px solid rgba(59, 130, 246, 0.25)',
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '8px'
                                        }}>
                                            DOJ-CASE #{String(c.case_number).padStart(3, '0')}
                                        </span>

                                        {isAdmin && c.wipe_folder && c.wipe_folder !== DEFAULT_WIPE_FOLDER && (
                                            <span style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                color: '#fbbf24',
                                                background: 'rgba(245, 158, 11, 0.15)',
                                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '6px'
                                            }}>
                                                📁 {c.wipe_folder}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ 
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                            color: statusColor,
                                            background: `${statusColor}18`,
                                            border: `1px solid ${statusColor}35`,
                                            padding: '0.2rem 0.65rem',
                                            borderRadius: '9999px'
                                        }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }}></span>
                                            {c.status}
                                        </span>

                                        {canDeleteCases && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteCase(e, c.id, c.case_number)}
                                                title={language === 'es' ? 'Eliminar Caso' : 'Delete Case'}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                    color: '#f87171',
                                                    borderRadius: '6px',
                                                    padding: '0.2rem 0.45rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Title */}
                                <h3 style={{ 
                                    margin: '0 0 0.75rem 0', 
                                    color: '#ffffff', 
                                    fontSize: '1.15rem',
                                    fontWeight: 700,
                                    lineHeight: 1.35
                                }}>
                                    {c.title}
                                </h3>

                                {/* Meta: Location & Date */}
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '1rem', 
                                    fontSize: '0.82rem', 
                                    color: '#94a3b8',
                                    marginBottom: '1.25rem',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span>{c.location || 'Localización N/A'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        <span>{new Date(c.occurred_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Footer: Agents Stack */}
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    marginTop: 'auto', 
                                    paddingTop: '0.9rem', 
                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {c.assigned_avatars && c.assigned_avatars.length > 0 ? (
                                            <div style={{ display: 'flex', marginRight: '0.65rem' }}>
                                                {c.assigned_avatars.map((img, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={img || '/logowebp/anon.webp'}
                                                        alt="Agent"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            marginLeft: idx > 0 ? '-8px' : '0',
                                                            border: '2px solid #0f172a',
                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                                {language === 'es' ? 'Sin fiscales asignados' : 'No agents assigned'}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                                            {language === 'es' ? 'Fiscales / Agentes' : 'Assigned Agents'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <span>{language === 'es' ? 'Ver sumario' : 'View File'}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="9 18 15 12 9 6"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* macOS Modal: Create New Investigation */}
            {showCreateModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowCreateModal(false)}>
                    <div 
                        className="mac-modal-container" 
                        style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Traffic light bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                DOJ • INQUIRY FILE
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                            {language === 'es' ? 'Apertura de Sumario / Investigación Judicial' : 'Open New Legal Investigation'}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.5rem 0' }}>
                            {language === 'es' 
                                ? 'Complete los antecedentes preliminares del expediente para dar curso legal a la causa.'
                                : 'Complete initial inquiry data to register the legal case in the Department of Justice.'}
                        </p>

                        <form onSubmit={handleCreateCase}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Título del Sumario / Asunto *' : 'Investigation Title *'}
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    required
                                    value={newCase.title}
                                    onChange={e => setNewCase({ ...newCase, title: e.target.value })}
                                    placeholder={language === 'es' ? "Ej: Causa Penal 418 — Investigación Fraude Fiscal" : "e.g. Legal Inquest 418 - Wire Fraud Inquiry"}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">
                                        {language === 'es' ? 'Lugar de los Hechos / Jurisdicción *' : 'Location / Jurisdiction *'}
                                    </label>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        required
                                        value={newCase.location}
                                        onChange={e => setNewCase({ ...newCase, location: e.target.value })}
                                        placeholder={language === 'es' ? "Ej: Juzgado de Distrito / Downtown" : "e.g. Downtown Federal Court"}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">
                                        {language === 'es' ? 'Fecha y Hora del Suceso *' : 'Date & Time *'}
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="mac-form-input"
                                        required
                                        value={newCase.occurred_at}
                                        onChange={e => setNewCase({ ...newCase, occurred_at: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Relato de Hechos / Resumen Inicial *' : 'Initial Report / Brief *'}
                                </label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows="4"
                                    required
                                    value={newCase.description}
                                    onChange={e => setNewCase({ ...newCase, description: e.target.value })}
                                    placeholder={language === 'es' ? "Detalle los antecedentes preliminares de la investigación..." : "Describe the preliminary case facts..."}
                                />
                            </div>

                            {/* Evidence Photo */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Fotografía de la Escena / Evidencia Inicial (Opcional)' : 'Initial Scene / Evidence Photo (Optional)'}
                                </label>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.6rem',
                                    padding: '0.85rem',
                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    color: '#cbd5e1',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                    <span>{newCase.initialImage ? (language === 'es' ? 'Foto Seleccionada (Clic para cambiar)' : 'Photo Selected (Click to change)') : (language === 'es' ? 'Subir Fotografía' : 'Upload Scene Photo')}</span>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                </label>

                                {newCase.initialImage && (
                                    <div style={{ position: 'relative', marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                                        <img src={newCase.initialImage} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} alt="Evidence" />
                                        <button
                                            type="button"
                                            onClick={() => setNewCase({ ...newCase, initialImage: null })}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(239, 68, 68, 0.9)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '24px',
                                                height: '24px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Assign DOJ Agents */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">
                                    {language === 'es' ? 'Asignar Fiscales / Agentes del DOJ' : 'Assign DOJ Agents'}
                                </label>
                                <div style={{
                                    maxHeight: '160px',
                                    overflowY: 'auto',
                                    background: 'rgba(0, 0, 0, 0.35)',
                                    padding: '0.6rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem'
                                }}>
                                    {users.length === 0 ? (
                                        <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '0.75rem', textAlign: 'center' }}>
                                            {language === 'es' ? 'No se encontraron agentes del DOJ.' : 'No DOJ agents found.'}
                                        </div>
                                    ) : (
                                        users.map(u => {
                                            const isSelected = newCase.assignments.includes(u.id);
                                            return (
                                                <div
                                                    key={u.id}
                                                    onClick={() => toggleAssignment(u.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        padding: '0.45rem 0.65rem',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                                                    />
                                                    <img
                                                        src={u.profile_image || '/logowebp/anon.webp'}
                                                        alt=""
                                                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                    <span style={{ fontSize: '0.86rem', color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: isSelected ? 600 : 400 }}>
                                                        {u.rango} {u.nombre} {u.apellido}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.6rem 1.2rem',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#ffffff',
                                        padding: '0.6rem 1.4rem',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)'
                                    }}
                                >
                                    {submitting ? (language === 'es' ? 'Creando...' : 'Creating...') : (language === 'es' ? 'Abrir Causa' : 'Create Case')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Wipe Folders Manager (ADMIN ONLY) */}
            {isAdmin && showWipeManagerModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '580px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowWipeManagerModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                ⚙️ Gestión de Carpetas de Wipe (Casos del DOJ)
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                                Las carpetas de wipe te permiten organizar y archivar temporadas o etapas de casos del Departamento de Justicia.
                                La carpeta marcada como <strong style={{ color: '#10b981' }}>Activa</strong> es la que verán los usuarios regulares.
                            </p>

                            {/* Create new folder input */}
                            <form onSubmit={handleCreateNewFolder} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder="Nombre de la nueva carpeta (ej: Wipe 2026)..."
                                    value={newFolderInput}
                                    onChange={(e) => setNewFolderInput(e.target.value)}
                                    style={{ flex: 1, padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    disabled={wipeActionLoading || !newFolderInput.trim()}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                                >
                                    + Crear Carpeta
                                </button>
                            </form>

                            {/* Folders List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto' }}>
                                {wipeFolders.map(folder => {
                                    const isActive = folder === activeWipeFolder;
                                    const stats = wipeStats[folder] || { total: 0, open: 0, closed: 0, archived: 0 };
                                    return (
                                        <div
                                            key={folder}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                                                border: isActive ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '10px',
                                                padding: '0.65rem 0.9rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                <span style={{ fontSize: '1.15rem' }}>
                                                    {isActive ? '⭐' : '📁'}
                                                </span>
                                                <div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        {folder}
                                                        {isActive && (
                                                            <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 800 }}>
                                                                ACTIVA
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                        {stats.total} caso(s) en total ({stats.open} abiertos, {stats.closed} cerrados, {stats.archived} archivados)
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                {!isActive && (
                                                    <button
                                                        type="button"
                                                        className="mac-btn mac-btn-primary"
                                                        style={{ fontSize: '0.74rem', padding: '0.35rem 0.65rem', background: '#059669' }}
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
                                                        style={{ fontSize: '0.74rem', padding: '0.35rem 0.65rem', color: '#f87171' }}
                                                        disabled={wipeActionLoading}
                                                        onClick={() => handleDeleteFolder(folder)}
                                                        title="Eliminar carpeta de wipe"
                                                    >
                                                        🗑️ Borrar
                                                    </button>
                                                )}
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

            {/* Modal: Move DOJ Cases into Wipe Folder (ADMIN ONLY) */}
            {isAdmin && showMoveCasesModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '560px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowMoveCasesModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                📦 Almacenar Casos del DOJ en Carpeta de Wipe
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            {/* Scope Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">¿Qué casos deseas trasladar?</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {selectedCaseIds.length > 0 && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', color: '#fff' }}>
                                            <input
                                                type="radio"
                                                name="moveScope"
                                                value="selected"
                                                checked={moveScope === 'selected'}
                                                onChange={() => setMoveScope('selected')}
                                                style={{ accentColor: '#10b981' }}
                                            />
                                            <span>
                                                Solo los <strong style={{ color: '#10b981' }}>{selectedCaseIds.length}</strong> caso(s) seleccionados a dedo
                                            </span>
                                        </label>
                                    )}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', color: '#fff' }}>
                                        <input
                                            type="radio"
                                            name="moveScope"
                                            value="all"
                                            checked={moveScope === 'all'}
                                            onChange={() => setMoveScope('all')}
                                            style={{ accentColor: '#10b981' }}
                                        />
                                        <span>
                                            <strong>Todos</strong> los casos de la carpeta actual (<em>{viewingWipeFolder}</em>) — abiertos, cerrados y archivados
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Target Folder Selector */}
                            <div className="mac-form-group" style={{ marginTop: '1rem' }}>
                                <label className="mac-form-label">Carpeta de Wipe de Destino:</label>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.84rem', color: '#fff' }}>
                                        <input
                                            type="radio"
                                            name="moveTargetType"
                                            value="existing"
                                            checked={moveTargetType === 'existing'}
                                            onChange={() => setMoveTargetType('existing')}
                                            style={{ accentColor: '#10b981' }}
                                        />
                                        <span>Elegir existente</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.84rem', color: '#fff' }}>
                                        <input
                                            type="radio"
                                            name="moveTargetType"
                                            value="new"
                                            checked={moveTargetType === 'new'}
                                            onChange={() => setMoveTargetType('new')}
                                            style={{ accentColor: '#10b981' }}
                                        />
                                        <span>Crear nueva carpeta</span>
                                    </label>
                                </div>

                                {moveTargetType === 'existing' ? (
                                    <select
                                        className="mac-form-input"
                                        value={targetMoveFolder}
                                        onChange={(e) => setTargetMoveFolder(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar carpeta de destino --</option>
                                        {wipeFolders
                                            .filter(f => moveScope === 'selected' || f !== viewingWipeFolder)
                                            .map(f => (
                                                <option key={f} value={f}>
                                                    {f === activeWipeFolder ? `⭐ ${f} (Activa)` : `📁 ${f}`}
                                                </option>
                                            ))
                                        }
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="Nombre de la nueva carpeta de wipe (ej: Wipe 2026)..."
                                        value={newMoveFolderInput}
                                        onChange={(e) => setNewMoveFolderInput(e.target.value)}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mac-modal-actions">
                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                onClick={() => setShowMoveCasesModal(false)}
                                disabled={wipeActionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="mac-btn mac-btn-primary"
                                onClick={handleConfirmMoveCases}
                                disabled={wipeActionLoading}
                            >
                                {wipeActionLoading ? 'Almacenando...' : 'Confirmar y Almacenar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJCases;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, uploadDocumentToStorage, processHtmlImages } from '../utils/imageStorage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
    DEFAULT_WIPE_FOLDER,
    getActiveWipeFolder,
    setActiveWipeFolder,
    getWipeFoldersList,
    createWipeFolder,
    deleteWipeFolder,
    moveCasesToWipeFolder,
    getWipeFoldersStats
} from '../services/casesWipeService';
import '../index.css';

function Cases() {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Open'); // Open, Closed, Archived
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { isLSSD, branding } = useTheme();
    const { t } = useLanguage();

    // Wipe Folders State
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
        initialImage: null,
        documents: []
    });
    const [users, setUsers] = useState([]); // For assignment selection
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Check if current user is an administrator
    const isAdmin = Boolean(
        currentUser && (
            (currentUser.rol || '').toLowerCase().trim() === 'administrador' ||
            (currentUser.rol || '').toLowerCase().trim() === 'superadmin' ||
            (currentUser.rol || '').toLowerCase().includes('admin')
        )
    );

    useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            let uProfile = null;
            if (user) {
                const { data } = await supabase.from('users').select('id, rol, rango, divisions').eq('id', user.id).single();
                uProfile = data;
                if (isMounted) setCurrentUser(data);
            }

            // Load active wipe folder and folders list
            const currentActive = await getActiveWipeFolder();
            const folders = await getWipeFoldersList();
            const stats = await getWipeFoldersStats();

            if (isMounted) {
                setActiveWipeFolderState(currentActive);
                setViewingWipeFolder(currentActive);
                setWipeFolders(folders);
                setWipeStats(stats);
                fetchCases(uProfile, currentActive);
                fetchUsers();
            }
        };
        loadInitial();
        return () => { isMounted = false; };
    }, []);

    // Re-fetch when filter or viewing wipe changes
    useEffect(() => {
        if (currentUser) {
            fetchCases(currentUser, viewingWipeFolder);
        }
    }, [filter, viewingWipeFolder]);

    const fetchCases = async (userProfile = currentUser, targetWipe = viewingWipeFolder) => {
        setLoading(true);
        try {
            const user = userProfile || currentUser;
            const userIsAdmin = user && (
                (user.rol || '').toLowerCase().trim() === 'administrador' ||
                (user.rol || '').toLowerCase().trim() === 'superadmin' ||
                (user.rol || '').toLowerCase().includes('admin')
            );

            // Regular users ONLY see the active wipe folder. Admins can view any wipe folder.
            const wipeToQuery = userIsAdmin 
                ? (targetWipe || activeWipeFolder || DEFAULT_WIPE_FOLDER) 
                : (activeWipeFolder || DEFAULT_WIPE_FOLDER);

            const isAyudante = (user?.rol || '').toLowerCase().trim() === 'ayudante';
            const userId = user?.id;

            let query = supabase
                .from('cases')
                .select(`
                    id,
                    case_number,
                    title,
                    status,
                    location,
                    occurred_at,
                    created_at,
                    created_by,
                    is_pinned,
                    wipe_folder,
                    case_assignments (
                        user_id,
                        users (
                            profile_image
                        )
                    )
                `)
                .order('is_pinned', { ascending: false, nullsFirst: false })
                .order('case_number', { ascending: false });

            if (filter) {
                query = query.ilike('status', filter);
            }

            // Wipe folder filter
            if (!wipeToQuery || wipeToQuery === DEFAULT_WIPE_FOLDER) {
                query = query.or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null,wipe_folder.eq.`);
            } else {
                query = query.eq('wipe_folder', wipeToQuery);
            }

            // If user has the Ayudante role, strictly load only cases where they are assigned or created by them
            if (isAyudante && userId) {
                const { data: assignments } = await supabase
                    .from('case_assignments')
                    .select('case_id')
                    .eq('user_id', userId);

                const assignedIds = (assignments || []).map(a => a.case_id);
                if (assignedIds.length > 0) {
                    query = query.or(`id.in.(${assignedIds.join(',')}),created_by.eq.${userId}`);
                } else {
                    query = query.eq('created_by', userId);
                }
            }

            const { data: directData, error: directErr } = await query;
            if (!directErr && directData) {
                const formatted = directData.map(c => ({
                    id: c.id,
                    case_number: c.case_number,
                    title: c.title,
                    status: c.status,
                    location: c.location,
                    occurred_at: c.occurred_at,
                    created_at: c.created_at,
                    is_pinned: Boolean(c.is_pinned),
                    wipe_folder: c.wipe_folder || DEFAULT_WIPE_FOLDER,
                    assigned_avatars: (c.case_assignments || [])
                        .map(ca => ca.users?.profile_image)
                        .filter(Boolean)
                        .slice(0, 3)
                }));
                setCases(formatted);
            } else {
                setCases([]);
            }
        } catch (err) {
            console.error('Error fetching cases:', err);
            setCases([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango').order('rango');
        setUsers(data || []);
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

            let uploadedDocuments = [];
            if (newCase.documents && newCase.documents.length > 0) {
                uploadedDocuments = await Promise.all(
                    newCase.documents.map(async (doc) => {
                        if (doc.isNew && doc.file) {
                            return await uploadDocumentToStorage(doc.file, 'cases');
                        }
                        return doc;
                    })
                );
                uploadedDocuments = uploadedDocuments.filter(d => d && d.url);
            }

            const finalDescription = await processHtmlImages(newCase.description, 'cases');

            let newId = null;
            const { data, error } = await supabase.rpc('create_new_case', {
                p_title: newCase.title,
                p_location: newCase.location,
                p_occurred_at: timestamp,
                p_description: finalDescription,
                p_assigned_ids: newCase.assignments,
                p_image: imageUrl,
                p_documents: uploadedDocuments
            });

            if (error) {
                if (error.message?.includes('create_new_case') || error.code === 'PGRST202') {
                    const fallbackRes = await supabase.rpc('create_new_case', {
                        p_title: newCase.title,
                        p_location: newCase.location,
                        p_occurred_at: timestamp,
                        p_description: finalDescription,
                        p_assigned_ids: newCase.assignments,
                        p_image: imageUrl
                    });
                    if (fallbackRes.error) throw fallbackRes.error;
                    newId = fallbackRes.data;

                    if (newId && uploadedDocuments.length > 0) {
                        await supabase
                            .from('cases')
                            .update({ documents: uploadedDocuments })
                            .eq('id', newId);
                    }
                } else {
                    throw error;
                }
            } else {
                newId = data;
            }

            // Assign case to current active wipe folder
            if (newId) {
                const curActive = await getActiveWipeFolder();
                await supabase
                    .from('cases')
                    .update({ wipe_folder: curActive || DEFAULT_WIPE_FOLDER })
                    .eq('id', newId);
            }

            setShowCreateModal(false);
            navigate(`/cases/${newId}`);

        } catch (err) {
            alert('Error creating case: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const isDetectiveBureauMember = () => {
        if (!currentUser) return false;
        const r = (currentUser.rol || '').toLowerCase().trim();
        const rank = (currentUser.rango || '').toLowerCase().trim();
        const divs = Array.isArray(currentUser.divisions) ? currentUser.divisions : [];
        if (divs.some(d => d && d.toLowerCase().includes('detective bureau'))) return true;
        if (rank.includes('detective') || rank.includes('sargento') || rank.includes('teniente') || rank.includes('capit') || rank.includes('comisario') || rank.includes('jefe')) return true;
        if (['administrador', 'coordinador', 'comisionado', 'detective', 'jefatura'].includes(r) || r.includes('detective') || r.includes('admin') || r.includes('jefatura')) return true;
        return false;
    };

    const canCreateCase = () => {
        if (!currentUser) return false;
        const r = (currentUser.rol || '').toLowerCase().trim();
        if (['invitado', 'externo', 'ayudante'].includes(r)) return false;
        return isDetectiveBureauMember();
    };

    const canPinCase = () => {
        if (!currentUser) return false;
        const r = (currentUser.rol || '').toLowerCase().trim();
        if (r === 'ayudante') return false;
        return isDetectiveBureauMember();
    };

    const handleTogglePin = async (e, caseId, currentPinned) => {
        e.stopPropagation();
        if (!canPinCase()) return;
        try {
            const { error } = await supabase.rpc('toggle_case_pin', { p_case_id: caseId, p_pinned: !currentPinned });
            if (error) throw error;
            fetchCases();
        } catch (err) {
            console.error('Error toggling pin:', err);
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
                setNewCase(prev => ({ ...prev, initialImage: dataUrl }));
            };
        };
    };

    const handleDocumentUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const MAX_SIZE_MB = 1;
        const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
        const validDocs = [];
        const oversized = [];

        files.forEach(file => {
            if (file.size > MAX_BYTES) {
                oversized.push(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
            } else {
                validDocs.push({
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/pdf',
                    isNew: true
                });
            }
        });

        if (oversized.length > 0) {
            alert(`Los siguientes archivos superan el límite máximo de ${MAX_SIZE_MB}MB:\n\n${oversized.join('\n')}\n\nPor favor, comprime el archivo o selecciona un documento menor a 1MB.`);
        }

        if (validDocs.length > 0) {
            setNewCase(prev => ({
                ...prev,
                documents: [...(prev.documents || []), ...validDocs]
            }));
        }
        e.target.value = '';
    };

    // Filter cases based on search query
    const filteredCases = cases.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const caseNumStr = String(c.case_number).padStart(3, '0');
        return c.title.toLowerCase().includes(q) || 
               c.location.toLowerCase().includes(q) || 
               caseNumStr.includes(q);
    });

    // -------------------------------------------------------------
    // WIPE MANAGEMENT HANDLERS (ADMIN ONLY)
    // -------------------------------------------------------------

    const handleChangeViewingWipe = (newFolder) => {
        setViewingWipeFolder(newFolder);
        setSelectedCaseIds([]);
    };

    const handleMakeActiveWipe = async (folder) => {
        if (!isAdmin) return;
        setWipeActionLoading(true);
        try {
            const ok = await setActiveWipeFolder(folder);
            if (ok) {
                setActiveWipeFolderState(folder);
                const stats = await getWipeFoldersStats();
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
            const updated = await createWipeFolder(trimmed);
            setWipeFolders(updated);
            setNewFolderInput('');
            const stats = await getWipeFoldersStats();
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
            const updated = await deleteWipeFolder(folder, DEFAULT_WIPE_FOLDER);
            setWipeFolders(updated);
            if (viewingWipeFolder === folder) {
                setViewingWipeFolder(DEFAULT_WIPE_FOLDER);
            }
            const active = await getActiveWipeFolder();
            setActiveWipeFolderState(active);
            const stats = await getWipeFoldersStats();
            setWipeStats(stats);
            await fetchCases(currentUser, viewingWipeFolder === folder ? DEFAULT_WIPE_FOLDER : viewingWipeFolder);
            alert(`✓ Carpeta "${folder}" eliminada.`);
        } catch (err) {
            alert('Error eliminando carpeta: ' + err.message);
        } finally {
            setWipeActionLoading(false);
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
                await moveCasesToWipeFolder({
                    caseIds: selectedCaseIds,
                    targetFolder: destination
                });
                alert(`✓ Se han movido ${selectedCaseIds.length} caso(s) a la carpeta "${destination}".`);
            } else {
                await moveCasesToWipeFolder({
                    caseIds: 'all',
                    sourceFolder: viewingWipeFolder,
                    targetFolder: destination
                });
                alert(`✓ Todos los casos de "${viewingWipeFolder}" se han almacenado en la carpeta de wipe "${destination}".`);
            }

            setShowMoveCasesModal(false);
            setSelectedCaseIds([]);
            setSelectionMode(false);

            // Refrescar lista de carpetas, estadísticas y casos
            const updatedFolders = await getWipeFoldersList();
            setWipeFolders(updatedFolders);
            const stats = await getWipeFoldersStats();
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

    return (
        <div className="mac-dashboard-container">
            {/* Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img 
                        src={branding?.cases_logo || (isLSSD ? "/logowebp/Generalcrimes.webp" : "/logowebp/mcd.webp")} 
                        alt="Division Logo" 
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = isLSSD ? "/logowebp/Generalcrimes.webp" : "/logowebp/mcd.webp";
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="mac-status-dot"></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {branding?.cases_subtitle || (isLSSD ? "Sheriff Criminal Unit Bureau" : "Detective Bureau Division")}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {branding?.cases_title || (isLSSD ? "GENERAL CRIMES DIVISION" : "MAJOR CRIMES DIVISION")}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                            placeholder="Buscar expediente o caso..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* New Case Button */}
                    {canCreateCase() && (
                        <button 
                            className="mac-btn mac-btn-primary" 
                            onClick={() => setShowCreateModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>{t('openNewCaseBtn')?.replace('+', '').trim() || 'Abrir Nuevo Caso'}</span>
                        </button>
                    )}
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
                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                            onClick={handleSelectAllFiltered}
                        >
                            {filteredCases.every(c => selectedCaseIds.includes(c.id)) && filteredCases.length > 0
                                ? 'Deseleccionar filtrados'
                                : `Seleccionar todos (${filteredCases.length})`}
                        </button>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                            onClick={() => setSelectedCaseIds([])}
                            disabled={selectedCaseIds.length === 0}
                        >
                            Limpiar
                        </button>
                        <button
                            type="button"
                            className="mac-btn mac-btn-primary"
                            style={{ fontSize: '0.76rem', padding: '0.35rem 0.85rem' }}
                            disabled={selectedCaseIds.length === 0}
                            onClick={() => handleOpenMoveModal('selected')}
                        >
                            Mover {selectedCaseIds.length} seleccionado(s)
                        </button>
                    </div>
                </div>
            )}

            {/* Archived Wipe Warning Banner (Admin Only) */}
            {isAdmin && viewingWipeFolder !== activeWipeFolder && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(217, 119, 6, 0.08))',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: '12px',
                    padding: '0.85rem 1.2rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.85rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>📁</span>
                        <div>
                            <strong style={{ color: '#fbbf24', fontSize: '0.92rem', display: 'block' }}>
                                Viendo carpeta archivada: "{viewingWipeFolder}"
                            </strong>
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                Esta carpeta es privada y solo visible para administradores. Los usuarios regulares están viendo la carpeta activa "{activeWipeFolder}".
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
                            onClick={() => handleChangeViewingWipe(activeWipeFolder)}
                        >
                            ↩️ Volver a "{activeWipeFolder}"
                        </button>
                        <button
                            type="button"
                            className="mac-btn mac-btn-primary"
                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', background: '#d97706' }}
                            onClick={() => handleMakeActiveWipe(viewingWipeFolder)}
                            disabled={wipeActionLoading}
                        >
                            ⭐ Hacer carpeta activa en la web
                        </button>
                    </div>
                </div>
            )}

            {/* Filter Pill Tabs */}
            <div className="mac-doc-tabs" style={{ marginBottom: '1.75rem' }}>
                {[
                    { id: 'Open', label: t('openCasesBtn') || 'Casos Abiertos', icon: '🟢' },
                    { id: 'Closed', label: t('closedCasesBtn') || 'Casos Cerrados', icon: '🔴' },
                    { id: 'Archived', label: t('archivedCasesBtn') || 'Casos Archivados', icon: '📁' }
                ].map(status => (
                    <button
                        key={status.id}
                        className={`mac-doc-tab ${filter === status.id ? 'active' : ''}`}
                        onClick={() => setFilter(status.id)}
                    >
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                    </button>
                ))}
            </div>

            {/* Cases List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite' }}></span>
                    <span>{t('loadingCases') || 'Cargando expedientes policiales...'}</span>
                </div>
            ) : filteredCases.length === 0 ? (
                <div className="mac-doc-empty">
                    <span>{t('noCasesFound')?.replace('{status}', filter.toLowerCase()) || `No se encontraron casos registrados con estado "${filter.toLowerCase()}".`}</span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                    {filteredCases.map(c => {
                        const isPinned = c.is_pinned;
                        const isSelected = selectedCaseIds.includes(c.id);
                        const statusColor = c.status === 'Open' ? '#10b981' : c.status === 'Closed' ? '#ef4444' : '#64748b';
                        const statusText = c.status === 'Open' ? 'Abierto' : c.status === 'Closed' ? 'Cerrado' : 'Archivado';

                        return (
                            <div
                                key={c.id}
                                className="mac-widget-card"
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                                    borderLeft: `4px solid ${statusColor}`,
                                    borderColor: isSelected ? '#10b981' : undefined,
                                    boxShadow: isSelected ? '0 0 0 2px #10b981, 0 12px 28px rgba(16, 185, 129, 0.25)' : undefined,
                                    padding: '1.35rem'
                                }}
                                onClick={() => {
                                    if (isAdmin && selectionMode) {
                                        toggleCaseSelection(c.id);
                                    } else {
                                        navigate(`/cases/${c.id}`);
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    if (!isSelected) e.currentTarget.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    if (!isSelected) e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        {/* Admin Selection Checkbox */}
                                        {isAdmin && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleCaseSelection(c.id);
                                                }}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                                                    border: isSelected ? '1.5px solid #10b981' : '1.5px solid rgba(255, 255, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    width: '18px',
                                                    height: '18px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ffffff',
                                                    fontSize: '11px',
                                                    fontWeight: 800,
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={isSelected ? "Deseleccionar caso" : "Seleccionar caso a dedo"}
                                            >
                                                {isSelected ? '✓' : ''}
                                            </div>
                                        )}

                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.08em',
                                            color: '#cbd5e1',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '6px'
                                        }}>
                                            CASO #{String(c.case_number).padStart(3, '0')}
                                        </span>

                                        {isPinned && (
                                            <span style={{ fontSize: '0.85rem', color: '#fbbf24' }} title="Caso Anclado">
                                                📌
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {canPinCase() && (
                                            <button 
                                                onClick={(e) => handleTogglePin(e, c.id, c.is_pinned)}
                                                style={{ 
                                                    background: 'transparent', 
                                                    border: 'none', 
                                                    cursor: 'pointer', 
                                                    fontSize: '0.95rem', 
                                                    padding: '0.2rem',
                                                    opacity: isPinned ? 1 : 0.35, 
                                                    transition: 'opacity 0.2s ease, transform 0.15s ease' 
                                                }}
                                                title={isPinned ? "Desanclar Caso" : "Anclar Caso"}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = isPinned ? '1' : '0.35'}
                                            >
                                                📌
                                            </button>
                                        )}

                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.06em',
                                            color: statusColor,
                                            textTransform: 'uppercase',
                                            background: `${statusColor}18`,
                                            border: `1px solid ${statusColor}33`,
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '9999px'
                                        }}>
                                            {statusText}
                                        </span>
                                    </div>
                                </div>

                                {/* Case Title */}
                                <h3 style={{ 
                                    margin: '0.25rem 0 0.6rem 0', 
                                    fontSize: '1.15rem', 
                                    fontWeight: 700, 
                                    color: '#ffffff',
                                    lineHeight: '1.35',
                                    letterSpacing: '-0.01em'
                                }}>
                                    {c.title}
                                </h3>

                                {/* Location & Timestamp */}
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.35rem', 
                                    fontSize: '0.82rem', 
                                    color: '#94a3b8', 
                                    marginBottom: '1.1rem' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>📍</span>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {c.location || 'Ubicación no especificada'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>📅</span>
                                        <span>{new Date(c.occurred_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                {/* Assigned Detectives Footer Stack */}
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    marginTop: 'auto', 
                                    paddingTop: '0.85rem', 
                                    borderTop: '1px solid rgba(255, 255, 255, 0.08)' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {c.assigned_avatars && c.assigned_avatars.length > 0 ? (
                                            c.assigned_avatars.map((img, idx) => (
                                                <img
                                                    key={idx}
                                                    src={img || '/logowebp/anon.webp'}
                                                    alt="Detective"
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        marginLeft: idx > 0 ? '-8px' : '0',
                                                        border: '2px solid rgba(16, 22, 36, 0.9)',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                                                    }}
                                                />
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>Sin asignar</span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
                                        {t('assigned') || 'Agentes Asignados'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal 1: Create Case Modal */}
            {showCreateModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '640px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowCreateModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                {t('openNewCaseFile') || 'Apertura de Nuevo Expediente Policial'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            <form onSubmit={handleCreateCase}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">{t('caseTitle') || 'Título del Caso'}</label>
                                    <input 
                                        type="text" 
                                        className="mac-form-input" 
                                        required
                                        value={newCase.title} 
                                        onChange={e => setNewCase({ ...newCase, title: e.target.value })} 
                                        placeholder={t('caseTitlePlaceholder') || 'Ej: Homicidio en Rockford Hills'} 
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="mac-form-group">
                                        <label className="mac-form-label">{t('location') || 'Lugar de los Hechos'}</label>
                                        <input 
                                            type="text" 
                                            className="mac-form-input" 
                                            required
                                            value={newCase.location} 
                                            onChange={e => setNewCase({ ...newCase, location: e.target.value })} 
                                            placeholder={t('locationPlaceholder') || 'Ej: Vinewood Blvd / Alta St'} 
                                        />
                                    </div>
                                    <div className="mac-form-group">
                                        <label className="mac-form-label">{t('dateTime') || 'Fecha y Hora'}</label>
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
                                    <label className="mac-form-label">{t('initialReport') || 'Informe Inicial / Detalles'}</label>
                                    <textarea 
                                        className="mac-form-textarea" 
                                        rows="4" 
                                        required
                                        value={newCase.description} 
                                        onChange={e => setNewCase({ ...newCase, description: e.target.value })} 
                                        placeholder={t('initialReportPlaceholder') || 'Describe los hallazgos iniciales del incidente...'} 
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{t('evidencePhoto') || 'Fotografía de Evidencia Principal'}</label>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.85rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        color: '#cbd5e1',
                                        fontSize: '0.85rem',
                                        transition: 'border-color 0.2s ease, background 0.2s ease'
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                        <span>{t('addPhoto') || 'Adjuntar Fotografía / Escena'}</span>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                    </label>
                                    
                                    {newCase.initialImage && (
                                        <div style={{ position: 'relative', marginTop: '0.75rem' }}>
                                            <img 
                                                src={newCase.initialImage} 
                                                style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)' }} 
                                                alt="Evidence" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setNewCase({ ...newCase, initialImage: null })} 
                                                style={{ 
                                                    position: 'absolute', 
                                                    top: 8, 
                                                    right: 8, 
                                                    background: 'rgba(239, 68, 68, 0.9)', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '50%', 
                                                    width: '24px', 
                                                    height: '24px', 
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{t('attachedDocuments') || 'Documentos / Archivos Adjuntos'}</span>
                                        {newCase.documents?.length > 0 && (
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{newCase.documents.length} adjunto(s)</span>
                                        )}
                                    </label>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.85rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        color: '#cbd5e1',
                                        fontSize: '0.85rem',
                                        transition: 'border-color 0.2s ease, background 0.2s ease'
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        <span>📎 {t('uploadDocumentsBtn') || 'Adjuntar Documentos / Archivos (PDF, DOC, etc.)'}</span>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept=".pdf,application/pdf,.doc,.docx,.txt,.xls,.xlsx,.zip,.rar,.csv,.png,.jpg,.jpeg" 
                                            onChange={handleDocumentUpload} 
                                            style={{ display: 'none' }} 
                                        />
                                    </label>

                                    {newCase.documents?.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.75rem' }}>
                                            {newCase.documents.map((doc, i) => {
                                                const isPdf = (doc.name && doc.name.toLowerCase().endsWith('.pdf')) || (doc.type && doc.type.includes('pdf'));
                                                const sizeText = doc.size ? (doc.size < 1024 * 1024 ? `${(doc.size / 1024).toFixed(0)} KB` : `${(doc.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                                                return (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '6px 10px',
                                                            background: 'rgba(0,0,0,0.35)',
                                                            borderRadius: '8px',
                                                            border: isPdf ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                                            fontSize: '0.82rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, marginRight: '10px' }}>
                                                            <span style={{ fontSize: '1rem' }}>{isPdf ? '📕' : '📄'}</span>
                                                            <span style={{ color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>
                                                                {doc.name || `Documento ${i + 1}`}
                                                            </span>
                                                            {sizeText && (
                                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>
                                                                    ({sizeText})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewCase(prev => ({
                                                                ...prev,
                                                                documents: prev.documents.filter((_, idx) => idx !== i)
                                                            }))}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                color: '#f87171',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                borderRadius: '4px',
                                                                width: '22px',
                                                                height: '22px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            title="Eliminar archivo"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{t('assignDetectives') || 'Asignar Detectives Encargados'}</label>
                                    <div style={{ 
                                        maxHeight: '140px', 
                                        overflowY: 'auto', 
                                        background: 'rgba(0,0,0,0.4)', 
                                        padding: '0.5rem', 
                                        borderRadius: '12px', 
                                        border: '1px solid rgba(255,255,255,0.12)' 
                                    }}>
                                        {users.map(u => (
                                            <div 
                                                key={u.id}
                                                onClick={() => toggleAssignment(u.id)}
                                                style={{
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    padding: '0.45rem 0.6rem', 
                                                    cursor: 'pointer', 
                                                    background: newCase.assignments.includes(u.id) ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                                    borderRadius: '8px',
                                                    marginBottom: '2px',
                                                    transition: 'background 0.15s ease'
                                                }}
                                            >
                                                <input type="checkbox" checked={newCase.assignments.includes(u.id)} readOnly style={{ marginRight: '10px' }} />
                                                <img src={u.profile_image || '/logowebp/anon.webp'} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover' }} />
                                                <span style={{ fontSize: '0.85rem', color: '#ffffff' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mac-modal-actions">
                                    <button 
                                        type="button" 
                                        className="mac-btn mac-btn-secondary" 
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        {t('cancelBtn') || 'Cancelar'}
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="mac-btn mac-btn-primary" 
                                        disabled={submitting}
                                    >
                                        {submitting ? (t('creatingCase') || 'Abriendo Expediente...') : (t('createCaseFileBtn') || 'Aperturar Expediente')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 2: Wipe Manager Modal (ADMIN ONLY) */}
            {isAdmin && showWipeManagerModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-card" style={{ maxWidth: '680px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowWipeManagerModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                ⚙️ Gestión de Carpetas de Wipe (Solo Administradores)
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            {/* Explanatory Banner */}
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                marginBottom: '1.25rem',
                                fontSize: '0.82rem',
                                color: '#bfdbfe'
                            }}>
                                💡 <strong>¿Cómo funcionan las carpetas de Wipe?</strong>
                                <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, lineHeight: 1.5 }}>
                                    <li>La carpeta marcada como <strong>⭐ ACTIVA EN LA WEB</strong> es la única visible para los usuarios normales.</li>
                                    <li>Las demás carpetas permanecen archivadas de forma segura y solo los administradores pueden verlas y gestionarlas.</li>
                                    <li>Cada carpeta guarda todos los casos asociados (tanto abiertos, como cerrados y archivados).</li>
                                </ul>
                            </div>

                            {/* Create New Folder Section */}
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.25)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '1rem',
                                marginBottom: '1.25rem'
                            }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', marginBottom: '0.5rem' }}>
                                    ➕ Crear Nueva Carpeta de Wipe
                                </label>
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        style={{ flex: 1 }}
                                        placeholder="Ej: Wipe 2026, Temporada 3, Wipe Invierno..."
                                        value={newFolderInput}
                                        onChange={(e) => setNewFolderInput(e.target.value)}
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
                                        disabled={wipeActionLoading || !newFolderInput.trim()}
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
                                    const stats = wipeStats[folder] || { total: 0, open: 0, closed: 0, archived: 0 };

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
                                                            👁️ Ver casos
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
                                                <span><strong>Total:</strong> {stats.total} caso(s)</span>
                                                <span style={{ color: '#34d399' }}>🟢 Abiertos: {stats.open}</span>
                                                <span style={{ color: '#f87171' }}>🔴 Cerrados: {stats.closed}</span>
                                                <span style={{ color: '#94a3b8' }}>📁 Archivados: {stats.archived}</span>
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

            {/* Modal 3: Move Cases into Wipe Folder Modal (ADMIN ONLY) */}
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
                                📦 Almacenar Casos en Carpeta de Wipe
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            {/* Scope Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">¿Qué casos deseas trasladar?</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {selectedCaseIds.length > 0 && (
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            background: moveScope === 'selected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)',
                                            border: moveScope === 'selected' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '0.65rem 0.85rem',
                                            cursor: 'pointer',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}>
                                            <input
                                                type="radio"
                                                name="moveScope"
                                                value="selected"
                                                checked={moveScope === 'selected'}
                                                onChange={() => setMoveScope('selected')}
                                            />
                                            <span>
                                                Mover los <strong>{selectedCaseIds.length}</strong> casos seleccionados a mano
                                            </span>
                                        </label>
                                    )}

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        background: moveScope === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)',
                                        border: moveScope === 'all' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '0.65rem 0.85rem',
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}>
                                        <input
                                            type="radio"
                                            name="moveScope"
                                            value="all"
                                            checked={moveScope === 'all'}
                                            onChange={() => setMoveScope('all')}
                                        />
                                        <span>
                                            Mover <strong>TODOS</strong> los casos de la carpeta "{viewingWipeFolder}" (Total: {wipeStats[viewingWipeFolder]?.total || cases.length} casos: abiertos, cerrados y archivados)
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Destination Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">Carpeta de Wipe de Destino</label>
                                
                                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                    <button
                                        type="button"
                                        className={`mac-btn ${moveTargetType === 'existing' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem' }}
                                        onClick={() => setMoveTargetType('existing')}
                                    >
                                        Elegir existente
                                    </button>
                                    <button
                                        type="button"
                                        className={`mac-btn ${moveTargetType === 'new' ? 'mac-btn-primary' : 'mac-btn-secondary'}`}
                                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem' }}
                                        onClick={() => setMoveTargetType('new')}
                                    >
                                        ➕ Crear nueva carpeta
                                    </button>
                                </div>

                                {moveTargetType === 'existing' ? (
                                    <select
                                        className="mac-form-input"
                                        value={targetMoveFolder}
                                        onChange={(e) => setTargetMoveFolder(e.target.value)}
                                    >
                                        <option value="">-- Selecciona una carpeta existente --</option>
                                        {wipeFolders.map(folder => (
                                            <option key={folder} value={folder} disabled={folder === viewingWipeFolder && moveScope === 'all'}>
                                                {folder} {folder === viewingWipeFolder ? '(Carpeta actual)' : ''} {folder === activeWipeFolder ? '★ (Activa en la web)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="Nombre de la nueva carpeta (ej: Wipe 2026, Wipe 2025...)"
                                        value={newMoveFolderInput}
                                        onChange={(e) => setNewMoveFolderInput(e.target.value)}
                                        autoFocus
                                    />
                                )}
                            </div>

                            {/* Info note */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '8px',
                                padding: '0.75rem',
                                fontSize: '0.78rem',
                                color: '#94a3b8'
                            }}>
                                ℹ️ Los casos mantendrán todas sus novedades, investigaciones, fotografías, evidencias adjuntas y su estado actual (abierto, cerrado o archivado).
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
                                {wipeActionLoading ? 'Almacenando casos...' : 'Confirmar y Almacenar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Cases;

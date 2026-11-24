import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { parseMultipleBallisticReports, parseSingleBallisticReport } from '../utils/ballisticsParser';
import {
    DEFAULT_WIPE_FOLDER,
    getActiveBallisticsWipeFolder,
    setActiveBallisticsWipeFolder,
    getBallisticsWipeFoldersList,
    createBallisticsWipeFolder,
    deleteBallisticsWipeFolder,
    moveBallisticsToWipeFolder,
    getBallisticsWipeFoldersStats
} from '../services/ballisticsWipeService';
import '../index.css';

function Ballistics() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useLanguage();
    const { isLSSD } = useTheme();

    // Data states
    const [bullets, setBullets] = useState([]);
    const [weapons, setWeapons] = useState([]);
    const [coincidences, setCoincidences] = useState([]);
    const [ballisticsMatches, setBallisticsMatches] = useState([]);
    const [casesList, setCasesList] = useState([]);
    const [coincidenceFilter, setCoincidenceFilter] = useState('all'); // all, open, linked, rejected
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dbError, setDbError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // User & Wipe states
    const [currentUser, setCurrentUser] = useState(null);
    const [activeWipeFolder, setActiveWipeFolderState] = useState(DEFAULT_WIPE_FOLDER);
    const [viewingWipeFolder, setViewingWipeFolder] = useState(DEFAULT_WIPE_FOLDER);
    const [wipeFolders, setWipeFolders] = useState([DEFAULT_WIPE_FOLDER]);
    const [wipeStats, setWipeStats] = useState({});
    const [selectedBulletIds, setSelectedBulletIds] = useState([]);
    const [selectedWeaponIds, setSelectedWeaponIds] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [showWipeManagerModal, setShowWipeManagerModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [newWipeFolderName, setNewWipeFolderName] = useState('');
    const [targetMoveFolder, setTargetMoveFolder] = useState('');
    const [isCreatingNewMoveFolder, setIsCreatingNewMoveFolder] = useState(false);
    const [moveMode, setMoveMode] = useState('selected'); // 'selected' | 'all'
    const [wipeActionLoading, setWipeActionLoading] = useState(false);

    const isAdmin = Boolean(
        currentUser && (
            (currentUser.rol || '').toLowerCase().trim() === 'administrador' ||
            (currentUser.rol || '').toLowerCase().trim() === 'superadmin' ||
            (currentUser.rol || '').toLowerCase().includes('admin')
        )
    );
    const isAyudante = (currentUser?.rol || '').toLowerCase().trim() === 'ayudante';

    // Case Linking / Rejection Modals
    const [linkMatchModal, setLinkMatchModal] = useState({ open: false, group: null });
    const [rejectMatchModal, setRejectMatchModal] = useState({ open: false, group: null });
    const [selectedCaseForLink, setSelectedCaseForLink] = useState('');
    const [rejectionReasonInput, setRejectionReasonInput] = useState('');
    const [linkBulletModal, setLinkBulletModal] = useState({ open: false, bullet: null });
    const [linkWeaponModal, setLinkWeaponModal] = useState({ open: false, weapon: null });

    // Modals visibility & edit targets
    const [showWeaponModal, setShowWeaponModal] = useState(false);
    const [showBulletModal, setShowBulletModal] = useState(false);
    const [editingBullet, setEditingBullet] = useState(null);
    const [editingWeapon, setEditingWeapon] = useState(null);

    // Batch Bullet Form State
    const [bulletBatchIncident, setBulletBatchIncident] = useState('');
    const [bulletBatchDescription, setBulletBatchDescription] = useState('');
    const [bulletRows, setBulletRows] = useState([
        { id: 1, num_serie: '', calibre: '', modelo_arma: '' }
    ]);
    const [bulletPasteText, setBulletPasteText] = useState('');
    const [showBulletPasteBox, setShowBulletPasteBox] = useState(false);
    const [bulletPasteSuccessMsg, setBulletPasteSuccessMsg] = useState('');

    // Batch Weapon Form State
    const [weaponBatchIncident, setWeaponBatchIncident] = useState('');
    const [weaponRows, setWeaponRows] = useState([
        { id: 1, propietario: '', modelo: '', num_serie: '' }
    ]);

    // Single Edit Forms
    const [editBulletForm, setEditBulletForm] = useState({
        incidente: '',
        num_serie: '',
        calibre: '',
        modelo_arma: '',
        descripcion_incidente: ''
    });
    const [editBulletPasteText, setEditBulletPasteText] = useState('');
    const [showEditBulletPasteBox, setShowEditBulletPasteBox] = useState(false);

    const [editWeaponForm, setEditWeaponForm] = useState({
        propietario: '',
        incidente: '',
        modelo: '',
        num_serie: ''
    });

    // Match alerts state
    const [alertMatch, setAlertMatch] = useState(null);
    const [seenMatchIds, setSeenMatchIds] = useState([]);
    const [activeTab, setActiveTab] = useState('coincidences');
    const [expandedWeapons, setExpandedWeapons] = useState([]);

    // Duplicate detection helpers
    const getBulletRowDuplicateInfo = (row) => {
        const sn = (row.num_serie || '').trim().toLowerCase();
        if (!sn || sn === 'n/a') return null;

        // Check in batch
        const inBatchCount = bulletRows.filter(r => (r.num_serie || '').trim().toLowerCase() === sn).length;
        if (inBatchCount > 1) {
            return { type: 'batch', message: '❌ Número de serie repetido en este mismo grupo' };
        }

        // Check in DB
        const currentIncidentClean = (bulletBatchIncident || '').trim().toLowerCase();
        const matchingBullets = bullets.filter(b => (b.numero_serie || '').trim().toLowerCase() === sn);
        if (matchingBullets.length > 0) {
            const sameIncidentMatch = matchingBullets.find(b => (b.incidente_relacionado || '').trim().toLowerCase() === currentIncidentClean);
            if (sameIncidentMatch && currentIncidentClean) {
                return { 
                    type: 'db', 
                    message: `❌ Ya existe en este mismo incidente (${sameIncidentMatch.incidente_relacionado || 'N/A'})` 
                };
            } else {
                const otherIncidents = [...new Set(matchingBullets.map(b => b.incidente_relacionado || 'N/A'))].join(', ');
                return { 
                    type: 'multi_incident', 
                    message: `⚠️ ¡Aviso! Registrado en otro(s) incidente(s): "${otherIncidents}". (Misma arma en diferentes incidentes)` 
                };
            }
        }

        return null;
    };

    const getWeaponRowDuplicateInfo = (row) => {
        const sn = (row.num_serie || '').trim().toLowerCase();
        if (!sn || sn === 'n/a') return null;

        // Check in batch
        const inBatchCount = weaponRows.filter(r => (r.num_serie || '').trim().toLowerCase() === sn).length;
        if (inBatchCount > 1) {
            return { type: 'batch', message: '⚠️ Duplicado en este grupo' };
        }

        // Check in DB
        const dbMatch = weapons.find(w => (w.numero_serie || '').trim().toLowerCase() === sn);
        if (dbMatch) {
            return { type: 'db', message: `⚠️ Ya existe en sistema (${dbMatch.modelo} - ${dbMatch.propietario})` };
        }

        return null;
    };

    // Read URL search params
    useEffect(() => {
        const urlSearch = searchParams.get('search');
        const urlTab = searchParams.get('tab');
        if (urlSearch) setSearchTerm(urlSearch);
        if (urlTab && ['coincidences', 'bullets', 'weapons'].includes(urlTab)) {
            setActiveTab(urlTab);
        }
    }, [searchParams]);

    // Load initial data
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

            const activeWipe = await getActiveBallisticsWipeFolder();
            const folders = await getBallisticsWipeFoldersList();
            const stats = await getBallisticsWipeFoldersStats();

            if (isMounted) {
                setActiveWipeFolderState(activeWipe);
                setViewingWipeFolder(activeWipe);
                setWipeFolders(folders);
                setWipeStats(stats);
                loadData(activeWipe, uProfile);
            }

            try {
                const seen = JSON.parse(localStorage.getItem('seen_ballistics_matches') || '[]');
                if (isMounted) setSeenMatchIds(seen);
            } catch (e) {
                console.error("Error reading localStorage:", e);
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
        setLoading(true);
        setDbError(null);
        try {
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

            // Fetch Bullets, Weapons, and their Wipe folders in parallel
            const [bulletsRpcRes, weaponsRpcRes, bulletsWipeRes, weaponsWipeRes, matchesRes, casesRes] = await Promise.allSettled([
                supabase.rpc('get_ballistics_bullets'),
                supabase.rpc('get_ballistics_weapons'),
                supabase.from('ballistics_bullets').select('id, wipe_folder'),
                supabase.from('ballistics_weapons').select('id, wipe_folder'),
                supabase.rpc('get_ballistics_matches'),
                supabase.from('cases').select('id, title, case_number, status').order('case_number', { ascending: false })
            ]);

            if (bulletsRpcRes.status === 'fulfilled' && bulletsRpcRes.value.error) {
                const bErr = bulletsRpcRes.value.error;
                console.error("Error fetching bullets:", bErr);
                if (bErr.message?.includes("does not exist")) {
                    setDbError("El sistema de base de datos de Balística no está inicializado. Por favor ejecuta el archivo SQL 'BBDD/link_cases_ballistics.sql' o 'BBDD/create_ballistics_system.sql' en tu panel de Supabase.");
                    setLoading(false);
                    return;
                }
                throw bErr;
            }

            if (weaponsRpcRes.status === 'fulfilled' && weaponsRpcRes.value.error) {
                throw weaponsRpcRes.value.error;
            }

            const rawBullets = (bulletsRpcRes.status === 'fulfilled' && !bulletsRpcRes.value.error) ? (bulletsRpcRes.value.data || []) : [];
            const rawWeapons = (weaponsRpcRes.status === 'fulfilled' && !weaponsRpcRes.value.error) ? (weaponsRpcRes.value.data || []) : [];

            // Build wipe maps from direct table query
            const bulletsWipeMap = new Map();
            if (bulletsWipeRes.status === 'fulfilled' && bulletsWipeRes.value?.data) {
                bulletsWipeRes.value.data.forEach(r => {
                    bulletsWipeMap.set(r.id, (r.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER);
                });
            }

            const weaponsWipeMap = new Map();
            if (weaponsWipeRes.status === 'fulfilled' && weaponsWipeRes.value?.data) {
                weaponsWipeRes.value.data.forEach(r => {
                    weaponsWipeMap.set(r.id, (r.wipe_folder || '').trim() || DEFAULT_WIPE_FOLDER);
                });
            }

            // Enrich and filter bullets by wipe
            const filteredBullets = rawBullets
                .map(b => ({
                    ...b,
                    wipe_folder: (b.wipe_folder || bulletsWipeMap.get(b.id) || DEFAULT_WIPE_FOLDER).trim()
                }))
                .filter(b => {
                    const f = b.wipe_folder || DEFAULT_WIPE_FOLDER;
                    if (wipeToQuery === DEFAULT_WIPE_FOLDER) {
                        return !f || f === DEFAULT_WIPE_FOLDER;
                    }
                    return f.toLowerCase() === wipeToQuery.toLowerCase();
                });

            // Enrich and filter weapons by wipe
            const filteredWeapons = rawWeapons
                .map(w => ({
                    ...w,
                    wipe_folder: (w.wipe_folder || weaponsWipeMap.get(w.id) || DEFAULT_WIPE_FOLDER).trim()
                }))
                .filter(w => {
                    const f = w.wipe_folder || DEFAULT_WIPE_FOLDER;
                    if (wipeToQuery === DEFAULT_WIPE_FOLDER) {
                        return !f || f === DEFAULT_WIPE_FOLDER;
                    }
                    return f.toLowerCase() === wipeToQuery.toLowerCase();
                });

            if (matchesRes.status === 'fulfilled' && matchesRes.value?.data) {
                setBallisticsMatches(matchesRes.value.data);
            }
            if (casesRes.status === 'fulfilled' && casesRes.value?.data) {
                setCasesList(casesRes.value.data);
            }

            setBullets(filteredBullets);
            setWeapons(filteredWeapons);

            // Compute coincidences based on the filtered records of the current wipe folder
            recalculateCoincidences(filteredBullets, filteredWeapons);

            // Refresh wipe statistics
            const stats = await getBallisticsWipeFoldersStats();
            setWipeStats(stats);

        } catch (err) {
            console.error('Error loading ballistics data:', err);
            setDbError(err.message || 'Error al conectar con la base de datos.');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeViewingWipe = (newFolder) => {
        setViewingWipeFolder(newFolder);
        setSelectedBulletIds([]);
        setSelectedWeaponIds([]);
    };

    const handleMakeActiveWipe = async (folder) => {
        if (!folder) return;
        setWipeActionLoading(true);
        try {
            await setActiveBallisticsWipeFolder(folder);
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
            const updated = await createBallisticsWipeFolder(clean);
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
        if (!window.confirm(`¿Estás seguro de eliminar la carpeta "${folder}"? Todos los casquillos y armas volverán a la carpeta "Actual".`)) {
            return;
        }
        setWipeActionLoading(true);
        try {
            const updated = await deleteBallisticsWipeFolder(folder, DEFAULT_WIPE_FOLDER);
            setWipeFolders(updated);
            if (viewingWipeFolder === folder) {
                setViewingWipeFolder(DEFAULT_WIPE_FOLDER);
                await loadData(DEFAULT_WIPE_FOLDER);
            } else {
                const stats = await getBallisticsWipeFoldersStats();
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
                if (selectedBulletIds.length === 0 && selectedWeaponIds.length === 0) {
                    alert('No hay elementos seleccionados para mover.');
                    setWipeActionLoading(false);
                    return;
                }
                await moveBallisticsToWipeFolder({
                    bulletIds: selectedBulletIds,
                    weaponIds: selectedWeaponIds,
                    targetFolder: finalTarget
                });
            } else {
                await moveBallisticsToWipeFolder({
                    bulletIds: 'all',
                    weaponIds: 'all',
                    targetFolder: finalTarget,
                    sourceFolder: viewingWipeFolder
                });
            }

            const folders = await getBallisticsWipeFoldersList();
            setWipeFolders(folders);
            setSelectedBulletIds([]);
            setSelectedWeaponIds([]);
            setSelectionMode(false);
            setShowMoveModal(false);
            await loadData(viewingWipeFolder);
            alert(`Elementos de balística trasladados exitosamente a la carpeta "${finalTarget}".`);
        } catch (err) {
            alert('Error al mover balística: ' + err.message);
        } finally {
            setWipeActionLoading(false);
        }
    };

    const toggleBulletSelection = (id) => {
        setSelectedBulletIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleWeaponSelection = (id) => {
        setSelectedWeaponIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectAllCurrentTab = () => {
        if (activeTab === 'bullets') {
            setSelectedBulletIds(filteredBullets.map(b => b.id));
        } else if (activeTab === 'weapons') {
            setSelectedWeaponIds(filteredWeapons.map(w => w.id));
        }
    };

    const deselectAll = () => {
        setSelectedBulletIds([]);
        setSelectedWeaponIds([]);
    };

    const recalculateCoincidences = (bulletsList, weaponsList) => {
        const matches = [];
        bulletsList.forEach(bullet => {
            if (!bullet.numero_serie) return;
            const cleanBulletSn = bullet.numero_serie.trim().toLowerCase();
            if (cleanBulletSn === '' || cleanBulletSn === 'n/a') return;

            weaponsList.forEach(weapon => {
                if (!weapon.numero_serie) return;
                const cleanWeaponSn = weapon.numero_serie.trim().toLowerCase();
                if (cleanWeaponSn === '' || cleanWeaponSn === 'n/a') return;

                if (cleanWeaponSn === cleanBulletSn) {
                    const matchId = `${bullet.id}-${weapon.id}`;
                    matches.push({
                        id: matchId,
                        serialNumber: bullet.numero_serie,
                        bullet,
                        weapon,
                        created_at: bullet.created_at > weapon.created_at ? bullet.created_at : weapon.created_at
                    });
                }
            });
        });

        const sortedMatches = matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setCoincidences(sortedMatches);
    };

    // Open Modals
    const handleOpenAddBullets = () => {
        setBulletBatchIncident('');
        setBulletBatchDescription('');
        setBulletRows([{ id: Date.now(), num_serie: '', calibre: '', modelo_arma: '' }]);
        setBulletPasteText('');
        setShowBulletPasteBox(false);
        setBulletPasteSuccessMsg('');
        setShowBulletModal(true);
    };

    const handleOpenAddWeapons = () => {
        setWeaponBatchIncident('');
        setWeaponRows([{ id: Date.now(), propietario: '', modelo: '', num_serie: '' }]);
        setShowWeaponModal(true);
    };

    const handleOpenEditBullet = (bullet) => {
        setEditingBullet(bullet);
        setEditBulletForm({
            incidente: bullet.incidente_relacionado || '',
            num_serie: bullet.numero_serie || '',
            calibre: (bullet.calibre && bullet.calibre !== 'N/A') ? bullet.calibre : '',
            modelo_arma: (bullet.modelo_arma && bullet.modelo_arma !== 'N/A') ? bullet.modelo_arma : '',
            descripcion_incidente: bullet.descripcion_incidente || ''
        });
        setEditBulletPasteText('');
        setShowEditBulletPasteBox(false);
    };

    const handleOpenEditWeapon = (weapon) => {
        setEditingWeapon(weapon);
        setEditWeaponForm({
            propietario: weapon.propietario || '',
            incidente: weapon.incidente_relacionado || '',
            modelo: weapon.modelo || '',
            num_serie: weapon.numero_serie || ''
        });
    };

    // Merge helpers to append newly parsed reports to current list without replacing existing rows
    const mergeParsedBulletsIntoRows = (parsedList, currentRows, currentIncident, currentDescription) => {
        const isSingleEmpty = currentRows.length === 1 && (!currentRows[0].num_serie || !currentRows[0].num_serie.trim());
        const baseRows = isSingleEmpty ? [] : [...currentRows];

        let addedCount = 0;
        let skippedCount = 0;
        const newRows = [...baseRows];

        parsedList.forEach((p, idx) => {
            const cleanSn = (p.num_serie || '').trim().toLowerCase();
            if (!cleanSn || cleanSn === 'n/a') {
                newRows.push({
                    id: Date.now() + idx + Math.random(),
                    num_serie: p.num_serie || '',
                    calibre: p.calibre || '',
                    modelo_arma: p.modelo_arma || ''
                });
                addedCount++;
                return;
            }

            const exists = newRows.some(r => (r.num_serie || '').trim().toLowerCase() === cleanSn);
            if (exists) {
                skippedCount++;
            } else {
                newRows.push({
                    id: Date.now() + idx + Math.random(),
                    num_serie: p.num_serie || '',
                    calibre: p.calibre || '',
                    modelo_arma: p.modelo_arma || ''
                });
                addedCount++;
            }
        });

        const firstWithInc = parsedList.find(p => p.incidente);
        let updatedIncident = currentIncident;
        if (firstWithInc && !currentIncident.trim()) {
            updatedIncident = firstWithInc.incidente;
        }

        const firstWithDesc = parsedList.find(p => p.descripcion_incidente);
        let updatedDescription = currentDescription;
        if (firstWithDesc && !currentDescription?.trim()) {
            updatedDescription = firstWithDesc.descripcion_incidente;
        }

        return {
            newRows,
            addedCount,
            skippedCount,
            updatedIncident,
            updatedDescription
        };
    };

    // Dynamic Row Manipulation - Bullets
    const handleAddBulletRow = () => {
        setBulletRows(prev => [
            ...prev,
            { id: Date.now() + Math.random(), num_serie: '', calibre: '', modelo_arma: '' }
        ]);
    };

    const handleRemoveBulletRow = (rowId) => {
        setBulletRows(prev => {
            if (prev.length <= 1) {
                return [{ id: Date.now(), num_serie: '', calibre: '', modelo_arma: '' }];
            }
            return prev.filter(r => r.id !== rowId);
        });
    };

    const handleBulletRowChange = (rowId, field, value) => {
        setBulletRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    };

    // Process pasted text in Batch Bullet Modal (Appends non-duplicate bullets)
    const handleProcessBatchBulletPaste = (textToProcess) => {
        const text = textToProcess !== undefined ? textToProcess : bulletPasteText;
        if (!text || !text.trim()) return;

        const parsedList = parseMultipleBallisticReports(text);
        if (parsedList.length === 0) {
            alert('No se detectaron informes balísticos con formato válido. Asegúrate de incluir datos como "Arma:", "Serie:" y "Calibre:".');
            return;
        }

        const { newRows, addedCount, skippedCount, updatedIncident, updatedDescription } = mergeParsedBulletsIntoRows(parsedList, bulletRows, bulletBatchIncident, bulletBatchDescription);
        setBulletRows(newRows);
        setBulletBatchIncident(updatedIncident);
        if (updatedDescription !== undefined) {
            setBulletBatchDescription(updatedDescription);
        }
        setBulletPasteText('');
        setShowBulletPasteBox(false);

        if (addedCount > 0) {
            const msg = skippedCount > 0
                ? `¡${addedCount} casquillo(s) añadido(s) (${skippedCount} ya estaba en la lista)! Total: ${newRows.length}`
                : `¡${addedCount} casquillo(s) añadido(s) a la lista! Total: ${newRows.length}`;
            setBulletPasteSuccessMsg(msg);
        } else {
            setBulletPasteSuccessMsg(`El/los casquillo(s) pegados ya estaban presentes en la lista.`);
        }
        setTimeout(() => setBulletPasteSuccessMsg(''), 4000);
    };

    // Process pasted text in Single Edit Bullet Modal
    const handleProcessEditBulletPaste = (textToProcess) => {
        const text = textToProcess !== undefined ? textToProcess : editBulletPasteText;
        if (!text || !text.trim()) return;

        const parsed = parseSingleBallisticReport(text);
        if (!parsed || (!parsed.num_serie && !parsed.modelo_arma && !parsed.calibre)) {
            alert('No se detectó un formato balístico válido.');
            return;
        }

        setEditBulletForm(prev => ({
            incidente: parsed.incidente ? parsed.incidente : prev.incidente,
            num_serie: parsed.num_serie ? parsed.num_serie : prev.num_serie,
            calibre: parsed.calibre ? parsed.calibre : prev.calibre,
            modelo_arma: parsed.modelo_arma ? parsed.modelo_arma : prev.modelo_arma,
            descripcion_incidente: parsed.descripcion_incidente ? parsed.descripcion_incidente : prev.descripcion_incidente
        }));
        setEditBulletPasteText('');
        setShowEditBulletPasteBox(false);
    };

    // Dynamic Row Manipulation - Weapons
    const handleAddWeaponRow = () => {
        setWeaponRows(prev => [
            ...prev,
            { id: Date.now() + Math.random(), propietario: '', modelo: '', num_serie: '' }
        ]);
    };

    const handleRemoveWeaponRow = (rowId) => {
        setWeaponRows(prev => {
            if (prev.length <= 1) {
                return [{ id: Date.now(), propietario: '', modelo: '', num_serie: '' }];
            }
            return prev.filter(r => r.id !== rowId);
        });
    };

    const handleWeaponRowChange = (rowId, field, value) => {
        setWeaponRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    };

    // Submissions - Create Bullets (Batch / Single)
    const handleCreateBulletsBatch = async (e) => {
        e.preventDefault();
        if (!bulletBatchIncident.trim()) {
            alert('Por favor especifica el Incidente Relacionado.');
            return;
        }

        // Filter non-empty serial numbers
        const validBullets = bulletRows.filter(r => r.num_serie && r.num_serie.trim() !== '');
        if (validBullets.length === 0) {
            alert('Debes ingresar al menos un número de serie balístico válido.');
            return;
        }

        // 1. Check for duplicates WITHIN the batch being submitted
        const serialCounts = {};
        const duplicateBatchSerials = new Set();
        validBullets.forEach(b => {
            const cleanSn = b.num_serie.trim().toLowerCase();
            if (cleanSn && cleanSn !== 'n/a') {
                if (serialCounts[cleanSn]) {
                    duplicateBatchSerials.add(b.num_serie.trim());
                } else {
                    serialCounts[cleanSn] = true;
                }
            }
        });

        if (duplicateBatchSerials.size > 0) {
            alert(`⚠️ Error al guardar: Se han detectado números de serie repetidos dentro del grupo que intentas subir:\n\n• ${Array.from(duplicateBatchSerials).join('\n• ')}\n\nPor favor elimina o corrige las balas duplicadas antes de guardar.`);
            return;
        }

        // 2. Check for duplicates against existing bullets in DATABASE
        // Only block duplicates if they belong to the SAME incident!
        const currentIncidentClean = bulletBatchIncident.trim().toLowerCase();
        const sameIncidentDuplicates = [];
        const multiIncidentMatches = [];

        validBullets.forEach(b => {
            const cleanSn = b.num_serie.trim().toLowerCase();
            if (cleanSn && cleanSn !== 'n/a') {
                const dbMatches = bullets.filter(dbB => dbB.numero_serie && dbB.numero_serie.trim().toLowerCase() === cleanSn);
                dbMatches.forEach(existing => {
                    const existingIncidentClean = (existing.incidente_relacionado || '').trim().toLowerCase();
                    if (existingIncidentClean === currentIncidentClean) {
                        sameIncidentDuplicates.push({
                            serial: b.num_serie.trim(),
                            incident: existing.incidente_relacionado || 'Mismo incidente'
                        });
                    } else {
                        multiIncidentMatches.push({
                            serial: b.num_serie.trim(),
                            existingIncident: existing.incidente_relacionado || 'Incidente previo',
                            newIncident: bulletBatchIncident.trim(),
                            weaponModel: existing.modelo_arma || b.modelo_arma
                        });
                    }
                });
            }
        });

        if (sameIncidentDuplicates.length > 0) {
            const dupDetails = sameIncidentDuplicates.map(d => `• Serie: "${d.serial}" (Ya registrado en este incidente: "${d.incident}")`).join('\n');
            alert(`⚠️ Error al guardar: No se pueden registrar casquillos repetidos para el mismo incidente:\n\n${dupDetails}\n\nSolo se permite registrar el mismo número de serie si corresponde a un incidente diferente.`);
            return;
        }

        setSubmitting(true);
        try {
            // Attempt batch RPC first
            const batchPayload = validBullets.map(b => ({
                num_serie: b.num_serie.trim(),
                calibre: b.calibre?.trim() || 'N/A',
                modelo_arma: b.modelo_arma?.trim() || 'N/A'
            }));

            const { error: batchError } = await supabase.rpc('create_ballistics_bullets_batch', {
                p_incidente: bulletBatchIncident.trim(),
                p_bullets: batchPayload,
                p_descripcion_incidente: bulletBatchDescription.trim() || null
            });

            if (batchError) {
                // Fallback to individual calls
                for (const b of validBullets) {
                    const { error } = await supabase.rpc('create_ballistics_bullet', {
                        p_incidente: bulletBatchIncident.trim(),
                        p_calibre: b.calibre?.trim() || 'N/A',
                        p_num_serie: b.num_serie.trim(),
                        p_modelo_arma: b.modelo_arma?.trim() || 'N/A',
                        p_descripcion_incidente: bulletBatchDescription.trim() || null
                    });
                    if (error) throw error;
                }
            }

            // Check for match alerts with current weapons
            for (const b of validBullets) {
                const cleanSn = b.num_serie.trim().toLowerCase();
                if (cleanSn && cleanSn !== 'n/a') {
                    const matchedWeapon = weapons.find(w => w.numero_serie && w.numero_serie.trim().toLowerCase() === cleanSn);
                    if (matchedWeapon) {
                        const matchRecord = ballisticsMatches.find(m =>
                            m.weapon_id === matchedWeapon.id ||
                            (m.serial_number && m.serial_number.trim().toLowerCase() === cleanSn)
                        );
                        if (!matchRecord || matchRecord.status !== 'Rechazada') {
                            setAlertMatch({
                                serialNumber: b.num_serie,
                                bulletIncident: bulletBatchIncident,
                                weaponModel: matchedWeapon.modelo,
                                weaponOwner: matchedWeapon.propietario
                            });
                        }
                    }
                }
            }

            // Multi-incident match alert notice
            if (multiIncidentMatches.length > 0) {
                const summaryList = multiIncidentMatches.map(m => `• Serie: "${m.serial}" ➔ Disparado en "${m.existingIncident}" y en "${m.newIncident}"`).join('\n');
                alert(`🚨 ¡ALERTA BALÍSTICA: COINCIDENCIA ENTRE INCIDENTES!\n\nSe han registrado casquillos que demuestran que la MISMA ARMA ha disparado en diferentes incidentes:\n\n${summaryList}\n\nLos registros han quedado vinculados en el sistema.`);
            }

            const curWipe = viewingWipeFolder || activeWipeFolder || DEFAULT_WIPE_FOLDER;
            if (curWipe !== DEFAULT_WIPE_FOLDER) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.id) {
                    await supabase
                        .from('ballistics_bullets')
                        .update({ wipe_folder: curWipe })
                        .eq('author_id', user.id)
                        .eq('incidente_relacionado', bulletBatchIncident.trim())
                        .or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null`);
                }
            }

            setShowBulletModal(false);
            await loadData();
        } catch (err) {
            alert('Error al añadir casquillos: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Submissions - Create Weapons (Batch / Single)
    const handleCreateWeaponsBatch = async (e) => {
        e.preventDefault();
        if (!weaponBatchIncident.trim()) {
            alert('Por favor especifica el Incidente Relacionado.');
            return;
        }

        const validWeapons = weaponRows.filter(r => r.num_serie && r.num_serie.trim() !== '' && r.modelo && r.modelo.trim() !== '');
        if (validWeapons.length === 0) {
            alert('Debes ingresar al menos un arma con Modelo y Número de Serie.');
            return;
        }

        // 1. Check for duplicates WITHIN batch
        const serialCounts = {};
        const duplicateBatchSerials = new Set();
        validWeapons.forEach(w => {
            const cleanSn = w.num_serie.trim().toLowerCase();
            if (cleanSn && cleanSn !== 'n/a') {
                if (serialCounts[cleanSn]) {
                    duplicateBatchSerials.add(w.num_serie.trim());
                } else {
                    serialCounts[cleanSn] = true;
                }
            }
        });

        if (duplicateBatchSerials.size > 0) {
            alert(`⚠️ Error al guardar: Se han detectado armas con el mismo número de serie duplicado en el grupo:\n\n• ${Array.from(duplicateBatchSerials).join('\n• ')}\n\nPor favor elimina o modifica las armas repetidas.`);
            return;
        }

        // 2. Check for duplicates against existing weapons in DATABASE
        const dbDuplicates = [];
        validWeapons.forEach(w => {
            const cleanSn = w.num_serie.trim().toLowerCase();
            if (cleanSn && cleanSn !== 'n/a') {
                const existing = weapons.find(dbW => dbW.numero_serie && dbW.numero_serie.trim().toLowerCase() === cleanSn);
                if (existing) {
                    dbDuplicates.push({
                        serial: w.num_serie.trim(),
                        model: existing.modelo,
                        owner: existing.propietario
                    });
                }
            }
        });

        if (dbDuplicates.length > 0) {
            const dupDetails = dbDuplicates.map(d => `• Serie: "${d.serial}" (Ya registrada: ${d.model} - Propietario: ${d.owner})`).join('\n');
            alert(`⚠️ Error al guardar: Las siguientes armas ya están registradas en la base de datos:\n\n${dupDetails}\n\nPara no subir armas repetidas, corrígelas antes de guardar.`);
            return;
        }

        setSubmitting(true);
        try {
            const batchPayload = validWeapons.map(w => ({
                propietario: w.propietario?.trim() || 'Desconocido',
                modelo: w.modelo.trim(),
                num_serie: w.num_serie.trim()
            }));

            const { error: batchError } = await supabase.rpc('create_ballistics_weapons_batch', {
                p_incidente: weaponBatchIncident.trim(),
                p_weapons: batchPayload
            });

            if (batchError) {
                // Fallback to individual calls
                for (const w of validWeapons) {
                    const { error } = await supabase.rpc('create_ballistics_weapon', {
                        p_propietario: w.propietario?.trim() || 'Desconocido',
                        p_incidente: weaponBatchIncident.trim(),
                        p_modelo: w.modelo.trim(),
                        p_num_serie: w.num_serie.trim()
                    });
                    if (error) throw error;
                }
            }

            // Check for match alerts with current bullets
            for (const w of validWeapons) {
                const cleanSn = w.num_serie.trim().toLowerCase();
                if (cleanSn && cleanSn !== 'n/a') {
                    const matchedBullet = bullets.find(b => b.numero_serie && b.numero_serie.trim().toLowerCase() === cleanSn);
                    if (matchedBullet) {
                        const matchRecord = ballisticsMatches.find(m =>
                            (m.serial_number && m.serial_number.trim().toLowerCase() === cleanSn)
                        );
                        if (!matchRecord || matchRecord.status !== 'Rechazada') {
                            setAlertMatch({
                                serialNumber: w.num_serie,
                                bulletIncident: matchedBullet.incidente_relacionado,
                                weaponModel: w.modelo,
                                weaponOwner: w.propietario || 'Desconocido'
                            });
                        }
                    }
                }
            }

            const curWipe = viewingWipeFolder || activeWipeFolder || DEFAULT_WIPE_FOLDER;
            if (curWipe !== DEFAULT_WIPE_FOLDER) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.id) {
                    await supabase
                        .from('ballistics_weapons')
                        .update({ wipe_folder: curWipe })
                        .eq('author_id', user.id)
                        .eq('incidente_relacionado', weaponBatchIncident.trim())
                        .or(`wipe_folder.eq.${DEFAULT_WIPE_FOLDER},wipe_folder.is.null`);
                }
            }

            setShowWeaponModal(false);
            await loadData();
        } catch (err) {
            alert('Error al añadir armas: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Submissions - Update / Edit Bullet
    const handleUpdateBullet = async (e) => {
        e.preventDefault();
        if (!editingBullet) return;

        const cleanBulletSn = editBulletForm.num_serie.trim().toLowerCase();
        const editIncClean = editBulletForm.incidente.trim().toLowerCase();
        let multiIncMatchAlert = null;

        if (cleanBulletSn !== '' && cleanBulletSn !== 'n/a') {
            const matchingBullets = bullets.filter(b => b.id !== editingBullet.id && b.numero_serie && b.numero_serie.trim().toLowerCase() === cleanBulletSn);
            const sameIncMatch = matchingBullets.find(b => (b.incidente_relacionado || '').trim().toLowerCase() === editIncClean);
            if (sameIncMatch && editIncClean) {
                alert(`⚠️ Error: El número de serie "${editBulletForm.num_serie}" ya está registrado en este mismo incidente ("${sameIncMatch.incidente_relacionado || 'N/A'}").`);
                return;
            }

            const otherIncs = matchingBullets.filter(b => (b.incidente_relacionado || '').trim().toLowerCase() !== editIncClean);
            if (otherIncs.length > 0) {
                const list = [...new Set(otherIncs.map(b => b.incidente_relacionado))].join(', ');
                multiIncMatchAlert = `🚨 ¡Alerta Balística: Coincidencia entre Incidentes!\n\nEl número de serie "${editBulletForm.num_serie}" también pertenece a casquillo(s) del incidente(s):\n"${list}"\n\nIndica que la misma arma ha disparado en diferentes incidentes.`;
            }
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('update_ballistics_bullet', {
                p_id: editingBullet.id,
                p_incidente: editBulletForm.incidente,
                p_calibre: editBulletForm.calibre?.trim() || 'N/A',
                p_num_serie: editBulletForm.num_serie,
                p_modelo_arma: editBulletForm.modelo_arma?.trim() || 'N/A',
                p_descripcion_incidente: editBulletForm.descripcion_incidente?.trim() || null
            });
            if (error) throw error;

            if (cleanBulletSn !== '' && cleanBulletSn !== 'n/a') {
                const matchedWeapon = weapons.find(w => w.numero_serie && w.numero_serie.trim().toLowerCase() === cleanBulletSn);
                if (matchedWeapon) {
                    const matchRecord = ballisticsMatches.find(m =>
                        m.weapon_id === matchedWeapon.id ||
                        (m.serial_number && m.serial_number.trim().toLowerCase() === cleanBulletSn)
                    );
                    if (!matchRecord || matchRecord.status !== 'Rechazada') {
                        setAlertMatch({
                            serialNumber: editBulletForm.num_serie,
                            bulletIncident: editBulletForm.incidente,
                            weaponModel: matchedWeapon.modelo,
                            weaponOwner: matchedWeapon.propietario
                        });
                    }
                }
            }

            if (multiIncMatchAlert) {
                alert(multiIncMatchAlert);
            }

            setEditingBullet(null);
            await loadData();
        } catch (err) {
            alert('Error al actualizar casquillo: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Submissions - Update / Edit Weapon
    const handleUpdateWeapon = async (e) => {
        e.preventDefault();
        if (!editingWeapon) return;

        const cleanWeaponSn = editWeaponForm.num_serie.trim().toLowerCase();
        if (cleanWeaponSn !== '' && cleanWeaponSn !== 'n/a') {
            const existing = weapons.find(w => w.id !== editingWeapon.id && w.numero_serie && w.numero_serie.trim().toLowerCase() === cleanWeaponSn);
            if (existing) {
                alert(`⚠️ Error: El número de serie "${editWeaponForm.num_serie}" ya pertenece a otra arma registrada (Modelo: "${existing.modelo}", Propietario: "${existing.propietario}").`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('update_ballistics_weapon', {
                p_id: editingWeapon.id,
                p_propietario: editWeaponForm.propietario,
                p_incidente: editWeaponForm.incidente,
                p_modelo: editWeaponForm.modelo,
                p_num_serie: editWeaponForm.num_serie
            });
            if (error) throw error;

            if (cleanWeaponSn !== '' && cleanWeaponSn !== 'n/a') {
                const matchedBullet = bullets.find(b => b.numero_serie && b.numero_serie.trim().toLowerCase() === cleanWeaponSn);
                if (matchedBullet) {
                    const matchRecord = ballisticsMatches.find(m =>
                        (m.serial_number && m.serial_number.trim().toLowerCase() === cleanWeaponSn)
                    );
                    if (!matchRecord || matchRecord.status !== 'Rechazada') {
                        setAlertMatch({
                            serialNumber: editWeaponForm.num_serie,
                            bulletIncident: matchedBullet.incidente_relacionado,
                            weaponModel: editWeaponForm.modelo,
                            weaponOwner: editWeaponForm.propietario
                        });
                    }
                }
            }

            setEditingWeapon(null);
            await loadData();
        } catch (err) {
            alert('Error al actualizar arma: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Deletions
    const handleDeleteBullet = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de casquillo?')) return;
        try {
            const { error } = await supabase.rpc('delete_ballistics_bullet', { p_id: id });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al eliminar casquillo: ' + err.message);
        }
    };

    const handleDeleteWeapon = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de arma?')) return;
        try {
            const { error } = await supabase.rpc('delete_ballistics_weapon', { p_id: id });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al eliminar arma: ' + err.message);
        }
    };

    // Link Match (Coincidence) to Case
    const handleOpenLinkMatchModal = (group) => {
        setLinkMatchModal({ open: true, group });
        setSelectedCaseForLink(group.caseId || '');
    };

    const handleConfirmLinkMatch = async () => {
        if (!linkMatchModal.group || !selectedCaseForLink) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('set_ballistics_match_status', {
                p_weapon_id: linkMatchModal.group.weapon.id,
                p_status: 'Con caso',
                p_case_id: selectedCaseForLink
            });
            if (error) throw error;
            setLinkMatchModal({ open: false, group: null });
            await loadData();
        } catch (err) {
            alert('Error al vincular coincidencia a caso: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Reject Match
    const handleOpenRejectMatchModal = (group) => {
        setRejectMatchModal({ open: true, group });
        setRejectionReasonInput(group.motivoRechazo || '');
    };

    const handleConfirmRejectMatch = async () => {
        if (!rejectMatchModal.group) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('set_ballistics_match_status', {
                p_weapon_id: rejectMatchModal.group.weapon.id,
                p_status: 'Rechazada',
                p_case_id: null,
                p_motivo: rejectionReasonInput.trim() || 'Coincidencia descartada'
            });
            if (error) throw error;

            // Automatically mark all bullets for this rejected match as seen
            const weaponId = rejectMatchModal.group.weapon.id;
            const bulletsList = rejectMatchModal.group.bullets || [];
            const weaponMatchesIds = bulletsList.map(b => `${b.id}-${weaponId}`);
            const updated = [...new Set([...seenMatchIds, ...weaponMatchesIds])];
            setSeenMatchIds(updated);
            try {
                localStorage.setItem('seen_ballistics_matches', JSON.stringify(updated));
            } catch (e) {
                console.error("Error saving seen matches:", e);
            }

            setRejectMatchModal({ open: false, group: null });
            await loadData();
        } catch (err) {
            alert('Error al rechazar coincidencia: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Reopen Match
    const handleReopenMatch = async (group) => {
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('set_ballistics_match_status', {
                p_weapon_id: group.weapon.id,
                p_status: 'Abierta',
                p_case_id: null
            });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al reabrir coincidencia: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Unlink Match
    const handleUnlinkMatch = async (group) => {
        if (!confirm('¿Desvincular esta coincidencia del caso y dejarla abierta?')) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('set_ballistics_match_status', {
                p_weapon_id: group.weapon.id,
                p_status: 'Abierta',
                p_case_id: null
            });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al desvincular coincidencia: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Link / Unlink Single Bullet
    const handleOpenLinkBulletModal = (bullet) => {
        setLinkBulletModal({ open: true, bullet });
        setSelectedCaseForLink(bullet.case_id || '');
    };

    const handleConfirmLinkBullet = async () => {
        if (!linkBulletModal.bullet || !selectedCaseForLink) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('link_ballistics_bullet_to_case', {
                p_bullet_id: linkBulletModal.bullet.id,
                p_case_id: selectedCaseForLink
            });
            if (error) throw error;
            setLinkBulletModal({ open: false, bullet: null });
            await loadData();
        } catch (err) {
            alert('Error al vincular casquillo a caso: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnlinkBullet = async (bulletId) => {
        if (!confirm('¿Desvincular este casquillo del caso?')) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('unlink_ballistics_bullet_from_case', {
                p_bullet_id: bulletId
            });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al desvincular casquillo: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Link / Unlink Single Weapon
    const handleOpenLinkWeaponModal = (weapon) => {
        setLinkWeaponModal({ open: true, weapon });
        setSelectedCaseForLink(weapon.case_id || '');
    };

    const handleConfirmLinkWeapon = async () => {
        if (!linkWeaponModal.weapon || !selectedCaseForLink) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('link_ballistics_weapon_to_case', {
                p_weapon_id: linkWeaponModal.weapon.id,
                p_case_id: selectedCaseForLink
            });
            if (error) throw error;
            setLinkWeaponModal({ open: false, weapon: null });
            await loadData();
        } catch (err) {
            alert('Error al vincular arma a caso: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnlinkWeapon = async (weaponId) => {
        if (!confirm('¿Desvincular esta arma del caso?')) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('unlink_ballistics_weapon_from_case', {
                p_weapon_id: weaponId
            });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al desvincular arma: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Mark all matches as seen
    const handleMarkAllMatchesAsSeen = () => {
        const allIds = coincidences.map(c => c.id);
        setSeenMatchIds(allIds);
        localStorage.setItem('seen_ballistics_matches', JSON.stringify(allIds));
        setAlertMatch(null);
    };

    // Toggle weapon expand
    const toggleWeaponExpand = (weaponId) => {
        setExpandedWeapons(prev =>
            prev.includes(weaponId)
                ? prev.filter(id => id !== weaponId)
                : [...prev, weaponId]
        );
    };

    // Mark all matches for a specific weapon as seen
    const handleMarkWeaponMatchesAsSeen = (weapon, matchedBullets) => {
        const weaponMatchesIds = matchedBullets.map(bullet => `${bullet.id}-${weapon.id}`);
        const updated = [...new Set([...seenMatchIds, ...weaponMatchesIds])];
        setSeenMatchIds(updated);
        localStorage.setItem('seen_ballistics_matches', JSON.stringify(updated));
    };

    // Filtered lists for search
    const filteredBullets = useMemo(() => {
        if (!searchTerm.trim()) return bullets;
        const term = searchTerm.toLowerCase();
        return bullets.filter(b =>
            (b.numero_serie && b.numero_serie.toLowerCase().includes(term)) ||
            (b.incidente_relacionado && b.incidente_relacionado.toLowerCase().includes(term)) ||
            (b.descripcion_incidente && b.descripcion_incidente.toLowerCase().includes(term)) ||
            (b.calibre && b.calibre.toLowerCase().includes(term)) ||
            (b.modelo_arma && b.modelo_arma.toLowerCase().includes(term)) ||
            (b.case_title && b.case_title.toLowerCase().includes(term))
        );
    }, [bullets, searchTerm]);

    const filteredWeapons = useMemo(() => {
        if (!searchTerm.trim()) return weapons;
        const term = searchTerm.toLowerCase();
        return weapons.filter(w =>
            (w.numero_serie && w.numero_serie.toLowerCase().includes(term)) ||
            (w.propietario && w.propietario.toLowerCase().includes(term)) ||
            (w.modelo && w.modelo.toLowerCase().includes(term)) ||
            (w.incidente_relacionado && w.incidente_relacionado.toLowerCase().includes(term)) ||
            (w.case_title && w.case_title.toLowerCase().includes(term))
        );
    }, [weapons, searchTerm]);

    const allGroupedCoincidences = useMemo(() => {
        return weapons.map(weapon => {
            if (!weapon.numero_serie) return null;
            const cleanWeaponSn = weapon.numero_serie.trim().toLowerCase();
            if (cleanWeaponSn === '' || cleanWeaponSn === 'n/a') return null;

            const matchingBullets = bullets.filter(bullet =>
                bullet.numero_serie && bullet.numero_serie.trim().toLowerCase() === cleanWeaponSn
            );

            if (matchingBullets.length === 0) return null;

            // Find database match status if recorded
            const matchRecord = ballisticsMatches.find(m =>
                m.weapon_id === weapon.id ||
                (m.serial_number && m.serial_number.trim().toLowerCase() === cleanWeaponSn)
            );

            const status = matchRecord?.status || (weapon.case_id ? 'Con caso' : 'Abierta');
            const caseId = matchRecord?.case_id || weapon.case_id || null;
            const caseTitle = matchRecord?.case_title || weapon.case_title || null;
            const caseNumber = matchRecord?.case_number || weapon.case_number || null;
            const motivoRechazo = matchRecord?.motivo_rechazo || '';
            const updaterName = matchRecord?.updater_name || '';
            const updatedAt = matchRecord?.updated_at || null;

            // Search filter check for coincidences
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesSn = weapon.numero_serie.toLowerCase().includes(term);
                const matchesModel = weapon.modelo.toLowerCase().includes(term);
                const matchesOwner = weapon.propietario.toLowerCase().includes(term);
                const matchesCase = caseTitle && caseTitle.toLowerCase().includes(term);
                const matchesBullets = matchingBullets.some(b =>
                    (b.incidente_relacionado && b.incidente_relacionado.toLowerCase().includes(term)) ||
                    (b.descripcion_incidente && b.descripcion_incidente.toLowerCase().includes(term)) ||
                    (b.calibre && b.calibre.toLowerCase().includes(term))
                );
                if (!matchesSn && !matchesModel && !matchesOwner && !matchesCase && !matchesBullets) return null;
            }

            const isRejected = status === 'Rechazada';
            const newBullets = isRejected ? [] : matchingBullets.filter(bullet => {
                const matchId = `${bullet.id}-${weapon.id}`;
                return !seenMatchIds.includes(matchId);
            });

            return {
                weapon,
                bullets: matchingBullets,
                newBullets,
                isNew: !isRejected && newBullets.length > 0,
                status,
                caseId,
                caseTitle,
                caseNumber,
                motivoRechazo,
                updaterName,
                updatedAt,
                latestDate: matchingBullets.reduce((latest, bullet) => {
                    const bDate = new Date(bullet.created_at);
                    const wDate = new Date(weapon.created_at);
                    const max = bDate > wDate ? bDate : wDate;
                    return max > latest ? max : latest;
                }, new Date(weapon.created_at))
            };
        }).filter(Boolean).sort((a, b) => b.latestDate - a.latestDate);
    }, [weapons, bullets, ballisticsMatches, seenMatchIds, searchTerm]);

    const coincidenceCounts = useMemo(() => {
        return {
            all: allGroupedCoincidences.length,
            open: allGroupedCoincidences.filter(g => g.status === 'Abierta').length,
            linked: allGroupedCoincidences.filter(g => g.status === 'Con caso').length,
            rejected: allGroupedCoincidences.filter(g => g.status === 'Rechazada').length,
        };
    }, [allGroupedCoincidences]);

    const groupedCoincidences = useMemo(() => {
        if (coincidenceFilter === 'open') return allGroupedCoincidences.filter(g => g.status === 'Abierta');
        if (coincidenceFilter === 'linked') return allGroupedCoincidences.filter(g => g.status === 'Con caso');
        if (coincidenceFilter === 'rejected') return allGroupedCoincidences.filter(g => g.status === 'Rechazada');
        return allGroupedCoincidences;
    }, [allGroupedCoincidences, coincidenceFilter]);

    const unseenCoincidencesCount = useMemo(() => {
        return groupedCoincidences.filter(g => g.isNew).length;
    }, [groupedCoincidences]);

    return (
        <div
            id="ballistics-page"
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
            <style>{`
                @keyframes goldGlow {
                    0% {
                        box-shadow: 0 0 10px rgba(234, 179, 8, 0.35), inset 0 0 10px rgba(234, 179, 8, 0.08);
                        border-color: rgba(234, 179, 8, 0.5);
                    }
                    50% {
                        box-shadow: 0 0 22px rgba(234, 179, 8, 0.65), inset 0 0 14px rgba(234, 179, 8, 0.25);
                        border-color: rgba(234, 179, 8, 0.9);
                    }
                    100% {
                        box-shadow: 0 0 10px rgba(234, 179, 8, 0.35), inset 0 0 10px rgba(234, 179, 8, 0.08);
                        border-color: rgba(234, 179, 8, 0.5);
                    }
                }
                .new-coincidence-card {
                    animation: goldGlow 2.5s infinite ease-in-out;
                    border: 1px solid rgba(234, 179, 8, 0.6) !important;
                    background: rgba(234, 179, 8, 0.05) !important;
                }
                .glow-badge {
                    background: #eab308;
                    color: #0f172a;
                    font-weight: 800;
                    padding: 3px 9px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    box-shadow: 0 0 12px rgba(234, 179, 8, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .alert-banner-mac {
                    background: rgba(239, 68, 68, 0.15);
                    backdrop-filter: blur(14px);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    border-left: 4px solid #ef4444;
                    color: #fca5a5;
                    border-radius: 14px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                .batch-bullet-row {
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 0.75rem 0.9rem;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 34px;
                    gap: 0.6rem;
                    align-items: center;
                    transition: all 0.2s;
                }
                .batch-bullet-row:hover {
                    border-color: rgba(96, 165, 250, 0.35);
                    background: rgba(15, 23, 42, 0.75);
                }
            `}</style>

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
                                {t('ballistics') || 'Laboratorio de Balística'}
                            </h2>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                <span>Coincidencias: <strong style={{ color: '#fbbf24' }}>{groupedCoincidences.length}</strong></span>
                                {unseenCoincidencesCount > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>Nuevas: <strong style={{ color: '#facc15' }}>{unseenCoincidencesCount}</strong></span>
                                    </>
                                )}
                                <span>•</span>
                                <span>Casquillos: <strong style={{ color: '#60a5fa' }}>{bullets.length}</strong></span>
                                <span>•</span>
                                <span>Armas: <strong style={{ color: '#f87171' }}>{weapons.length}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Search, Tabs & Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Apple Search Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '20px',
                        padding: '0.38rem 0.9rem',
                        gap: '8px',
                        minWidth: '240px',
                        transition: 'border-color 0.2s',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar Nº Serie, modelo, incidente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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

                    {/* Apple Style Pill Tabs Header Navigation */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(12px)',
                        padding: '3px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('coincidences')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                background: activeTab === 'coincidences' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                                color: activeTab === 'coincidences' ? '#fde047' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeTab === 'coincidences' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent'
                            }}
                        >
                            {t('coincidences') || 'Coincidencias'} ({groupedCoincidences.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('bullets')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                background: activeTab === 'bullets' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: activeTab === 'bullets' ? '#93c5fd' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeTab === 'bullets' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent'
                            }}
                        >
                            {t('bulletCasings') || 'Casquillos'} ({filteredBullets.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('weapons')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                background: activeTab === 'weapons' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                color: activeTab === 'weapons' ? '#fca5a5' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeTab === 'weapons' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent'
                            }}
                        >
                            {t('seizedWeapons') || 'Armas Incautadas'} ({filteredWeapons.length})
                        </button>
                    </div>

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
                                    title="Carpeta de Wipe de balística"
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
                                    if (selectionMode) {
                                        setSelectedBulletIds([]);
                                        setSelectedWeaponIds([]);
                                    }
                                }}
                                title="Seleccionar elementos a dedo"
                            >
                                {selectionMode ? '✕ Cancelar' : '☑️ Seleccionar'}
                            </button>

                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.18)' }}
                                onClick={() => handleOpenMoveModal('all')}
                                title="Almacenar balística de esta carpeta en otra"
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

                    {/* Action Buttons */}
                    <button
                        type="button"
                        onClick={handleOpenAddBullets}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '0.4rem 1.05rem',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                            borderRadius: '20px',
                            color: '#93c5fd',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t('addBulletCasing') || 'Registrar Casquillos'}
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenAddWeapons}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '0.4rem 1.05rem',
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.35) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '20px',
                            color: '#fca5a5',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t('addSeizedWeapon') || 'Registrar Armas'}
                    </button>
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
                            ☑️ {selectedBulletIds.length + selectedWeaponIds.length} elemento(s) seleccionado(s)
                            {selectedBulletIds.length > 0 && ` (${selectedBulletIds.length} casquillo${selectedBulletIds.length > 1 ? 's' : ''})`}
                            {selectedWeaponIds.length > 0 && ` (${selectedWeaponIds.length} arma${selectedWeaponIds.length > 1 ? 's' : ''})`}
                        </span>
                        {['bullets', 'weapons'].includes(activeTab) && (
                            <button
                                type="button"
                                className="mac-btn mac-btn-secondary"
                                style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                                onClick={selectAllCurrentTab}
                            >
                                Seleccionar todos ({activeTab === 'bullets' ? 'casquillos' : 'armas'})
                            </button>
                        )}
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                            onClick={deselectAll}
                        >
                            Deseleccionar
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-primary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
                            disabled={selectedBulletIds.length === 0 && selectedWeaponIds.length === 0}
                            onClick={() => handleOpenMoveModal('selected')}
                        >
                            📦 Mover seleccionados a...
                        </button>
                    </div>
                </div>
            )}

            {/* Float Alert Match Notification Banner */}
            {alertMatch && (
                <div className="alert-banner-mac">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 700, color: '#fca5a5', fontSize: '1rem' }}>
                                {t('newCoincidenceDetected')?.replace('{item}', alertMatch.serialNumber) || `¡Coincidencia detectada! (Nº Serie: ${alertMatch.serialNumber})`}
                            </h4>
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                Coincidencia entre casquillo del <strong>{alertMatch.bulletIncident}</strong> y el arma <strong>{alertMatch.weaponModel}</strong> (Propietario: {alertMatch.weaponOwner}).
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '0.45rem 1.1rem',
                            borderRadius: '20px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                            whiteSpace: 'nowrap'
                        }}
                        onClick={handleMarkAllMatchesAsSeen}
                    >
                        Entendido
                    </button>
                </div>
            )}

            {/* Error or Loading Screen */}
            {dbError ? (
                <div style={{
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '2.5rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '16px',
                    textAlign: 'center',
                    backdropFilter: 'blur(12px)'
                }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.75rem auto' }}>
                        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h4 style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>Error en la Base de Datos</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{dbError}</p>
                </div>
            ) : loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        Cargando laboratorio de balística...
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem', paddingBottom: '1rem' }} className="custom-scrollbar">
                    {/* RENDERING COINCIDENCES TAB */}
                    {activeTab === 'coincidences' && (
                        <div>
                            {/* Coincidence Status Sub-filters */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setCoincidenceFilter('all')}
                                    style={{
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '20px',
                                        background: coincidenceFilter === 'all' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                                        border: coincidenceFilter === 'all' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        color: coincidenceFilter === 'all' ? '#ffffff' : '#94a3b8',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {t('filterAll') || 'Todas'} ({coincidenceCounts.all})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCoincidenceFilter('open')}
                                    style={{
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '20px',
                                        background: coincidenceFilter === 'open' ? 'rgba(234, 179, 8, 0.22)' : 'rgba(234, 179, 8, 0.06)',
                                        border: coincidenceFilter === 'open' ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid rgba(234, 179, 8, 0.2)',
                                        color: coincidenceFilter === 'open' ? '#fde047' : '#eab308',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🟡 {t('filterOpen') || 'Abiertas'} ({coincidenceCounts.open})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCoincidenceFilter('linked')}
                                    style={{
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '20px',
                                        background: coincidenceFilter === 'linked' ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.06)',
                                        border: coincidenceFilter === 'linked' ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(34, 197, 94, 0.2)',
                                        color: coincidenceFilter === 'linked' ? '#86efac' : '#4ade80',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🟢 {t('filterWithCase') || 'Con Caso'} ({coincidenceCounts.linked})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCoincidenceFilter('rejected')}
                                    style={{
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '20px',
                                        background: coincidenceFilter === 'rejected' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.06)',
                                        border: coincidenceFilter === 'rejected' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(239, 68, 68, 0.2)',
                                        color: coincidenceFilter === 'rejected' ? '#fca5a5' : '#f87171',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🔴 {t('filterRejected') || 'Rechazadas'} ({coincidenceCounts.rejected})
                                </button>
                            </div>

                            {groupedCoincidences.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '4rem 1rem',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                        No hay coincidencias que coincidan con el filtro seleccionado.
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {groupedCoincidences.map(group => {
                                        const isExpanded = expandedWeapons.includes(group.weapon.id);
                                        return (
                                            <div
                                                key={group.weapon.id}
                                                className={`ballistics-list-card ${group.isNew ? 'new-coincidence-card' : ''}`}
                                                style={{
                                                    background: group.isNew ? 'rgba(234, 179, 8, 0.05)' : 'rgba(15, 23, 42, 0.65)',
                                                    backdropFilter: 'blur(16px)',
                                                    border: group.status === 'Con caso' 
                                                        ? '1px solid rgba(34, 197, 94, 0.45)'
                                                        : group.status === 'Rechazada'
                                                        ? '1px solid rgba(239, 68, 68, 0.35)'
                                                        : group.isNew 
                                                        ? '1px solid rgba(234, 179, 8, 0.6)' 
                                                        : '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '16px',
                                                    padding: '1.2rem',
                                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    transition: 'all 0.25s ease'
                                                }}
                                            >
                                                <div>
                                                    {/* Card Header Top */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                            <span style={{
                                                                fontFamily: 'monospace',
                                                                fontWeight: 700,
                                                                color: '#fbbf24',
                                                                background: 'rgba(251, 191, 36, 0.12)',
                                                                border: '1px solid rgba(251, 191, 36, 0.25)',
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.78rem',
                                                                marginLeft: '6px'
                                                            }}>
                                                                N/S: {group.weapon.numero_serie}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {/* Status Badge */}
                                                            {group.status === 'Con caso' ? (
                                                                <span 
                                                                    onClick={() => group.caseId && navigate(`/cases?id=${group.caseId}`)}
                                                                    style={{
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 700,
                                                                        color: '#86efac',
                                                                        background: 'rgba(34, 197, 94, 0.15)',
                                                                        border: '1px solid rgba(34, 197, 94, 0.35)',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        cursor: group.caseId ? 'pointer' : 'default'
                                                                    }}
                                                                    title={group.caseTitle ? `Caso #${group.caseNumber}: ${group.caseTitle}` : 'Con Caso'}
                                                                >
                                                                    📁 {group.caseTitle ? `Caso #${group.caseNumber}` : 'Con Caso'}
                                                                </span>
                                                            ) : group.status === 'Rechazada' ? (
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 700,
                                                                    color: '#fca5a5',
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px'
                                                                }} title={group.motivoRechazo || 'Rechazada'}>
                                                                    🔴 {t('statusRejected') || 'Rechazada'}
                                                                </span>
                                                            ) : (
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 700,
                                                                    color: '#fde047',
                                                                    background: 'rgba(234, 179, 8, 0.15)',
                                                                    border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px'
                                                                }}>
                                                                    🟡 {t('statusOpen') || 'Abierta'}
                                                                </span>
                                                            )}

                                                            {group.weapon.can_delete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEditWeapon(group.weapon)}
                                                                    style={{
                                                                        background: 'rgba(59, 130, 246, 0.12)',
                                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                                        color: '#60a5fa',
                                                                        borderRadius: '8px',
                                                                        width: '26px',
                                                                        height: '26px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    title={t('editSeizedWeapon') || 'Editar arma'}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {group.isNew && (
                                                                <span className="glow-badge">
                                                                    ★ {t('newBadge') || 'NUEVA'} ({group.newBullets.length})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Weapon Info Box */}
                                                    <div style={{
                                                        background: 'rgba(0, 0, 0, 0.28)',
                                                        padding: '0.85rem',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                                        marginBottom: '0.85rem'
                                                    }}>
                                                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f87171', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            {group.weapon.modelo}
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                                                            <div><span style={{ color: '#94a3b8' }}>Propietario:</span> <strong>{group.weapon.propietario}</strong></div>
                                                            <div><span style={{ color: '#94a3b8' }}>Incidente Incautación:</span> <strong>{group.weapon.incidente_relacionado}</strong></div>
                                                            {group.caseTitle && (
                                                                <div style={{ marginTop: '3px' }}>
                                                                    <span style={{ color: '#86efac' }}>Expediente Penal:</span> <strong>Caso #{group.caseNumber} - {group.caseTitle}</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Rejection Notice if any */}
                                                    {group.status === 'Rechazada' && group.motivoRechazo && (
                                                        <div style={{
                                                            background: 'rgba(239, 68, 68, 0.08)',
                                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                                            borderRadius: '8px',
                                                            padding: '0.45rem 0.65rem',
                                                            marginBottom: '0.85rem',
                                                            fontSize: '0.74rem',
                                                            color: '#fca5a5'
                                                        }}>
                                                            <strong>Motivo de descarte:</strong> {group.motivoRechazo}
                                                        </div>
                                                    )}

                                                    {/* Expanded Bullet Relationships */}
                                                    {isExpanded && (
                                                        <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                                                            <div style={{ fontSize: '0.78rem', color: '#60a5fa', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                                Casquillos Vinculados ({group.bullets.length}):
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                {group.bullets.map(bullet => {
                                                                    const isBulletNew = group.status !== 'Rechazada' && !seenMatchIds.includes(`${bullet.id}-${group.weapon.id}`);
                                                                    return (
                                                                        <div
                                                                            key={bullet.id}
                                                                            style={{
                                                                                background: 'rgba(0, 0, 0, 0.25)',
                                                                                padding: '0.65rem 0.75rem',
                                                                                borderRadius: '8px',
                                                                                fontSize: '0.78rem',
                                                                                borderLeft: isBulletNew ? '3px solid #eab308' : '3px solid #60a5fa',
                                                                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                                                                position: 'relative'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                                <div><strong style={{ color: '#f8fafc' }}>Incidente:</strong> {bullet.incidente_relacionado}</div>
                                                                                {bullet.can_delete && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleOpenEditBullet(bullet)}
                                                                                        style={{
                                                                                            background: 'transparent',
                                                                                            border: 'none',
                                                                                            color: '#60a5fa',
                                                                                            cursor: 'pointer',
                                                                                            padding: '2px',
                                                                                            opacity: 0.8,
                                                                                            display: 'inline-flex'
                                                                                        }}
                                                                                        title={t('editBulletCasing') || 'Editar casquillo'}
                                                                                    >
                                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                                        </svg>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            {bullet.descripcion_incidente && bullet.descripcion_incidente.trim() !== '' && (
                                                                                <div style={{ color: '#93c5fd', marginTop: '3px', fontSize: '0.73rem', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                    📍 <strong>Recogida:</strong> {bullet.descripcion_incidente}
                                                                                </div>
                                                                            )}
                                                                            {((bullet.calibre && bullet.calibre !== 'N/A') || (bullet.modelo_arma && bullet.modelo_arma !== 'N/A')) && (
                                                                                <div style={{ color: '#cbd5e1', marginTop: '2px' }}>
                                                                                    {bullet.calibre && bullet.calibre !== 'N/A' && <><strong>Calibre:</strong> {bullet.calibre} </>}
                                                                                    {bullet.modelo_arma && bullet.modelo_arma !== 'N/A' && <>| <strong>Modelo:</strong> {bullet.modelo_arma}</>}
                                                                                </div>
                                                                            )}
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                                                                                <span>Por: {bullet.author_rank} {bullet.author_name}</span>
                                                                                <span>{new Date(bullet.created_at).toLocaleDateString()}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            type="button"
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.42rem',
                                                                borderRadius: '10px',
                                                                background: 'rgba(255, 255, 255, 0.06)',
                                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                color: '#cbd5e1',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onClick={() => toggleWeaponExpand(group.weapon.id)}
                                                        >
                                                            {isExpanded ? 'Ocultar Casquillos ▲' : `Ver Casquillos (${group.bullets.length}) ▼`}
                                                        </button>
                                                        {group.isNew && (
                                                            <button
                                                                type="button"
                                                                style={{
                                                                    padding: '0.42rem 0.75rem',
                                                                    borderRadius: '10px',
                                                                    background: 'rgba(234, 179, 8, 0.2)',
                                                                    border: '1px solid rgba(234, 179, 8, 0.4)',
                                                                    color: '#fde047',
                                                                    fontSize: '0.78rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onClick={() => handleMarkWeaponMatchesAsSeen(group.weapon, group.bullets)}
                                                            >
                                                                ✓ Visto
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Case Linking / Status Actions */}
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        {group.status === 'Abierta' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenLinkMatchModal(group)}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '0.42rem',
                                                                        borderRadius: '10px',
                                                                        background: 'rgba(34, 197, 94, 0.15)',
                                                                        border: '1px solid rgba(34, 197, 94, 0.35)',
                                                                        color: '#86efac',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: '5px'
                                                                    }}
                                                                >
                                                                    📁 {t('linkToCase') || 'Vincular a Caso'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenRejectMatchModal(group)}
                                                                    style={{
                                                                        padding: '0.42rem 0.75rem',
                                                                        borderRadius: '10px',
                                                                        background: 'rgba(239, 68, 68, 0.12)',
                                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                        color: '#fca5a5',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    title="Rechazar coincidencia"
                                                                >
                                                                    ✕ {t('rejectCoincidence') || 'Rechazar'}
                                                                </button>
                                                            </>
                                                        )}

                                                        {group.status === 'Con caso' && (
                                                            <>
                                                                {group.caseId && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => navigate(`/cases?id=${group.caseId}`)}
                                                                        style={{
                                                                            flex: 1,
                                                                            padding: '0.42rem',
                                                                            borderRadius: '10px',
                                                                            background: 'rgba(59, 130, 246, 0.15)',
                                                                            border: '1px solid rgba(59, 130, 246, 0.35)',
                                                                            color: '#93c5fd',
                                                                            fontSize: '0.78rem',
                                                                            fontWeight: 700,
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '5px'
                                                                        }}
                                                                    >
                                                                        📁 Ver Caso
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUnlinkMatch(group)}
                                                                    style={{
                                                                        padding: '0.42rem 0.75rem',
                                                                        borderRadius: '10px',
                                                                        background: 'rgba(239, 68, 68, 0.12)',
                                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                        color: '#fca5a5',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    title="Desvincular del caso"
                                                                >
                                                                    ✕ Desvincular
                                                                </button>
                                                            </>
                                                        )}

                                                        {group.status === 'Rechazada' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenMatch(group)}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '0.42rem',
                                                                    borderRadius: '10px',
                                                                    background: 'rgba(234, 179, 8, 0.15)',
                                                                    border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                    color: '#fde047',
                                                                    fontSize: '0.78rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '5px'
                                                                }}
                                                            >
                                                                ↻ {t('reopenCoincidence') || 'Reabrir Coincidencia'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RENDERING BULLETS TAB */}
                    {activeTab === 'bullets' && (
                        <div>
                            {filteredBullets.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '4rem 1rem',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                        No hay casquillos registrados.
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {filteredBullets.map(item => {
                                        const isSelected = selectedBulletIds.includes(item.id);
                                        return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (selectionMode) {
                                                    toggleBulletSelection(item.id);
                                                }
                                            }}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                backdropFilter: 'blur(16px)',
                                                border: item.case_id ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '16px',
                                                padding: '1.15rem',
                                                boxShadow: isSelected
                                                    ? '0 0 0 2px #10b981, 0 8px 24px rgba(16, 185, 129, 0.25)'
                                                    : '0 4px 20px rgba(0, 0, 0, 0.25)',
                                                cursor: selectionMode ? 'pointer' : 'default',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                position: 'relative'
                                            }}
                                        >
                                            <div>
                                                {/* Header window controls & edit / trash buttons */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {isAdmin && selectionMode && (
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(isSelected)}
                                                                onChange={() => toggleBulletSelection(item.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    width: '16px',
                                                                    height: '16px',
                                                                    accentColor: '#10b981',
                                                                    cursor: 'pointer',
                                                                    marginRight: '6px'
                                                                }}
                                                                title="Seleccionar casquillo"
                                                            />
                                                        )}
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
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
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {item.case_id ? (
                                                            <span
                                                                onClick={() => navigate(`/cases?id=${item.case_id}`)}
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 700,
                                                                    color: '#86efac',
                                                                    background: 'rgba(34, 197, 94, 0.15)',
                                                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '10px',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title={`Caso #${item.case_number}: ${item.case_title}`}
                                                            >
                                                                📁 Caso #{item.case_number}
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenLinkBulletModal(item)}
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    color: '#94a3b8',
                                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '10px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                + Vincular Caso
                                                            </button>
                                                        )}
                                                        {item.case_id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUnlinkBullet(item.id)}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                    color: '#f87171',
                                                                    borderRadius: '8px',
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Desvincular del caso"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                        {item.can_delete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditBullet(item)}
                                                                style={{
                                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                                                    color: '#60a5fa',
                                                                    borderRadius: '8px',
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title={t('editBulletCasing') || 'Editar casquillo'}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                        {item.can_delete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteBullet(item.id)}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                    color: '#f87171',
                                                                    borderRadius: '8px',
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title="Eliminar casquillo"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Bullet Metadata */}
                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.75rem', borderRadius: '8px', marginBottom: '0.65rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('relatedIncident') || 'Incidente'}</span>
                                                    <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{item.incidente_relacionado}</strong>
                                                    {item.descripcion_incidente && item.descripcion_incidente.trim() !== '' && (
                                                        <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                            <span style={{ color: '#93c5fd', fontSize: '0.7rem', display: 'block', marginBottom: '1px', fontWeight: 700 }}>
                                                                📍 {t('incidentDescription') || 'Descripción / Lugar de Recogida'}:
                                                            </span>
                                                            <span style={{ color: '#cbd5e1', fontSize: '0.78rem', whiteSpace: 'pre-wrap', lineHeight: '1.35', display: 'block' }}>
                                                                {item.descripcion_incidente}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {((item.calibre && item.calibre !== 'N/A') || (item.modelo_arma && item.modelo_arma !== 'N/A')) && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                                                        {item.calibre && item.calibre !== 'N/A' && (
                                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('bulletCaliber') || 'Calibre'}</span>
                                                                <strong style={{ color: '#60a5fa', fontSize: '0.85rem' }}>{item.calibre}</strong>
                                                            </div>
                                                        )}
                                                        {item.modelo_arma && item.modelo_arma !== 'N/A' && (
                                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('weaponModel') || 'Modelo del Arma'}</span>
                                                                <strong style={{ color: '#f87171', fontSize: '0.85rem' }}>{item.modelo_arma}</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('serialNumber') || 'Número de Serie'}</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.9rem', letterSpacing: '0.04em' }}>{item.numero_serie}</strong>
                                                </div>

                                                {/* Multi-incident Badge Notice */}
                                                {(() => {
                                                    if (!item.numero_serie || item.numero_serie === 'N/A') return null;
                                                    const cleanSn = item.numero_serie.trim().toLowerCase();
                                                    const otherBullets = bullets.filter(b => b.id !== item.id && b.numero_serie && b.numero_serie.trim().toLowerCase() === cleanSn && (b.incidente_relacionado || '').trim().toLowerCase() !== (item.incidente_relacionado || '').trim().toLowerCase());
                                                    if (otherBullets.length > 0) {
                                                        const otherIncidents = [...new Set(otherBullets.map(b => b.incidente_relacionado))];
                                                        return (
                                                            <div style={{
                                                                background: 'rgba(234, 179, 8, 0.12)',
                                                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                borderRadius: '8px',
                                                                padding: '0.45rem 0.65rem',
                                                                marginBottom: '0.75rem',
                                                                display: 'flex',
                                                                alignItems: 'flex-start',
                                                                gap: '6px'
                                                            }}>
                                                                <span style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>⚠️</span>
                                                                <div style={{ fontSize: '0.72rem', color: '#fde047', lineHeight: '1.3' }}>
                                                                    <strong>Misma arma disparada en:</strong> {otherIncidents.join(', ')}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.73rem',
                                                color: '#94a3b8',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                paddingTop: '0.55rem',
                                                marginTop: '0.2rem'
                                            }}>
                                                <span>Registrado por: <strong style={{ color: '#e2e8f0' }}>{item.author_rank} {item.author_name}</strong></span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ); })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RENDERING WEAPONS TAB */}
                    {activeTab === 'weapons' && (
                        <div>
                            {filteredWeapons.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '4rem 1rem',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                        No hay armas registradas.
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {filteredWeapons.map(item => {
                                        const isSelected = selectedWeaponIds.includes(item.id);
                                        return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (selectionMode) {
                                                    toggleWeaponSelection(item.id);
                                                }
                                            }}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                backdropFilter: 'blur(16px)',
                                                border: item.case_id ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '16px',
                                                padding: '1.15rem',
                                                boxShadow: isSelected
                                                    ? '0 0 0 2px #10b981, 0 8px 24px rgba(16, 185, 129, 0.25)'
                                                    : '0 4px 20px rgba(0, 0, 0, 0.25)',
                                                cursor: selectionMode ? 'pointer' : 'default',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                position: 'relative'
                                            }}
                                        >
                                            <div>
                                                {/* Header window controls & edit / trash buttons */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {isAdmin && selectionMode && (
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(isSelected)}
                                                                onChange={() => toggleWeaponSelection(item.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    width: '16px',
                                                                    height: '16px',
                                                                    accentColor: '#10b981',
                                                                    cursor: 'pointer',
                                                                    marginRight: '6px'
                                                                }}
                                                                title="Seleccionar arma"
                                                            />
                                                        )}
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
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
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {item.case_id ? (
                                                            <span
                                                                onClick={() => navigate(`/cases?id=${item.case_id}`)}
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 700,
                                                                    color: '#86efac',
                                                                    background: 'rgba(34, 197, 94, 0.15)',
                                                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '10px',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title={`Caso #${item.case_number}: ${item.case_title}`}
                                                            >
                                                                📁 Caso #{item.case_number}
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenLinkWeaponModal(item)}
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    color: '#94a3b8',
                                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '10px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                + Vincular Caso
                                                            </button>
                                                        )}
                                                        {item.case_id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUnlinkWeapon(item.id)}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                    color: '#f87171',
                                                                    borderRadius: '8px',
                                                                    width: '24px',
                                                                    height: '24px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Desvincular del caso"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                        {item.can_delete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditWeapon(item)}
                                                                style={{
                                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                                                    color: '#60a5fa',
                                                                    borderRadius: '8px',
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title={t('editSeizedWeapon') || 'Editar arma'}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                        {item.can_delete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteWeapon(item.id)}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                    color: '#f87171',
                                                                    borderRadius: '8px',
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                title="Eliminar arma"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Weapon Title / Model */}
                                                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#f87171' }}>
                                                    {item.modelo}
                                                </h3>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
                                                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('ownerName') || 'Propietario'}</span>
                                                        <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{item.propietario}</strong>
                                                    </div>
                                                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('relatedIncident') || 'Incidente'}</span>
                                                        <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{item.incidente_relacionado}</strong>
                                                    </div>
                                                </div>

                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('serialNumber') || 'Número de Serie'}</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.9rem', letterSpacing: '0.04em' }}>{item.numero_serie}</strong>
                                                </div>

                                                {item.case_title && (
                                                    <div style={{
                                                        background: 'rgba(34, 197, 94, 0.1)',
                                                        border: '1px solid rgba(34, 197, 94, 0.25)',
                                                        borderRadius: '8px',
                                                        padding: '0.45rem 0.65rem',
                                                        marginBottom: '0.75rem',
                                                        fontSize: '0.75rem',
                                                        color: '#86efac'
                                                    }}>
                                                        📁 <strong>Caso #{item.case_number}:</strong> {item.case_title}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.73rem',
                                                color: '#94a3b8',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                paddingTop: '0.55rem',
                                                marginTop: '0.2rem'
                                            }}>
                                                <span>Registrado por: <strong style={{ color: '#e2e8f0' }}>{item.author_rank} {item.author_name}</strong></span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ); })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* --- ADD BULLET CASINGS MODAL (MULTI-BULLET & SCRIPT FORMAT IMPORT) --- */}
            {showBulletModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '720px',
                        width: '94vw',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        {/* Header */}
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowBulletModal(false)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {t('addBulletCasingsBatch') || 'Registrar Casquillos'}
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowBulletPasteBox(prev => !prev)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: showBulletPasteBox ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                                    border: showBulletPasteBox ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid rgba(59, 130, 246, 0.35)',
                                    color: showBulletPasteBox ? '#fde047' : '#93c5fd',
                                    padding: '0.35rem 0.8rem',
                                    borderRadius: '12px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                📋 {showBulletPasteBox ? 'Ocultar Portapapeles' : 'Pegar Formato Script'}
                            </button>
                        </div>

                        {/* Script Format Quick Paste Box */}
                        {showBulletPasteBox && (
                            <div style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                borderRadius: '14px',
                                padding: '1rem',
                                marginBottom: '1.25rem',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fde047' }}>
                                        {t('pasteScriptReport') || '📋 Pegar Informe(s) del Script (Formato Rápido)'}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        Puedes pegar uno o varios informes a la vez
                                    </span>
                                </div>
                                <textarea
                                    rows={4}
                                    value={bulletPasteText}
                                    onChange={(e) => setBulletPasteText(e.target.value)}
                                    placeholder={`[INFORME BALÍSTICO]\nArma: Endurance\nSerie: 466080ECB348251\nCalibre: Balas 9mm\nFecha: 2026-09-01 22:53`}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#f8fafc',
                                        fontFamily: 'monospace',
                                        fontSize: '0.82rem',
                                        padding: '0.6rem 0.8rem',
                                        boxSizing: 'border-box',
                                        resize: 'vertical'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.6rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleProcessBatchBulletPaste()}
                                        style={{
                                            background: '#eab308',
                                            color: '#0f172a',
                                            border: 'none',
                                            padding: '0.4rem 1rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.78rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('processPastedReport') || '⚡ Auto-rellenar desde Texto'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {bulletPasteSuccessMsg && (
                            <div style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.4)',
                                color: '#86efac',
                                padding: '0.5rem 0.85rem',
                                borderRadius: '10px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>✓</span> {bulletPasteSuccessMsg}
                            </div>
                        )}

                        <form onSubmit={handleCreateBulletsBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* General Incident */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('relatedIncident') || 'Incidente Relacionado'} (común para todas las balas) *
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={bulletBatchIncident}
                                    onChange={e => setBulletBatchIncident(e.target.value)}
                                    placeholder="Ej: Tiroteo en Grove St / Asalto en Banco Central"
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

                            {/* Optional Incident / Collection Description */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, margin: 0 }}>
                                        {t('incidentDescription') || 'Descripción del Incidente / Recogida'}
                                    </label>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        color: '#38bdf8',
                                        background: 'rgba(56, 189, 248, 0.12)',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        padding: '1px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 800,
                                        letterSpacing: '0.05em'
                                    }}>
                                        {t('optionalField') || 'OPCIONAL'}
                                    </span>
                                </div>
                                <textarea
                                    rows={2}
                                    className="form-input"
                                    value={bulletBatchDescription}
                                    onChange={e => setBulletBatchDescription(e.target.value)}
                                    placeholder="OPCIONAL: Descripción del lugar exacto donde se recogió la bala, contexto del incidente, etc."
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.85rem',
                                        padding: '0.6rem 0.9rem',
                                        resize: 'vertical',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Bullets List Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Casquillos a subir ({bulletRows.length}):
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddBulletRow}
                                    style={{
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        color: '#93c5fd',
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: '8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    + Añadir otra bala
                                </button>
                            </div>

                            {/* Bullets List Table / Cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                                {bulletRows.map((row, index) => {
                                    const dupInfo = getBulletRowDuplicateInfo(row);
                                    return (
                                        <div key={row.id} className="batch-bullet-row" style={dupInfo ? { border: `1px solid ${dupInfo.type === 'db' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(234, 179, 8, 0.6)'}`, borderRadius: '12px', padding: '0.6rem' } : {}}>
                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: '#fbbf24', display: 'block', marginBottom: '2px', fontWeight: 700 }}>
                                                    Nº Serie *
                                                </span>
                                                <input
                                                    className="form-input"
                                                    required
                                                    value={row.num_serie}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        // Auto intercept if someone pastes a full script report into the serial input
                                                        if (val.includes('[INFORME') || val.includes('Arma:') || val.includes('Serie:') || val.includes('Modelo:')) {
                                                            const parsedList = parseMultipleBallisticReports(val);
                                                            if (parsedList && parsedList.length > 0) {
                                                                const base = bulletRows.filter(r => r.id !== row.id || (r.num_serie && r.num_serie.trim() !== ''));
                                                                const res = mergeParsedBulletsIntoRows(parsedList, base, bulletBatchIncident);
                                                                setBulletRows(res.newRows);
                                                                setBulletBatchIncident(res.updatedIncident);
                                                                if (res.addedCount > 0) {
                                                                    const msg = res.skippedCount > 0
                                                                        ? `¡${res.addedCount} casquillo(s) añadido(s) (${res.skippedCount} ya estaba en la lista)! Total: ${res.newRows.length}`
                                                                        : `¡${res.addedCount} casquillo(s) añadido(s) a la lista! Total: ${res.newRows.length}`;
                                                                    setBulletPasteSuccessMsg(msg);
                                                                } else {
                                                                    setBulletPasteSuccessMsg(`El/los casquillo(s) pegados ya estaban en la lista.`);
                                                                }
                                                                setTimeout(() => setBulletPasteSuccessMsg(''), 4000);
                                                                return;
                                                            }
                                                        }
                                                        handleBulletRowChange(row.id, 'num_serie', val);
                                                    }}
                                                    placeholder="466080ECB348251"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                        border: dupInfo ? `1px solid ${dupInfo.type === 'db' ? '#ef4444' : '#eab308'}` : '1px solid rgba(234, 179, 8, 0.35)',
                                                        borderRadius: '8px',
                                                        color: '#fbbf24',
                                                        fontFamily: 'monospace',
                                                        fontWeight: 700,
                                                        fontSize: '0.82rem',
                                                        padding: '0.45rem 0.65rem'
                                                    }}
                                                />
                                                {dupInfo && (
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: dupInfo.type === 'db' ? '#f87171' : '#fde047',
                                                        display: 'block',
                                                        marginTop: '4px',
                                                        lineHeight: '1.2'
                                                    }}>
                                                        {dupInfo.message}
                                                    </span>
                                                )}
                                            </div>

                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: '#60a5fa', display: 'block', marginBottom: '2px', fontWeight: 700 }}>
                                                    Calibre
                                                </span>
                                                <input
                                                    className="form-input"
                                                    value={row.calibre}
                                                    onChange={e => handleBulletRowChange(row.id, 'calibre', e.target.value)}
                                                    placeholder="Balas 9mm"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        borderRadius: '8px',
                                                        color: '#93c5fd',
                                                        fontSize: '0.82rem',
                                                        padding: '0.45rem 0.65rem'
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'block', marginBottom: '2px', fontWeight: 700 }}>
                                                    Arma / Modelo
                                                </span>
                                                <input
                                                    className="form-input"
                                                    value={row.modelo_arma}
                                                    onChange={e => handleBulletRowChange(row.id, 'modelo_arma', e.target.value)}
                                                    placeholder="Endurance"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        borderRadius: '8px',
                                                        color: '#fca5a5',
                                                        fontSize: '0.82rem',
                                                        padding: '0.45rem 0.65rem'
                                                    }}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveBulletRow(row.id)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171',
                                                    borderRadius: '8px',
                                                    width: '28px',
                                                    height: '28px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    marginTop: '16px',
                                                    padding: 0
                                                }}
                                                title="Eliminar fila"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Form Footer Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowBulletModal(false)} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : `Guardar ${bulletRows.filter(r => r.num_serie).length || bulletRows.length} Casquillo(s)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EDIT BULLET CASING MODAL --- */}
            {editingBullet && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '560px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setEditingBullet(null)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#93c5fd', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    {t('editBulletCasing') || 'Editar Casquillo'}
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowEditBulletPasteBox(prev => !prev)}
                                style={{
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    border: '1px solid rgba(234, 179, 8, 0.4)',
                                    color: '#fde047',
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                📋 {showEditBulletPasteBox ? 'Ocultar Portapapeles' : 'Pegar Formato Script'}
                            </button>
                        </div>

                        {showEditBulletPasteBox && (
                            <div style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                borderRadius: '14px',
                                padding: '0.85rem',
                                marginBottom: '1.25rem'
                            }}>
                                <textarea
                                    rows={3}
                                    value={editBulletPasteText}
                                    onChange={(e) => setEditBulletPasteText(e.target.value)}
                                    placeholder={`[INFORME BALÍSTICO]\nArma: Endurance\nSerie: 466080ECB348251\nCalibre: Balas 9mm\nFecha: 2026-09-01 22:53`}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#f8fafc',
                                        fontFamily: 'monospace',
                                        fontSize: '0.82rem',
                                        padding: '0.6rem 0.8rem',
                                        boxSizing: 'border-box',
                                        resize: 'vertical'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleProcessEditBulletPaste()}
                                        style={{
                                            background: '#eab308',
                                            color: '#0f172a',
                                            border: 'none',
                                            padding: '0.35rem 0.85rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.76rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ⚡ Rellenar Campos
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleUpdateBullet} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('relatedIncident') || 'Incidente Relacionado'} *
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={editBulletForm.incidente}
                                    onChange={e => setEditBulletForm({ ...editBulletForm, incidente: e.target.value })}
                                    placeholder="Ej: Tiroteo en Grove St"
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

                            {/* Optional Incident / Collection Description */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, margin: 0 }}>
                                        {t('incidentDescription') || 'Descripción del Incidente / Recogida'}
                                    </label>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        color: '#38bdf8',
                                        background: 'rgba(56, 189, 248, 0.12)',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        padding: '1px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 800,
                                        letterSpacing: '0.05em'
                                    }}>
                                        {t('optionalField') || 'OPCIONAL'}
                                    </span>
                                </div>
                                <textarea
                                    rows={2}
                                    className="form-input"
                                    value={editBulletForm.descripcion_incidente}
                                    onChange={e => setEditBulletForm({ ...editBulletForm, descripcion_incidente: e.target.value })}
                                    placeholder="OPCIONAL: Descripción del lugar exacto donde se recogió la bala, contexto, etc."
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.85rem',
                                        padding: '0.6rem 0.9rem',
                                        resize: 'vertical',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#60a5fa', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('bulletCaliber') || 'Calibre'}
                                    </label>
                                    <input
                                        className="form-input"
                                        value={editBulletForm.calibre}
                                        onChange={e => setEditBulletForm({ ...editBulletForm, calibre: e.target.value })}
                                        placeholder="Ej: Balas 9mm, 5.56mm"
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
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('weaponModel') || 'Modelo del Arma'}
                                    </label>
                                    <input
                                        className="form-input"
                                        value={editBulletForm.modelo_arma}
                                        onChange={e => setEditBulletForm({ ...editBulletForm, modelo_arma: e.target.value })}
                                        placeholder="Ej: Endurance, Combat Pistol"
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
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('serialNumber') || 'Número de Serie Balístico'} *
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={editBulletForm.num_serie}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val.includes('[INFORME') || val.includes('Arma:') || val.includes('Serie:')) {
                                            handleProcessEditBulletPaste(val);
                                            return;
                                        }
                                        setEditBulletForm({ ...editBulletForm, num_serie: val });
                                    }}
                                    placeholder="Ej: 466080ECB348251"
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(234, 179, 8, 0.4)',
                                        borderRadius: '10px',
                                        color: '#fde047',
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                                {(() => {
                                    const cleanSn = editBulletForm.num_serie.trim().toLowerCase();
                                    const editIncClean = editBulletForm.incidente.trim().toLowerCase();
                                    if (cleanSn && cleanSn !== 'n/a') {
                                        const matchingBullets = bullets.filter(b => (!editingBullet || b.id !== editingBullet.id) && b.numero_serie && b.numero_serie.trim().toLowerCase() === cleanSn);
                                        if (matchingBullets.length > 0) {
                                            const sameInc = matchingBullets.find(b => (b.incidente_relacionado || '').trim().toLowerCase() === editIncClean);
                                            if (sameInc && editIncClean) {
                                                return (
                                                    <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                                                        ❌ Este número de serie ya está registrado en este mismo incidente ("{sameInc.incidente_relacionado || 'N/A'}")
                                                    </span>
                                                );
                                            } else {
                                                const otherIncs = [...new Set(matchingBullets.map(b => b.incidente_relacionado || 'N/A'))].join(', ');
                                                return (
                                                    <span style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                                                        ⚠️ ¡Misma arma! Registrada previamente en otro(s) incidente(s): "{otherIncs}". Se guardará como coincidencia multi-incidente.
                                                    </span>
                                                );
                                            }
                                        }
                                    }
                                    return null;
                                })()}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setEditingBullet(null)} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : (t('saveChanges') || 'Guardar Cambios')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- ADD SEIZED WEAPONS MODAL (BATCH / MULTI-WEAPON) --- */}
            {showWeaponModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '720px',
                        width: '94vw',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowWeaponModal(false)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {t('addSeizedWeapon') || 'Registrar Armas Incautadas'}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleCreateWeaponsBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Incident for weapons batch */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('relatedIncident') || 'Incidente Relacionado'} *
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={weaponBatchIncident}
                                    onChange={e => setWeaponBatchIncident(e.target.value)}
                                    placeholder="Ej: Asalto en Licorería / Redada en Rancho"
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

                            {/* Weapons list header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Armas a registrar ({weaponRows.length}):
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddWeaponRow}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                        color: '#fca5a5',
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: '8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    + Añadir otra arma
                                </button>
                            </div>

                            {/* Weapons List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                                {weaponRows.map(row => {
                                    const dupInfo = getWeaponRowDuplicateInfo(row);
                                    return (
                                        <div key={row.id} className="batch-bullet-row" style={dupInfo ? { border: `1px solid ${dupInfo.type === 'db' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(234, 179, 8, 0.6)'}`, borderRadius: '12px', padding: '0.6rem' } : {}}>
                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'block', marginBottom: '2px', fontWeight: 700 }}>
                                                    Modelo de Arma *
                                                </span>
                                                <input
                                                    className="form-input"
                                                    required
                                                    value={row.modelo}
                                                    onChange={e => handleWeaponRowChange(row.id, 'modelo', e.target.value)}
                                                    placeholder="Ej: Combat Pistol"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        borderRadius: '8px',
                                                        color: '#fca5a5',
                                                        fontSize: '0.82rem',
                                                        padding: '0.45rem 0.65rem'
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: '#fbbf24', display: 'block', marginBottom: '2px', fontWeight: 700 }}>
                                                    Nº Serie *
                                                </span>
                                                <input
                                                    className="form-input"
                                                    required
                                                    value={row.num_serie}
                                                    onChange={e => handleWeaponRowChange(row.id, 'num_serie', e.target.value)}
                                                    placeholder="466080ECB348251"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                        border: dupInfo ? `1px solid ${dupInfo.type === 'db' ? '#ef4444' : '#eab308'}` : '1px solid rgba(234, 179, 8, 0.35)',
                                                        borderRadius: '8px',
                                                        color: '#fbbf24',
                                                        fontFamily: 'monospace',
                                                        fontWeight: 700,
                                                        fontSize: '0.82rem',
                                                        padding: '0.45rem 0.65rem'
                                                    }}
                                                />
                                                {dupInfo && (
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: dupInfo.type === 'db' ? '#f87171' : '#fde047',
                                                        display: 'block',
                                                        marginTop: '4px',
                                                        lineHeight: '1.2'
                                                    }}>
                                                        {dupInfo.message}
                                                    </span>
                                                )}
                                            </div>

                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: '#cbd5e1', display: 'block', marginBottom: '2px', fontWeight: 700 }}>
                                                    Propietario
                                                </span>
                                                <input
                                                    className="form-input"
                                                    value={row.propietario}
                                                    onChange={e => handleWeaponRowChange(row.id, 'propietario', e.target.value)}
                                                    placeholder="Ej: John Doe"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.35)',
                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        borderRadius: '8px',
                                                        color: '#ffffff',
                                                        fontSize: '0.82rem',
                                                        padding: '0.45rem 0.65rem'
                                                    }}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveWeaponRow(row.id)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171',
                                                    borderRadius: '8px',
                                                    width: '28px',
                                                    height: '28px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    marginTop: '16px',
                                                    padding: 0
                                                }}
                                                title="Eliminar fila"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowWeaponModal(false)} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : `Guardar ${weaponRows.filter(r => r.num_serie).length || weaponRows.length} Arma(s)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EDIT SEIZED WEAPON MODAL --- */}
            {editingWeapon && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '560px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setEditingWeapon(null)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#fca5a5', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    {t('editSeizedWeapon') || 'Editar Arma Incautada'}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateWeapon} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('ownerName') || 'Propietario'} *
                                    </label>
                                    <input
                                        className="form-input"
                                        required
                                        value={editWeaponForm.propietario}
                                        onChange={e => setEditWeaponForm({ ...editWeaponForm, propietario: e.target.value })}
                                        placeholder="Ej: Desconocido, John Doe"
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
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('weaponModel') || 'Modelo del Arma'} *
                                    </label>
                                    <input
                                        className="form-input"
                                        required
                                        value={editWeaponForm.modelo}
                                        onChange={e => setEditWeaponForm({ ...editWeaponForm, modelo: e.target.value })}
                                        placeholder="Ej: Combat Pistol, Special Carbine"
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
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('relatedIncident') || 'Incidente Relacionado'} *
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={editWeaponForm.incidente}
                                    onChange={e => setEditWeaponForm({ ...editWeaponForm, incidente: e.target.value })}
                                    placeholder="Ej: Asalto en Licorería"
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

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('serialNumber') || 'Número de Serie Balístico'} *
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={editWeaponForm.num_serie}
                                    onChange={e => setEditWeaponForm({ ...editWeaponForm, num_serie: e.target.value })}
                                    placeholder="Ej: 466080ECB348251"
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(234, 179, 8, 0.4)',
                                        borderRadius: '10px',
                                        color: '#fde047',
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                                {(() => {
                                    const cleanSn = editWeaponForm.num_serie.trim().toLowerCase();
                                    if (cleanSn && cleanSn !== 'n/a') {
                                        const existing = weapons.find(w => w.id !== editingWeapon.id && w.numero_serie && w.numero_serie.trim().toLowerCase() === cleanSn);
                                        if (existing) {
                                            return (
                                                <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                                                    ⚠️ Este número de serie ya pertenece a otra arma ({existing.modelo} - {existing.propietario})
                                                </span>
                                            );
                                        }
                                    }
                                    return null;
                                })()}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setEditingWeapon(null)} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : (t('saveChanges') || 'Guardar Cambios')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: VINCULAR COINCIDENCIA A CASO --- */}
            {linkMatchModal.open && linkMatchModal.group && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '480px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setLinkMatchModal({ open: false, group: null })} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#86efac', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📁 {t('linkToCase') || 'Vincular Coincidencia a Caso'}
                                </h3>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>
                                Arma: {linkMatchModal.group.weapon.modelo} (N/S: {linkMatchModal.group.weapon.numero_serie})
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                {linkMatchModal.group.bullets.length} casquillo(s) vinculados en esta coincidencia.
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                Selecciona el Expediente Penal *
                            </label>
                            <select
                                className="form-input"
                                value={selectedCaseForLink}
                                onChange={(e) => setSelectedCaseForLink(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(34, 197, 94, 0.4)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    fontSize: '0.88rem',
                                    padding: '0.65rem 0.9rem'
                                }}
                            >
                                <option value="">{t('selectCasePlaceholder') || '-- Seleccionar Caso --'}</option>
                                {casesList.map(c => (
                                    <option key={c.id} value={c.id}>
                                        Caso #{c.case_number}: {c.title} ({c.status || 'Abierto'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                            <button
                                type="button"
                                className="login-button btn-secondary"
                                onClick={() => setLinkMatchModal({ open: false, group: null })}
                                style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}
                            >
                                {t('cancelBtn') || 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                className="login-button"
                                onClick={handleConfirmLinkMatch}
                                disabled={!selectedCaseForLink || submitting}
                                style={{
                                    width: 'auto',
                                    padding: '0.5rem 1.6rem',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                                }}
                            >
                                {submitting ? 'Vinculando...' : 'Vincular Coincidencia'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: RECHAZAR COINCIDENCIA --- */}
            {rejectMatchModal.open && rejectMatchModal.group && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '480px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setRejectMatchModal({ open: false, group: null })} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#fca5a5', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🔴 {t('rejectCoincidence') || 'Rechazar Coincidencia Balística'}
                                </h3>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '1rem', lineHeight: 1.5 }}>
                            Al rechazar esta coincidencia quedará registrada como <strong>Descartada / Rechazada</strong> en el laboratorio de balística. Puedes indicar el motivo a continuación.
                        </p>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                {t('rejectionReason') || 'Motivo del Rechazo'}
                            </label>
                            <textarea
                                rows={3}
                                className="form-input"
                                value={rejectionReasonInput}
                                onChange={(e) => setRejectionReasonInput(e.target.value)}
                                placeholder={t('rejectionReasonPlaceholder') || 'ej. Falso positivo, estrías inconsistentes, arma transferida antes del hecho...'}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    fontSize: '0.85rem',
                                    padding: '0.65rem 0.9rem',
                                    boxSizing: 'border-box',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                            <button
                                type="button"
                                className="login-button btn-secondary"
                                onClick={() => setRejectMatchModal({ open: false, group: null })}
                                style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}
                            >
                                {t('cancelBtn') || 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                className="login-button"
                                onClick={handleConfirmRejectMatch}
                                disabled={submitting}
                                style={{
                                    width: 'auto',
                                    padding: '0.5rem 1.6rem',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                                }}
                            >
                                {submitting ? 'Rechazando...' : 'Confirmar Rechazo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: VINCULAR CASQUILLO A CASO --- */}
            {linkBulletModal.open && linkBulletModal.bullet && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '460px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setLinkBulletModal({ open: false, bullet: null })} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#93c5fd', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    📁 Vincular Casquillo a Caso
                                </h3>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>
                                Incidente: {linkBulletModal.bullet.incidente_relacionado}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontFamily: 'monospace' }}>
                                N/S: {linkBulletModal.bullet.numero_serie}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                Selecciona el Expediente Penal *
                            </label>
                            <select
                                className="form-input"
                                value={selectedCaseForLink}
                                onChange={(e) => setSelectedCaseForLink(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    fontSize: '0.88rem',
                                    padding: '0.65rem 0.9rem'
                                }}
                            >
                                <option value="">{t('selectCasePlaceholder') || '-- Seleccionar Caso --'}</option>
                                {casesList.map(c => (
                                    <option key={c.id} value={c.id}>
                                        Caso #{c.case_number}: {c.title} ({c.status || 'Abierto'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                            <button
                                type="button"
                                className="login-button btn-secondary"
                                onClick={() => setLinkBulletModal({ open: false, bullet: null })}
                                style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}
                            >
                                {t('cancelBtn') || 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                className="login-button"
                                onClick={handleConfirmLinkBullet}
                                disabled={!selectedCaseForLink || submitting}
                                style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }}
                            >
                                {submitting ? 'Vinculando...' : 'Vincular Casquillo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: VINCULAR ARMA A CASO --- */}
            {linkWeaponModal.open && linkWeaponModal.weapon && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '460px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setLinkWeaponModal({ open: false, weapon: null })} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#fca5a5', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    📁 Vincular Arma a Caso
                                </h3>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>
                                {linkWeaponModal.weapon.modelo} (Propietario: {linkWeaponModal.weapon.propietario})
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontFamily: 'monospace' }}>
                                N/S: {linkWeaponModal.weapon.numero_serie}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                Selecciona el Expediente Penal *
                            </label>
                            <select
                                className="form-input"
                                value={selectedCaseForLink}
                                onChange={(e) => setSelectedCaseForLink(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    fontSize: '0.88rem',
                                    padding: '0.65rem 0.9rem'
                                }}
                            >
                                <option value="">{t('selectCasePlaceholder') || '-- Seleccionar Caso --'}</option>
                                {casesList.map(c => (
                                    <option key={c.id} value={c.id}>
                                        Caso #{c.case_number}: {c.title} ({c.status || 'Abierto'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                            <button
                                type="button"
                                className="login-button btn-secondary"
                                onClick={() => setLinkWeaponModal({ open: false, weapon: null })}
                                style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}
                            >
                                {t('cancelBtn') || 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                className="login-button"
                                onClick={handleConfirmLinkWeapon}
                                disabled={!selectedCaseForLink || submitting}
                                style={{
                                    width: 'auto',
                                    padding: '0.5rem 1.6rem',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                }}
                            >
                                {submitting ? 'Vinculando...' : 'Vincular Arma'}
                            </button>
                        </div>
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
                                ⚙️ Gestión de Wipes - Balística
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
                                💡 <strong>Sistema de Wipes de Balística:</strong> Solo los administradores pueden gestionar y alternar entre carpetas. Los agentes regulares siempre verán únicamente la carpeta marcada como <strong>⭐ Activa</strong>.
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
                                    const stats = wipeStats[folder] || { total: 0, bullets: 0, weapons: 0 };

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
                                                <span><strong>Total:</strong> {stats.total} registros</span>
                                                <span style={{ color: '#93c5fd' }}>🔹 Casquillos: {stats.bullets}</span>
                                                <span style={{ color: '#fca5a5' }}>🔸 Armas: {stats.weapons}</span>
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

            {/* Modal: Move Ballistics into Wipe Folder (ADMIN ONLY) */}
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
                                📦 Almacenar Balística en Wipe
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body">
                            {/* Scope Selector */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">¿Qué registros de balística deseas trasladar?</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {(selectedBulletIds.length > 0 || selectedWeaponIds.length > 0) && (
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
                                                Mover los <strong>{selectedBulletIds.length + selectedWeaponIds.length}</strong> elementos seleccionados a dedo ({selectedBulletIds.length} casquillos, {selectedWeaponIds.length} armas)
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
                                            Mover <strong>TODOS</strong> los registros de la carpeta "{viewingWipeFolder}" (Total: {wipeStats[viewingWipeFolder]?.total || (bullets.length + weapons.length)})
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

export default Ballistics;

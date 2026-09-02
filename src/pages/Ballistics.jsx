import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { parseMultipleBallisticReports, parseSingleBallisticReport } from '../utils/ballisticsParser';
import '../index.css';

function Ballistics() {
    const { t } = useLanguage();
    const { isLSSD } = useTheme();

    // Data states
    const [bullets, setBullets] = useState([]);
    const [weapons, setWeapons] = useState([]);
    const [coincidences, setCoincidences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dbError, setDbError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals visibility & edit targets
    const [showWeaponModal, setShowWeaponModal] = useState(false);
    const [showBulletModal, setShowBulletModal] = useState(false);
    const [editingBullet, setEditingBullet] = useState(null);
    const [editingWeapon, setEditingWeapon] = useState(null);

    // Batch Bullet Form State
    const [bulletBatchIncident, setBulletBatchIncident] = useState('');
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
    const [weaponPasteText, setWeaponPasteText] = useState('');
    const [showWeaponPasteBox, setShowWeaponPasteBox] = useState(false);
    const [weaponPasteSuccessMsg, setWeaponPasteSuccessMsg] = useState('');

    // Single Edit Forms
    const [editBulletForm, setEditBulletForm] = useState({
        incidente: '',
        num_serie: '',
        calibre: '',
        modelo_arma: ''
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

    // Load initial data
    useEffect(() => {
        loadData();
        try {
            const seen = JSON.parse(localStorage.getItem('seen_ballistics_matches') || '[]');
            setSeenMatchIds(seen);
        } catch (e) {
            console.error("Error reading localStorage:", e);
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        setDbError(null);
        try {
            // Fetch Bullets
            const { data: bulletsData, error: bulletsError } = await supabase.rpc('get_ballistics_bullets');
            if (bulletsError) {
                console.error("Error fetching bullets:", bulletsError);
                if (bulletsError.message.includes("does not exist")) {
                    setDbError("El sistema de base de datos de Balística no está inicializado. Por favor ejecuta el archivo SQL 'BBDD/create_ballistics_system.sql' en tu panel de Supabase.");
                    setLoading(false);
                    return;
                }
                throw bulletsError;
            }

            // Fetch Weapons
            const { data: weaponsData, error: weaponsError } = await supabase.rpc('get_ballistics_weapons');
            if (weaponsError) throw weaponsError;

            const fetchedBullets = bulletsData || [];
            const fetchedWeapons = weaponsData || [];

            setBullets(fetchedBullets);
            setWeapons(fetchedWeapons);

            // Compute coincidences
            recalculateCoincidences(fetchedBullets, fetchedWeapons);

        } catch (err) {
            console.error('Error loading ballistics data:', err);
            setDbError(err.message || 'Error al conectar con la base de datos.');
        } finally {
            setLoading(false);
        }
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
        setBulletRows([{ id: Date.now(), num_serie: '', calibre: '', modelo_arma: '' }]);
        setBulletPasteText('');
        setShowBulletPasteBox(false);
        setBulletPasteSuccessMsg('');
        setShowBulletModal(true);
    };

    const handleOpenAddWeapons = () => {
        setWeaponBatchIncident('');
        setWeaponRows([{ id: Date.now(), propietario: '', modelo: '', num_serie: '' }]);
        setWeaponPasteText('');
        setShowWeaponPasteBox(false);
        setWeaponPasteSuccessMsg('');
        setShowWeaponModal(true);
    };

    const handleOpenEditBullet = (bullet) => {
        setEditingBullet(bullet);
        setEditBulletForm({
            incidente: bullet.incidente_relacionado || '',
            num_serie: bullet.numero_serie || '',
            calibre: (bullet.calibre && bullet.calibre !== 'N/A') ? bullet.calibre : '',
            modelo_arma: (bullet.modelo_arma && bullet.modelo_arma !== 'N/A') ? bullet.modelo_arma : ''
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
    const mergeParsedBulletsIntoRows = (parsedList, currentRows, currentIncident) => {
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

        return {
            newRows,
            addedCount,
            skippedCount,
            updatedIncident
        };
    };

    const mergeParsedWeaponsIntoRows = (parsedList, currentRows, currentIncident) => {
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
                    propietario: p.propietario || '',
                    modelo: p.modelo_arma || '',
                    num_serie: p.num_serie || ''
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
                    propietario: p.propietario || '',
                    modelo: p.modelo_arma || '',
                    num_serie: p.num_serie || ''
                });
                addedCount++;
            }
        });

        const firstWithInc = parsedList.find(p => p.incidente);
        let updatedIncident = currentIncident;
        if (firstWithInc && !currentIncident.trim()) {
            updatedIncident = firstWithInc.incidente;
        }

        return {
            newRows,
            addedCount,
            skippedCount,
            updatedIncident
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

        const { newRows, addedCount, skippedCount, updatedIncident } = mergeParsedBulletsIntoRows(parsedList, bulletRows, bulletBatchIncident);
        setBulletRows(newRows);
        setBulletBatchIncident(updatedIncident);
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
            modelo_arma: parsed.modelo_arma ? parsed.modelo_arma : prev.modelo_arma
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

    // Process pasted text in Batch Weapon Modal (Appends non-duplicate weapons)
    const handleProcessBatchWeaponPaste = (textToProcess) => {
        const text = textToProcess !== undefined ? textToProcess : weaponPasteText;
        if (!text || !text.trim()) return;

        const parsedList = parseMultipleBallisticReports(text);
        if (parsedList.length === 0) {
            alert('No se detectaron informes con formato válido. Asegúrate de incluir datos como "Arma:" o "Modelo:", "Serie:" y opcionalmente "Propietario:".');
            return;
        }

        const { newRows, addedCount, skippedCount, updatedIncident } = mergeParsedWeaponsIntoRows(parsedList, weaponRows, weaponBatchIncident);
        setWeaponRows(newRows);
        setWeaponBatchIncident(updatedIncident);
        setWeaponPasteText('');
        setShowWeaponPasteBox(false);

        if (addedCount > 0) {
            const msg = skippedCount > 0
                ? `¡${addedCount} arma(s) añadida(s) (${skippedCount} ya estaba en la lista)! Total: ${newRows.length}`
                : `¡${addedCount} arma(s) añadida(s) a la lista! Total: ${newRows.length}`;
            setWeaponPasteSuccessMsg(msg);
        } else {
            setWeaponPasteSuccessMsg(`El/las arma(s) pegadas ya estaban presentes en la lista.`);
        }
        setTimeout(() => setWeaponPasteSuccessMsg(''), 4000);
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
                p_bullets: batchPayload
            });

            if (batchError) {
                // Fallback to individual calls
                for (const b of validBullets) {
                    const { error } = await supabase.rpc('create_ballistics_bullet', {
                        p_incidente: bulletBatchIncident.trim(),
                        p_calibre: b.calibre?.trim() || 'N/A',
                        p_num_serie: b.num_serie.trim(),
                        p_modelo_arma: b.modelo_arma?.trim() || 'N/A'
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
                        setAlertMatch({
                            serialNumber: b.num_serie,
                            bulletIncident: bulletBatchIncident,
                            weaponModel: matchedWeapon.modelo,
                            weaponOwner: matchedWeapon.propietario
                        });
                    }
                }
            }

            // Multi-incident match alert notice
            if (multiIncidentMatches.length > 0) {
                const summaryList = multiIncidentMatches.map(m => `• Serie: "${m.serial}" ➔ Disparado en "${m.existingIncident}" y en "${m.newIncident}"`).join('\n');
                alert(`🚨 ¡ALERTA BALÍSTICA: COINCIDENCIA ENTRE INCIDENTES!\n\nSe han registrado casquillos que demuestran que la MISMA ARMA ha disparado en diferentes incidentes:\n\n${summaryList}\n\nLos registros han quedado vinculados en el sistema.`);
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
                        setAlertMatch({
                            serialNumber: w.num_serie,
                            bulletIncident: matchedBullet.incidente_relacionado,
                            weaponModel: w.modelo,
                            weaponOwner: w.propietario || 'Desconocido'
                        });
                    }
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
                p_modelo_arma: editBulletForm.modelo_arma?.trim() || 'N/A'
            });
            if (error) throw error;

            if (cleanBulletSn !== '' && cleanBulletSn !== 'n/a') {
                const matchedWeapon = weapons.find(w => w.numero_serie && w.numero_serie.trim().toLowerCase() === cleanBulletSn);
                if (matchedWeapon) {
                    setAlertMatch({
                        serialNumber: editBulletForm.num_serie,
                        bulletIncident: editBulletForm.incidente,
                        weaponModel: matchedWeapon.modelo,
                        weaponOwner: matchedWeapon.propietario
                    });
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
                    setAlertMatch({
                        serialNumber: editWeaponForm.num_serie,
                        bulletIncident: matchedBullet.incidente_relacionado,
                        weaponModel: editWeaponForm.modelo,
                        weaponOwner: editWeaponForm.propietario
                    });
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
            (b.calibre && b.calibre.toLowerCase().includes(term)) ||
            (b.modelo_arma && b.modelo_arma.toLowerCase().includes(term))
        );
    }, [bullets, searchTerm]);

    const filteredWeapons = useMemo(() => {
        if (!searchTerm.trim()) return weapons;
        const term = searchTerm.toLowerCase();
        return weapons.filter(w =>
            (w.numero_serie && w.numero_serie.toLowerCase().includes(term)) ||
            (w.propietario && w.propietario.toLowerCase().includes(term)) ||
            (w.modelo && w.modelo.toLowerCase().includes(term)) ||
            (w.incidente_relacionado && w.incidente_relacionado.toLowerCase().includes(term))
        );
    }, [weapons, searchTerm]);

    const groupedCoincidences = useMemo(() => {
        return weapons.map(weapon => {
            if (!weapon.numero_serie) return null;
            const cleanWeaponSn = weapon.numero_serie.trim().toLowerCase();
            if (cleanWeaponSn === '' || cleanWeaponSn === 'n/a') return null;

            const matchingBullets = bullets.filter(bullet =>
                bullet.numero_serie && bullet.numero_serie.trim().toLowerCase() === cleanWeaponSn
            );

            if (matchingBullets.length === 0) return null;

            // Search filter check for coincidences
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesSn = weapon.numero_serie.toLowerCase().includes(term);
                const matchesModel = weapon.modelo.toLowerCase().includes(term);
                const matchesOwner = weapon.propietario.toLowerCase().includes(term);
                const matchesBullets = matchingBullets.some(b =>
                    (b.incidente_relacionado && b.incidente_relacionado.toLowerCase().includes(term)) ||
                    (b.calibre && b.calibre.toLowerCase().includes(term))
                );
                if (!matchesSn && !matchesModel && !matchesOwner && !matchesBullets) return null;
            }

            const newBullets = matchingBullets.filter(bullet => {
                const matchId = `${bullet.id}-${weapon.id}`;
                return !seenMatchIds.includes(matchId);
            });

            return {
                weapon,
                bullets: matchingBullets,
                newBullets,
                isNew: newBullets.length > 0,
                latestDate: matchingBullets.reduce((latest, bullet) => {
                    const bDate = new Date(bullet.created_at);
                    const wDate = new Date(weapon.created_at);
                    const max = bDate > wDate ? bDate : wDate;
                    return max > latest ? max : latest;
                }, new Date(weapon.created_at))
            };
        }).filter(Boolean).sort((a, b) => b.latestDate - a.latestDate);
    }, [weapons, bullets, seenMatchIds, searchTerm]);

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
                                        No se han detectado coincidencias de número de serie todavía.
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
                                                    border: group.isNew ? '1px solid rgba(234, 179, 8, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
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
                                                            {group.isNew ? (
                                                                <span className="glow-badge">
                                                                    ★ {t('newBadge') || 'NUEVA'} ({group.newBullets.length})
                                                                </span>
                                                            ) : (
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 600,
                                                                    color: '#4ade80',
                                                                    background: 'rgba(34, 197, 94, 0.12)',
                                                                    border: '1px solid rgba(34, 197, 94, 0.25)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px'
                                                                }}>
                                                                    ✓ {group.bullets.length} Vinculados
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
                                                        </div>
                                                    </div>

                                                    {/* Expanded Bullet Relationships */}
                                                    {isExpanded && (
                                                        <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                                                            <div style={{ fontSize: '0.78rem', color: '#60a5fa', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                                Casquillos Vinculados ({group.bullets.length}):
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                {group.bullets.map(bullet => {
                                                                    const isBulletNew = !seenMatchIds.includes(`${bullet.id}-${group.weapon.id}`);
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
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
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
                                                                flex: 1,
                                                                padding: '0.42rem',
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
                                                            Marcar vistos ✓
                                                        </button>
                                                    )}
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
                                    {filteredBullets.map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                backdropFilter: 'blur(16px)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '16px',
                                                padding: '1.15rem',
                                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
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
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                justify: 'space-between',
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
                                    ))}
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
                                    {filteredWeapons.map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                backdropFilter: 'blur(16px)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '16px',
                                                padding: '1.15rem',
                                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
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
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                        <strong style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{item.incidente_relacionado}</strong>
                                                    </div>
                                                </div>

                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('serialNumber') || 'Número de Serie'}</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.9rem', letterSpacing: '0.04em' }}>{item.numero_serie}</strong>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justify: 'space-between',
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
                                    ))}
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

            {/* --- ADD SEIZED WEAPONS MODAL (BATCH / MULTI-WEAPON & SCRIPT IMPORT) --- */}
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
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                            <button
                                type="button"
                                onClick={() => setShowWeaponPasteBox(prev => !prev)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: showWeaponPasteBox ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                    border: showWeaponPasteBox ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid rgba(239, 68, 68, 0.35)',
                                    color: showWeaponPasteBox ? '#fde047' : '#fca5a5',
                                    padding: '0.35rem 0.8rem',
                                    borderRadius: '12px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                📋 {showWeaponPasteBox ? 'Ocultar Portapapeles' : 'Pegar Formato Script'}
                            </button>
                        </div>

                        {/* Script Format Quick Paste Box for Weapons */}
                        {showWeaponPasteBox && (
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
                                        📋 Pegar Informe(s) de Armas (Formato Rápido)
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        Puedes pegar uno o varios informes a la vez
                                    </span>
                                </div>
                                <textarea
                                    rows={4}
                                    value={weaponPasteText}
                                    onChange={(e) => setWeaponPasteText(e.target.value)}
                                    placeholder={`[INFORME BALÍSTICO]\nArma: Combat Pistol\nSerie: 466080ECB348251\nPropietario: John Doe\nFecha: 2026-09-01 22:53`}
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
                                        onClick={() => handleProcessBatchWeaponPaste()}
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
                                        ⚡ Auto-rellenar Armas
                                    </button>
                                </div>
                            </div>
                        )}

                        {weaponPasteSuccessMsg && (
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
                                <span>✓</span> {weaponPasteSuccessMsg}
                            </div>
                        )}

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
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val.includes('[INFORME') || val.includes('Arma:') || val.includes('Serie:') || val.includes('Modelo:')) {
                                                            const parsedList = parseMultipleBallisticReports(val);
                                                            if (parsedList && parsedList.length > 0) {
                                                                const base = weaponRows.filter(r => r.id !== row.id || (r.num_serie && r.num_serie.trim() !== ''));
                                                                const res = mergeParsedWeaponsIntoRows(parsedList, base, weaponBatchIncident);
                                                                setWeaponRows(res.newRows);
                                                                setWeaponBatchIncident(res.updatedIncident);
                                                                if (res.addedCount > 0) {
                                                                    const msg = res.skippedCount > 0
                                                                        ? `¡${res.addedCount} arma(s) añadida(s) (${res.skippedCount} ya estaba en la lista)! Total: ${res.newRows.length}`
                                                                        : `¡${res.addedCount} arma(s) añadida(s) a la lista! Total: ${res.newRows.length}`;
                                                                    setWeaponPasteSuccessMsg(msg);
                                                                } else {
                                                                    setWeaponPasteSuccessMsg(`El/las arma(s) pegadas ya estaban en la lista.`);
                                                                }
                                                                setTimeout(() => setWeaponPasteSuccessMsg(''), 4000);
                                                                return;
                                                            }
                                                        }
                                                        handleWeaponRowChange(row.id, 'num_serie', val);
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
        </div>
    );
}

export default Ballistics;

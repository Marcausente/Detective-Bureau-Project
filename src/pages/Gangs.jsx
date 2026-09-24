import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, filterBucketImages, getProfileImage, stripBase64FromHtml } from '../utils/imageStorage';
import IncidentCard from '../components/IncidentCard';
import OutingCard from '../components/OutingCard';
import GangTodoList from '../components/GangTodoList';
import CaseWhiteboard from '../components/cases/CaseWhiteboard';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { generateGangSummaryPDF } from '../utils/gangPdfGenerator';
import { calculateGangWeeklyActivity } from '../utils/gangActivityStats';
import '../index.css';

const safeStrMatch = (str, query) => {
    if (!str || !query) return false;
    return String(str).toLowerCase().includes(String(query).trim().toLowerCase());
};

function Gangs() {
    const navigate = useNavigate();
    const [gangs, setGangs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [feedbackNotice, setFeedbackNotice] = useState(null);
    const { isLSSD } = useTheme();
    const { t } = useLanguage();

    // --- VIEW STATE ---
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'
    const [activeBoardGang, setActiveBoardGang] = useState(null); // Gang object for Whiteboard view

    // --- MODAL CONTROLS ---
    const [activeModal, setActiveModal] = useState(null); // 'createGang', 'vehicle', 'home', 'member', 'info', 'patrol', 'patrolTable'
    const [activeGangId, setActiveGangId] = useState(null); // Which gang is being edited
    const [editingItemId, setEditingItemId] = useState(null); // ID of the specific item being edited (vehicle, member, etc.)
    const [submitting, setSubmitting] = useState(false);

    // --- ACTIVITY VIEW STATE ---
    const [showActivity, setShowActivity] = useState(false);
    const [activityType, setActivityType] = useState('incidents'); // 'incidents' | 'outings' | 'cases'
    const [activityLog, setActivityLog] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [activitySearchQuery, setActivitySearchQuery] = useState('');

    // --- FORMS STATE ---
    // Gang
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#ffffff');
    const [zonesImage, setZonesImage] = useState(null);
    const [detective1, setDetective1] = useState('');
    const [detective2, setDetective2] = useState('');
    const [users, setUsers] = useState([]);

    // Vehicle
    const [vehModel, setVehModel] = useState('');
    const [vehPlate, setVehPlate] = useState('');
    const [vehOwner, setVehOwner] = useState('');
    const [vehNotes, setVehNotes] = useState('');
    const [vehImages, setVehImages] = useState([]);

    // Home
    const [homeOwner, setHomeOwner] = useState('');
    const [homeNotes, setHomeNotes] = useState('');
    const [homeImages, setHomeImages] = useState([]);

    // Member
    const [memName, setMemName] = useState('');
    const [memId, setMemId] = useState('');
    const [memRole, setMemRole] = useState('Sospechoso');
    const [memNotes, setMemNotes] = useState('');
    const [memPhoto, setMemPhoto] = useState(null);

    // Info
    const [infoType, setInfoType] = useState('info'); // info | characteristic
    const [infoContent, setInfoContent] = useState('');
    const [infoImages, setInfoImages] = useState([]);

    // Graffiti
    const [graffitiImage, setGraffitiImage] = useState(null);
    const [gpsImage, setGpsImage] = useState(null);
    const [graffitiNotes, setGraffitiNotes] = useState('');

    // Patrol Log
    const [patrolTime, setPatrolTime] = useState('');
    const [patrolPeopleCount, setPatrolPeopleCount] = useState(0);
    const [patrolPhoto, setPatrolPhoto] = useState(null);
    const [patrolNotes, setPatrolNotes] = useState('');
    const [patrolLogs, setPatrolLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null); // For detail view

    // Conflict
    const [conflictTargetGangId, setConflictTargetGangId] = useState('');
    const [conflictTargetName, setConflictTargetName] = useState('');
    const [conflictReason, setConflictReason] = useState('Desconocido');
    const [conflictStatus, setConflictStatus] = useState('active');

    // --- IMAGE VIEWER STATE ---
    const [expandedImage, setExpandedImage] = useState(null);

    // --- MEMBER PROFILE CARD STATE ---
    const [selectedMember, setSelectedMember] = useState(null);
    const [editingMemberNotes, setEditingMemberNotes] = useState('');

    // --- DRAG TO SCROLL STATE ---
    const scrollContainerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // --- SEARCH STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (activeBoardGang) {
                    setActiveBoardGang(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeBoardGang]);

    useEffect(() => {
        loadGangs();
        fetchUserRole();
        fetchUsers();
    }, []);

    const fetchUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('rol').eq('id', user.id).single();
            if (data) setUserRole(data.rol);
        }
    };

    const fetchUsers = async () => {
        const { data, error } = await supabase.from('users').select('id, nombre, apellido, rango').order('nombre');
        if (error) console.error('Error fetching users:', error);
        else setUsers(data || []);
    };

    const isVIP = () => {
        if (!userRole) return false;
        const r = userRole.trim().toLowerCase();
        return ['coordinador', 'comisionado', 'administrador', 'admin'].includes(r);
    };

    const loadGangs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_gangs_data');

            if (error) {
                console.error(error);
                if (error.message.includes("Access Denied") || error.code === 'P0001') {
                    setAccessDenied(true);
                }
            } else if (data === null) {
                setAccessDenied(true);
            } else {
                // Fetch linked incidents to calculate day-of-week activity per gang
                let incidentsMap = {};
                try {
                    const [junctionRes, incsRes] = await Promise.all([
                        supabase.from('incident_gangs').select('gang_id, incident_id'),
                        supabase.rpc('get_incidents_v2')
                    ]);

                    const incidentsList = incsRes.data || [];
                    const incLookup = new Map();
                    incidentsList.forEach(inc => {
                        incLookup.set(inc.record_id || inc.id, inc);
                    });

                    (data || []).forEach(g => {
                        incidentsMap[g.gang_id] = [];
                    });

                    if (junctionRes.data && Array.isArray(junctionRes.data) && junctionRes.data.length > 0) {
                        junctionRes.data.forEach(link => {
                            const inc = incLookup.get(link.incident_id);
                            if (inc && incidentsMap[link.gang_id]) {
                                incidentsMap[link.gang_id].push(inc);
                            }
                        });
                    }

                    // Fallback to direct gang_id / gang_names matching from get_incidents_v2 if junction was empty
                    (data || []).forEach(g => {
                        if (!incidentsMap[g.gang_id] || incidentsMap[g.gang_id].length === 0) {
                            const matched = incidentsList.filter(inc => {
                                if (inc.gang_id === g.gang_id) return true;
                                if (inc.gang_names && Array.isArray(inc.gang_names) && g.name) {
                                    return inc.gang_names.some(gn => gn && gn.toLowerCase() === g.name.toLowerCase());
                                }
                                return false;
                            });
                            if (matched.length > 0) {
                                incidentsMap[g.gang_id] = matched;
                            }
                        }
                    });
                } catch (incErr) {
                    console.warn("Could not fetch incidents for weekly activity calculation:", incErr);
                }

                // Fetch undercover intelligence linked to gangs
                let undercoverIntelMap = {};
                try {
                    const { data: udIntel } = await supabase.rpc('get_undercover_gang_intel');
                    if (udIntel && Array.isArray(udIntel)) {
                        udIntel.forEach(item => {
                            if (item.gang_id) {
                                if (!undercoverIntelMap[item.gang_id]) undercoverIntelMap[item.gang_id] = [];
                                undercoverIntelMap[item.gang_id].push(item);
                            }
                        });
                    }
                } catch (udErr) {
                    console.warn("Could not fetch undercover intel for gangs:", udErr);
                }

                // Attach weekly activity analysis and undercover intel to each gang
                const enrichedGangs = (data || []).map(g => {
                    const gangIncidents = incidentsMap[g.gang_id] || [];
                    const gangUndercover = undercoverIntelMap[g.gang_id] || [];
                    return {
                        ...g,
                        linked_incidents_data: gangIncidents,
                        weekly_activity: calculateGangWeeklyActivity(gangIncidents),
                        undercover_intel: gangUndercover,
                        undercover_count: gangUndercover.length
                    };
                });

                setGangs(enrichedGangs);
            }
        } catch (err) {
            console.error("Critical error in loadGangs:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e, setState, single = false) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            for (const file of files) {
                const publicUrl = await uploadImageToStorage(file, 'gangs');
                if (publicUrl) {
                    if (single) {
                        setState(publicUrl);
                    } else {
                        setState(prev => [...prev, publicUrl]);
                    }
                }
            }
            setFeedbackNotice("✅ Imagen subida con éxito al Bucket de Supabase Storage ☁️");
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            console.error("Error uploading image to Storage:", err);
            alert("Error uploading image to Storage: " + err.message);
        }
    };

    // --- ACTIONS ---

    const createWhiteboardCardForGang = async (gangId, title, content, category, color, imageUrl, linkedTag = null) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('case_board_nodes').insert([{
                gang_id: gangId,
                title: title,
                content: content || null,
                category: category || 'note',
                color: color || 'red',
                image_url: imageUrl || null,
                linked_update_ids: linkedTag ? [linkedTag] : [],
                pos_x: Math.floor(Math.random() * 300) + 100,
                pos_y: Math.floor(Math.random() * 300) + 100,
                created_by: user ? user.id : null
            }]);
        } catch (err) {
            console.error('Auto create whiteboard card error:', err);
        }
    };

    const handleToggleArchive = async (id, currentStatus) => {
        if (!confirm(currentStatus ? "Re-open this syndicate file?" : "Archive this syndicate? Data will be preserved.")) return;
        try {
            const { error } = await supabase.rpc('toggle_gang_archive', { p_gang_id: id, p_archive: !currentStatus });
            if (error) throw error;
            loadGangs();
        } catch (err) { alert(err.message); }
    };
    const handleDeleteGang = async (id) => {
        if (!confirm("⚠️ DANGER: This will permanently delete the gang and ALL associated data (vehicles, members, etc). This cannot be undone.\n\nAre you sure?")) return;
        try {
            const { error } = await supabase.rpc('delete_gang_fully', { p_gang_id: id });
            if (error) throw error;
            loadGangs();
        } catch (err) { alert(err.message); }
    };

    const handleDeleteItem = async (type, id) => {
        if (!confirm("Delete this item permanently?")) return;
        try {
            const { error } = await supabase.rpc('delete_gang_item', { p_table: type, p_id: id });
            if (error) throw error;
            loadGangs();
        } catch (err) { alert(err.message); }
    };

    const handleEditItem = (type, gangId, item) => {
        setActiveGangId(gangId);
        setEditingItemId(item.id);
        setActiveModal(type);

        // Populate inputs based on type
        if (type === 'vehicle') {
            setVehModel(item.model || ''); 
            setVehPlate(item.plate || ''); 
            setVehOwner(item.owner || ''); 
            setVehNotes(item.notes || ''); 
            setVehImages(item.images || []);
        } else if (type === 'home') {
            setHomeOwner(item.owner || ''); 
            setHomeNotes(item.notes || ''); 
            setHomeImages(item.images || []);
        } else if (type === 'member') {
            const name = item.name || '';
            const match = name.match(/\[([^\]]+)\]/);
            if (match) {
                const extractedId = match[1];
                const extractedName = name.replace(`[${extractedId}]`, '').replace(/\s+/g, ' ').trim();
                setMemName(extractedName);
                setMemId(extractedId);
            } else {
                setMemName(name);
                setMemId('');
            }
            setMemRole(item.role || 'Sospechoso'); 
            setMemNotes(item.notes || ''); 
            setMemPhoto(item.photo || null);
        } else if (type === 'info') {
            setInfoType(item.type || 'info'); 
            setInfoContent(item.content || ''); 
            setInfoImages(item.images || []);
        } else if (type === 'graffiti') {
            setGraffitiImage(item.graffiti_image || null);
            setGpsImage(item.gps_image || null);
            setGraffitiNotes(item.notes || '');
        } else if (type === 'conflict') {
            setConflictTargetGangId(item.target_gang_id || '');
            setConflictTargetName(item.target_gang_name || '');
            setConflictReason(item.reason || 'Desconocido');
            setConflictStatus(item.status || 'active');
        }
    };

    // --- SUBMISSION HANDLERS ---

    const handleCreateGang = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_gang', { 
                p_name: newName, 
                p_color: newColor, 
                p_zones_image: zonesImage,
                p_detective_in_charge_1: detective1 || null,
                p_detective_in_charge_2: detective2 || null
            });
            if (error) throw error;
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        
        // strict trim values
        const model = vehModel.trim();
        const plate = vehPlate.trim();
        const owner = vehOwner.trim();
        const notes = vehNotes.trim();

        // Validation: Must have at least Model OR Plate
        if (!model && !plate) {
            alert("Please enter at least a Vehicle Model or Plate.");
            return;
        }

        setSubmitting(true);
        try {
            let uploadedImages = [];
            let usedBucket = false;
            if (vehImages && vehImages.length > 0) {
                uploadedImages = await Promise.all(
                    vehImages.map(async img => {
                        if (img && img.startsWith('data:')) {
                            usedBucket = true;
                            return await uploadImageToStorage(img, 'gangs');
                        }
                        return img;
                    })
                );
            }

            if (editingItemId) {
                const tag = 'gang_vehicle_' + editingItemId;
                const { error } = await supabase.rpc('update_gang_vehicle', {
                    p_vehicle_id: editingItemId, p_model: model, p_plate: plate, p_owner: owner, p_notes: notes, p_images: uploadedImages
                });
                if (error) throw error;

                try {
                    const { data: bNodes } = await supabase
                        .from('case_board_nodes')
                        .select('id, title, linked_update_ids')
                        .eq('gang_id', activeGangId)
                        .eq('category', 'vehicle');

                    if (bNodes && bNodes.length > 0) {
                        const targetNode = bNodes.find(n => {
                            if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && (n.linked_update_ids.includes(tag) || n.linked_update_ids.includes(editingItemId))) return true;
                            if (plate && plate.trim() && plate.trim().toUpperCase() !== 'SIN PLACA' && plate.trim().length >= 3 && (n.title || '').includes(plate.trim())) return true;
                            return false;
                        });

                        if (targetNode) {
                            await supabase.from('case_board_nodes')
                                .update({
                                    title: (model || 'Vehículo') + ' [' + (plate || 'SIN PLACA') + ']',
                                    content: 'Propietario: ' + (owner || 'Desconocido') + (notes ? '\n' + notes : ''),
                                    linked_update_ids: [tag],
                                    image_url: (uploadedImages && uploadedImages.length > 0) ? uploadedImages[0] : null
                                })
                                .eq('id', targetNode.id);
                        } else {
                            createWhiteboardCardForGang(
                                activeGangId,
                                (model || 'Vehículo') + ' [' + (plate || 'SIN PLACA') + ']',
                                'Propietario: ' + (owner || 'Desconocido') + (notes ? '\n' + notes : ''),
                                'vehicle',
                                'purple',
                                (uploadedImages && uploadedImages.length > 0) ? uploadedImages[0] : null,
                                tag
                            );
                        }
                    }
                } catch (nodeErr) {
                    console.warn('Could not sync vehicle card to whiteboard:', nodeErr);
                }
            } else {
                const { data: newVehId, error } = await supabase.rpc('add_gang_vehicle', {
                    p_gang_id: activeGangId, p_model: model, p_plate: plate, p_owner: owner, p_notes: notes, p_images: uploadedImages
                });
                if (error) throw error;

                const tag = newVehId ? 'gang_vehicle_' + newVehId : null;
                createWhiteboardCardForGang(
                    activeGangId,
                    (model || 'Vehículo') + ' [' + (plate || 'SIN PLACA') + ']',
                    'Propietario: ' + (owner || 'Desconocido') + (notes ? '\n' + notes : ''),
                    'vehicle',
                    'purple',
                    uploadedImages && uploadedImages.length > 0 ? uploadedImages[0] : null,
                    tag
                );
            }
            closeModal();
            loadGangs();
            setFeedbackNotice(usedBucket
                ? "✅ Vehículo guardado con éxito. Imagen(es) subida(s) al Bucket de Supabase Storage ☁️"
                : "✅ Vehículo guardado con éxito 📝"
            );
            setTimeout(() => setFeedbackNotice(null), 6000);
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddHome = async (e) => {
        e.preventDefault();

        const owner = homeOwner.trim();
        const notes = homeNotes.trim();

        // Validation: Must have at least Owner OR Notes
        if (!owner && !notes) {
            alert("Please enter at least an Owner or Address/Notes.");
            return;
        }

        setSubmitting(true);
        try {
            let uploadedImages = [];
            let usedBucket = false;
            if (homeImages && homeImages.length > 0) {
                uploadedImages = await Promise.all(
                    homeImages.map(async img => {
                        if (img && img.startsWith('data:')) {
                            usedBucket = true;
                            return await uploadImageToStorage(img, 'gangs');
                        }
                        return img;
                    })
                );
            }

            if (editingItemId) {
                const tag = 'gang_home_' + editingItemId;
                const { error } = await supabase.rpc('update_gang_home', {
                    p_home_id: editingItemId, p_owner: owner, p_notes: notes, p_images: uploadedImages
                });
                if (error) throw error;

                try {
                    const { data: bNodes } = await supabase
                        .from('case_board_nodes')
                        .select('id, title, linked_update_ids')
                        .eq('gang_id', activeGangId)
                        .eq('category', 'location');

                    if (bNodes && bNodes.length > 0) {
                        const targetNode = bNodes.find(n => {
                            if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && (n.linked_update_ids.includes(tag) || n.linked_update_ids.includes(editingItemId))) return true;
                            return false;
                        });

                        if (targetNode) {
                            await supabase.from('case_board_nodes')
                                .update({
                                    title: 'Propiedad: ' + (owner || 'Ubicación Banda'),
                                    content: notes || 'Sin notas',
                                    linked_update_ids: [tag],
                                    image_url: (uploadedImages && uploadedImages.length > 0) ? uploadedImages[0] : null
                                })
                                .eq('id', targetNode.id);
                        } else {
                            createWhiteboardCardForGang(
                                activeGangId,
                                'Propiedad: ' + (owner || 'Ubicación Banda'),
                                notes || 'Sin detalles de dirección',
                                'location',
                                'green',
                                uploadedImages && uploadedImages.length > 0 ? uploadedImages[0] : null,
                                tag
                            );
                        }
                    }
                } catch (nodeErr) {
                    console.warn('Could not sync home card to whiteboard:', nodeErr);
                }
            } else {
                const { data: newHomeId, error } = await supabase.rpc('add_gang_home', {
                    p_gang_id: activeGangId, p_owner: owner, p_notes: notes, p_images: uploadedImages
                });
                if (error) throw error;

                const tag = newHomeId ? 'gang_home_' + newHomeId : null;
                createWhiteboardCardForGang(
                    activeGangId,
                    'Propiedad: ' + (owner || 'Ubicación Banda'),
                    notes || 'Sin detalles de dirección',
                    'location',
                    'green',
                    uploadedImages && uploadedImages.length > 0 ? uploadedImages[0] : null,
                    tag
                );
            }
            closeModal();
            loadGangs();
            setFeedbackNotice(usedBucket
                ? "✅ Inmueble/Propiedad guardada con éxito. Imagen(es) subida(s) al Bucket de Supabase Storage ☁️"
                : "✅ Inmueble/Propiedad guardada con éxito 📝"
            );
            setTimeout(() => setFeedbackNotice(null), 6000);
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const finalName = memId.trim() ? `${memName.trim()} [${memId.trim()}]` : memName.trim();

            let uploadedPhoto = memPhoto;
            let usedBucket = false;
            if (uploadedPhoto && uploadedPhoto.startsWith('data:')) {
                usedBucket = true;
                uploadedPhoto = await uploadImageToStorage(uploadedPhoto, 'gangs');
            }

            if (editingItemId) {
                const isInactive = memRole === 'Inactivo';
                const nodeColor = isInactive ? 'dark' : memRole === 'Lider' ? 'red' : memRole === 'Sublider' ? 'yellow' : 'blue';
                const tag = 'gang_member_' + editingItemId;
                const { error } = await supabase.rpc('update_gang_member', {
                    p_member_id: editingItemId, p_name: finalName, p_role: memRole, p_photo: uploadedPhoto, p_notes: memNotes
                });
                if (error) throw error;

                try {
                    const { data: bNodes } = await supabase
                        .from('case_board_nodes')
                        .select('id, title, linked_update_ids')
                        .eq('gang_id', activeGangId)
                        .eq('category', 'suspect');

                    if (bNodes && bNodes.length > 0) {
                        const targetNode = bNodes.find(n => {
                            if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && (n.linked_update_ids.includes(tag) || n.linked_update_ids.includes(editingItemId))) return true;
                            if (memId && memId.trim() && (n.title || '').includes(`[${memId.trim()}]`)) return true;
                            return false;
                        });

                        if (targetNode) {
                            await supabase.from('case_board_nodes')
                                .update({
                                    title: `${finalName} (${memRole})`,
                                    content: `Rol: ${memRole}${memId.trim() ? '\nID: ' + memId.trim() : ''}`,
                                    color: nodeColor,
                                    is_inactive: isInactive,
                                    linked_update_ids: [tag],
                                    image_url: uploadedPhoto || null
                                })
                                .eq('id', targetNode.id);
                        } else {
                            createWhiteboardCardForGang(
                                activeGangId,
                                finalName + ' (' + memRole + ')',
                                'Rol: ' + memRole,
                                'suspect',
                                memRole === 'Lider' ? 'red' : memRole === 'Sublider' ? 'yellow' : 'blue',
                                uploadedPhoto || null,
                                tag
                            );
                        }
                    }
                } catch (nodeErr) {
                    console.warn('Could not sync member card to whiteboard:', nodeErr);
                }
            } else {
                const { data: newMemId, error } = await supabase.rpc('add_gang_member', {
                    p_gang_id: activeGangId, p_name: finalName, p_role: memRole, p_photo: uploadedPhoto, p_notes: memNotes
                });
                if (error) throw error;

                const tag = newMemId ? 'gang_member_' + newMemId : null;
                createWhiteboardCardForGang(
                    activeGangId,
                    finalName + ' (' + memRole + ')',
                    'Rol: ' + memRole,
                    'suspect',
                    memRole === 'Lider' ? 'red' : memRole === 'Sublider' ? 'yellow' : 'blue',
                    uploadedPhoto || null,
                    tag
                );
            }
            closeModal();
            loadGangs();
            setFeedbackNotice(usedBucket
                ? "✅ Miembro guardado con éxito. Foto subida al Bucket de Supabase Storage ☁️"
                : "✅ Miembro guardado con éxito 📝"
            );
            setTimeout(() => setFeedbackNotice(null), 6000);
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddInfo = async (e) => {
        e.preventDefault();
        
        const content = infoContent.trim();
        if (!content) {
            alert("Content cannot be empty.");
            return;
        }

        setSubmitting(true);
        try {
            let uploadedImages = [];
            let usedBucket = false;
            if (infoImages && infoImages.length > 0) {
                uploadedImages = await Promise.all(
                    infoImages.map(async img => {
                        if (img && img.startsWith('data:')) {
                            usedBucket = true;
                            return await uploadImageToStorage(img, 'gangs');
                        }
                        return img;
                    })
                );
            }

            if (editingItemId) {
                const tag = 'gang_info_' + editingItemId;
                const { error } = await supabase.rpc('update_gang_info', {
                    p_info_id: editingItemId, p_type: infoType, p_content: content, p_images: uploadedImages
                });
                if (error) throw error;

                try {
                    const { data: bNodes } = await supabase
                        .from('case_board_nodes')
                        .select('id, title, content, linked_update_ids')
                        .eq('gang_id', activeGangId)
                        .in('category', ['evidence', 'note']);

                    if (bNodes && bNodes.length > 0) {
                        const targetNode = bNodes.find(n => {
                            if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && (n.linked_update_ids.includes(tag) || n.linked_update_ids.includes(editingItemId))) return true;
                            return false;
                        });

                        if (targetNode) {
                            await supabase.from('case_board_nodes')
                                .update({
                                    title: 'Inteligencia (' + (infoType === 'characteristic' ? 'Característica' : 'Info') + ')',
                                    content: content,
                                    color: infoType === 'characteristic' ? 'yellow' : 'dark',
                                    category: 'evidence',
                                    linked_update_ids: [tag],
                                    image_url: (uploadedImages && uploadedImages.length > 0) ? uploadedImages[0] : null
                                })
                                .eq('id', targetNode.id);
                        } else {
                            createWhiteboardCardForGang(
                                activeGangId,
                                'Inteligencia (' + (infoType === 'characteristic' ? 'Característica' : 'Info') + ')',
                                content,
                                'evidence',
                                infoType === 'characteristic' ? 'yellow' : 'dark',
                                uploadedImages && uploadedImages.length > 0 ? uploadedImages[0] : null,
                                tag
                            );
                        }
                    }
                } catch (nodeErr) {
                    console.warn('Could not sync info card to whiteboard:', nodeErr);
                }
            } else {
                const { data: newInfoId, error } = await supabase.rpc('add_gang_info', {
                    p_gang_id: activeGangId, p_type: infoType, p_content: content, p_images: uploadedImages
                });
                if (error) throw error;

                const tag = newInfoId ? 'gang_info_' + newInfoId : null;
                createWhiteboardCardForGang(
                    activeGangId,
                    'Inteligencia (' + (infoType === 'characteristic' ? 'Característica' : 'Info') + ')',
                    content,
                    'evidence',
                    infoType === 'characteristic' ? 'yellow' : 'dark',
                    uploadedImages && uploadedImages.length > 0 ? uploadedImages[0] : null,
                    tag
                );
            }
            closeModal();
            loadGangs();
            setFeedbackNotice(usedBucket
                ? "✅ Registro de Inteligencia guardado con éxito. Imagen(es) subida(s) al Bucket de Supabase Storage ☁️"
                : "✅ Registro de Inteligencia guardado con éxito 📝"
            );
            setTimeout(() => setFeedbackNotice(null), 6000);
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddGraffiti = async (e) => {
        e.preventDefault();
        
        if (!graffitiImage) {
            alert("Please upload a photo of the graffiti.");
            return;
        }
        if (!gpsImage) {
            alert("Please upload a photo of the GPS/map location.");
            return;
        }

        setSubmitting(true);
        try {
            let uploadedGraffiti = graffitiImage;
            let uploadedGps = gpsImage;
            let usedBucket = false;

            if (uploadedGraffiti && uploadedGraffiti.startsWith('data:')) {
                usedBucket = true;
                uploadedGraffiti = await uploadImageToStorage(uploadedGraffiti, 'gangs');
            }
            if (uploadedGps && uploadedGps.startsWith('data:')) {
                usedBucket = true;
                uploadedGps = await uploadImageToStorage(uploadedGps, 'gangs');
            }

            if (editingItemId) {
                const tag = 'gang_graffiti_' + editingItemId;
                const { error } = await supabase.rpc('update_gang_graffiti', {
                    p_graffiti_id: editingItemId,
                    p_graffiti_image: uploadedGraffiti,
                    p_gps_image: uploadedGps,
                    p_notes: graffitiNotes.trim()
                });
                if (error) throw error;
                const newImg = uploadedGraffiti || uploadedGps;

                try {
                    const { data: bNodes } = await supabase
                        .from('case_board_nodes')
                        .select('id, title, content, linked_update_ids')
                        .eq('gang_id', activeGangId)
                        .eq('category', 'evidence');

                    if (bNodes && bNodes.length > 0) {
                        const targetNode = bNodes.find(n => {
                            if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && (n.linked_update_ids.includes(tag) || n.linked_update_ids.includes(editingItemId))) return true;
                            return false;
                        });

                        if (targetNode) {
                            await supabase.from('case_board_nodes')
                                .update({
                                    title: 'Grafiti / GPS',
                                    content: graffitiNotes.trim() || 'Evidencia de grafiti registrado',
                                    linked_update_ids: [tag],
                                    image_url: newImg || null
                                })
                                .eq('id', targetNode.id);
                        } else {
                            createWhiteboardCardForGang(
                                activeGangId,
                                'Grafiti / GPS',
                                graffitiNotes.trim() || 'Evidencia de grafiti registrado',
                                'evidence',
                                'purple',
                                uploadedGraffiti || uploadedGps || null,
                                tag
                            );
                        }
                    }
                } catch (nodeErr) {
                    console.warn('Could not sync graffiti card to whiteboard:', nodeErr);
                }
            } else {
                const { data: newGrafId, error } = await supabase.rpc('add_gang_graffiti', {
                    p_gang_id: activeGangId,
                    p_graffiti_image: uploadedGraffiti,
                    p_gps_image: uploadedGps,
                    p_notes: graffitiNotes.trim()
                });
                if (error) throw error;

                const tag = newGrafId ? 'gang_graffiti_' + newGrafId : null;
                createWhiteboardCardForGang(
                    activeGangId,
                    'Grafiti / GPS',
                    graffitiNotes.trim() || 'Evidencia de grafiti registrado',
                    'evidence',
                    'purple',
                    uploadedGraffiti || uploadedGps || null,
                    tag
                );
            }
            closeModal();
            loadGangs();
            setFeedbackNotice(usedBucket
                ? "✅ Grafiti guardado con éxito. Imagen(es) subida(s) al Bucket de Supabase Storage ☁️"
                : "✅ Grafiti guardado con éxito 📝"
            );
            setTimeout(() => setFeedbackNotice(null), 6000);
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddConflict = async (e) => {
        e.preventDefault();
        const finalTargetName = conflictTargetName.trim();
        if (!finalTargetName && !conflictTargetGangId) {
            alert("Por favor indica el grupo o selecciona una banda.");
            return;
        }

        setSubmitting(true);
        try {
            const finalReason = conflictReason.trim() || 'Desconocido';
            const finalStatus = conflictStatus || 'active';

            if (editingItemId) {
                const tag = 'gang_conflict_' + editingItemId;
                const { error } = await supabase.rpc('update_gang_conflict', {
                    p_conflict_id: editingItemId,
                    p_target_gang_id: conflictTargetGangId || null,
                    p_target_gang_name: finalTargetName || null,
                    p_reason: finalReason,
                    p_status: finalStatus
                });
                if (error) throw error;

                try {
                    const { data: bNodes } = await supabase
                        .from('case_board_nodes')
                        .select('id, title, linked_update_ids')
                        .eq('gang_id', activeGangId)
                        .eq('category', 'threat');

                    if (bNodes && bNodes.length > 0) {
                        const targetNode = bNodes.find(n => {
                            if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && (n.linked_update_ids.includes(tag) || n.linked_update_ids.includes(editingItemId))) return true;
                            return false;
                        });

                        if (targetNode) {
                            await supabase.from('case_board_nodes')
                                .update({
                                    title: 'Conflicto: ' + (finalTargetName || 'Banda Rival'),
                                    content: 'Motivo: ' + finalReason + (finalStatus === 'resolved' ? ' (Finalizado)' : ' (Activo)'),
                                    color: finalStatus === 'resolved' ? 'green' : 'red',
                                    is_inactive: finalStatus === 'resolved',
                                    linked_update_ids: [tag]
                                })
                                .eq('id', targetNode.id);
                        } else {
                            createWhiteboardCardForGang(
                                activeGangId,
                                'Conflicto: ' + (finalTargetName || 'Banda Rival'),
                                'Motivo: ' + finalReason + (finalStatus === 'resolved' ? ' (Finalizado)' : ' (Activo)'),
                                'threat',
                                finalStatus === 'resolved' ? 'green' : 'red',
                                null,
                                tag
                            );
                        }
                    }
                } catch (nodeErr) {
                    console.warn('Could not sync conflict card to whiteboard:', nodeErr);
                }
            } else {
                const { data: newConfId, error } = await supabase.rpc('add_gang_conflict', {
                    p_gang_id: activeGangId,
                    p_target_gang_id: conflictTargetGangId || null,
                    p_target_gang_name: finalTargetName || null,
                    p_reason: finalReason,
                    p_status: finalStatus
                });
                if (error) throw error;

                const tag = newConfId ? 'gang_conflict_' + newConfId : null;
                createWhiteboardCardForGang(
                    activeGangId,
                    'Conflicto: ' + (finalTargetName || 'Banda Rival'),
                    'Motivo: ' + finalReason + (finalStatus === 'resolved' ? ' (Finalizado)' : ' (Activo)'),
                    'threat',
                    finalStatus === 'resolved' ? 'green' : 'red',
                    null,
                    tag
                );
            }

            closeModal();
            loadGangs();
            setFeedbackNotice(editingItemId ? "✅ Conflicto actualizado con éxito ⚔️" : "✅ Conflicto registrado con éxito ⚔️");
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleConflictStatus = async (conflictId, currentStatus) => {
        const isResolved = currentStatus === 'resolved';
        const confirmMsg = isResolved 
            ? "¿Deseas reabrir este conflicto y marcarlo como ACTIVO?" 
            : "¿Deseas dar por FINALIZADO este conflicto?";
        if (!confirm(confirmMsg)) return;

        try {
            const { data: newStatus, error } = await supabase.rpc('toggle_gang_conflict_status', { p_conflict_id: conflictId });
            if (error) throw error;
            const updatedStatus = newStatus || (isResolved ? 'active' : 'resolved');

            // Also sync whiteboard node if present
            const currentGang = gangs.find(g => (g.conflicts || []).some(cf => cf.id === conflictId));
            const conflictObj = currentGang?.conflicts?.find(cf => cf.id === conflictId);
            if (currentGang && conflictObj && conflictObj.target_gang_name) {
                await supabase.from('case_board_nodes')
                    .update({
                        color: updatedStatus === 'resolved' ? 'green' : 'red',
                        content: 'Motivo: ' + (conflictObj.reason || 'Desconocido') + (updatedStatus === 'resolved' ? ' (Finalizado)' : ' (Activo)'),
                        is_inactive: updatedStatus === 'resolved'
                    })
                    .eq('gang_id', currentGang.gang_id)
                    .eq('category', 'threat')
                    .ilike('title', `%${conflictObj.target_gang_name}%`);
            }

            loadGangs();
            setFeedbackNotice(isResolved ? "⚔️ Conflicto reabierto (Activo)" : "✅ Conflicto marcado como Finalizado");
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleUpdateZone = async (e) => {
        e.preventDefault();
        if (!zonesImage) { alert("Please upload a map image."); return; }
        setSubmitting(true);
        try {
            let uploadedZone = zonesImage;
            let usedBucket = false;
            if (uploadedZone && uploadedZone.startsWith('data:')) {
                usedBucket = true;
                uploadedZone = await uploadImageToStorage(uploadedZone, 'gangs');
            }

            const { error } = await supabase.rpc('update_gang_zone', {
                p_gang_id: activeGangId, p_image: uploadedZone
            });
            if (error) throw error;
            closeModal();
            loadGangs();
            setFeedbackNotice(usedBucket
                ? "✅ Zona/Mapa de influencia actualizado con éxito. Imagen subida al Bucket de Supabase Storage ☁️"
                : "✅ Zona/Mapa de influencia actualizado con éxito 📝"
            );
            setTimeout(() => setFeedbackNotice(null), 6000);
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleViewActivity = async (type, gangId) => {
        const targetGangId = gangId || activeGangId;
        if (!targetGangId) return;

        // Handle patrol table separately
        if (type === 'patrolTable') {
            handleViewPatrolLogs(targetGangId);
            return;
        }

        setActiveGangId(targetGangId);
        setActivityType(type);
        setShowActivity(true);
        setLoadingActivity(true);
        setActivityLog([]);
        setActivitySearchQuery('');

        try {
            if (type === 'undercover') {
                try {
                    const { data: udData, error: udError } = await supabase.rpc('get_undercover_gang_intel', { p_gang_id: targetGangId });
                    if (!udError && udData) {
                        setActivityLog(udData);
                    } else {
                        const targetGang = gangs.find(g => g.gang_id === targetGangId);
                        setActivityLog(targetGang?.undercover_intel || []);
                    }
                } catch (e) {
                    const targetGang = gangs.find(g => g.gang_id === targetGangId);
                    setActivityLog(targetGang?.undercover_intel || []);
                }
                return;
            }

            const rpcName = type === 'incidents' 
                ? 'get_gang_incidents' 
                : type === 'cases' 
                    ? 'get_gang_cases' 
                    : 'get_gang_outings';
            const { data, error } = await supabase.rpc(rpcName, { p_gang_id: targetGangId });
            if (error) throw error;

            let formattedData = data || [];
            if (type === 'incidents') {
                formattedData = formattedData.map(inc => ({
                    ...inc,
                    images: filterBucketImages(inc.images),
                    author_avatar: getProfileImage(inc.author_avatar, '/logowebp/anon.webp'),
                    description: stripBase64FromHtml(inc.description)
                }));
            } else if (type === 'outings') {
                formattedData = formattedData.map(out => ({
                    ...out,
                    images: filterBucketImages(out.images),
                    documents: Array.isArray(out.documents) ? out.documents : [],
                    author_avatar: getProfileImage(out.author_avatar, '/logowebp/anon.webp'),
                    info_obtained: stripBase64FromHtml(out.info_obtained),
                    detectives: (out.detectives && Array.isArray(out.detectives))
                        ? out.detectives.map(d => ({ ...d, avatar: getProfileImage(d.avatar, '/logowebp/anon.webp') }))
                        : []
                }));
            }

            setActivityLog(formattedData);
        } catch (err) {
            console.error("Error fetching activity:", err);
            alert("No se pudo cargar el registro de actividad: " + err.message);
        } finally {
            setLoadingActivity(false);
        }
    };

    const handleExportGangPDF = async (gang) => {
        try {
            setFeedbackNotice(`📄 Generando resumen PDF de ${gang.name}...`);

            // Fetch author details
            const { data: { user } } = await supabase.auth.getUser();
            let authorName = 'Agente Investigador';
            if (user) {
                const { data: userData } = await supabase.from('users').select('nombre, apellido, rango').eq('id', user.id).single();
                if (userData) {
                    authorName = `${userData.rango || ''} ${userData.nombre || ''} ${userData.apellido || ''}`.trim();
                }
            }

            // Fetch related incidents, cases, outings and patrol logs for this gang
            const [incidentsRes, outingsRes, casesRes, patrolLogsRes] = await Promise.all([
                supabase.rpc('get_gang_incidents', { p_gang_id: gang.gang_id }),
                supabase.rpc('get_gang_outings', { p_gang_id: gang.gang_id }),
                supabase.rpc('get_gang_cases', { p_gang_id: gang.gang_id }),
                supabase.rpc('get_patrol_logs', { p_gang_id: gang.gang_id })
            ]);

            const incidents = incidentsRes.data || [];
            const outings = outingsRes.data || [];
            const cases = casesRes.data || gang.cases || [];
            const patrolLogs = patrolLogsRes.data || [];

            await generateGangSummaryPDF(gang, {
                incidents,
                outings,
                cases,
                patrolLogs,
                isLSSD,
                authorName
            });

            setFeedbackNotice(`✅ Resumen PDF de ${gang.name} exportado con éxito 📄`);
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            console.error("Error generating Gang PDF:", err);
            alert("Error al generar el PDF del resumen: " + err.message);
            setFeedbackNotice(null);
        }
    };

    // --- CLIPBOARD COPY FORMATTERS ---
    const formatMemberLine = (m) => {
        if (!m) return '';
        const rawName = (m.name || '').trim();
        if (!rawName) return '';

        let formattedLine = rawName;

        // Check if name contains brackets like "Zyra Brown [H2137OG9]"
        const bracketMatch = rawName.match(/^(.*?)\s*\[(.*?)\]$/);
        if (bracketMatch) {
            const namePart = bracketMatch[1].trim();
            const idPart = bracketMatch[2].trim();
            formattedLine = idPart ? `${namePart} - ${idPart}` : namePart;
        } else {
            // Check if name contains parenthesis like "Zyra Brown (H2137OG9)"
            const parenMatch = rawName.match(/^(.*?)\s*\((.*?)\)$/);
            if (parenMatch) {
                const namePart = parenMatch[1].trim();
                const idPart = parenMatch[2].trim();
                formattedLine = idPart ? `${namePart} - ${idPart}` : namePart;
            } else if (rawName.includes(' - ')) {
                formattedLine = rawName;
            } else {
                const extraId = m.member_id || m.dni || m.citizen_id || m.code;
                if (extraId && typeof extraId === 'string' && extraId.trim()) {
                    formattedLine = `${rawName} - ${extraId.trim()}`;
                }
            }
        }

        const isInactive = 
            (typeof m.role === 'string' && m.role.toLowerCase() === 'inactivo') ||
            (typeof m.status === 'string' && (m.status.toLowerCase() === 'inactivo' || m.status.toLowerCase() === 'inactive')) ||
            m.is_inactive === true ||
            m.is_active === false;

        if (isInactive) {
            return `~~${formattedLine}~~`;
        }

        return formattedLine;
    };

    const formatGangMembersText = (gang) => {
        if (!gang) return '';
        const title = `# ${gang.name.trim().toUpperCase()}`;
        const sortedMembers = [...(gang.members || [])].sort((a, b) => {
            const aInactive = (typeof a?.role === 'string' && a.role.toLowerCase() === 'inactivo') || (typeof a?.status === 'string' && a.status.toLowerCase() === 'inactivo') || a?.is_inactive === true;
            const bInactive = (typeof b?.role === 'string' && b.role.toLowerCase() === 'inactivo') || (typeof b?.status === 'string' && b.status.toLowerCase() === 'inactivo') || b?.is_inactive === true;
            if (aInactive && !bInactive) return 1;
            if (!aInactive && bInactive) return -1;
            return 0;
        });

        const memberLines = sortedMembers
            .map(m => formatMemberLine(m))
            .filter(line => line && line.trim() !== '');

        if (memberLines.length === 0) {
            return `${title}\n`;
        }
        return `${title}\n${memberLines.join('\n')}`;
    };

    const copyTextToClipboard = async (text, successMsg) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setFeedbackNotice(successMsg || "✅ Copiado al portapapeles 📋");
            setTimeout(() => setFeedbackNotice(null), 4000);
        } catch (err) {
            console.error("Clipboard copy error:", err);
            alert("Error al copiar al portapapeles: " + err.message);
        }
    };

    const handleCopyAllGangs = () => {
        const targetGangs = gangs.filter(g => viewMode === 'active' ? !g.is_archived : g.is_archived);
        const gangsToCopy = targetGangs.length > 0 ? targetGangs : gangs;

        const formatted = gangsToCopy
            .map(g => formatGangMembersText(g))
            .join('\n\n');

        copyTextToClipboard(formatted, `✅ Información de todos los grupos (${gangsToCopy.length}) copiada al portapapeles 📋`);
    };

    const handleCopySingleGang = (gang) => {
        const formatted = formatGangMembersText(gang);
        copyTextToClipboard(formatted, `✅ Información de ${gang.name} copiada al portapapeles 📋`);
    };

    // --- PATROL LOG HANDLERS ---
    const roundToQuarterHour = (date) => {
        const minutes = date.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const rounded = new Date(date);
        rounded.setMinutes(roundedMinutes);
        rounded.setSeconds(0);
        rounded.setMilliseconds(0);
        return rounded;
    };

    const handleOpenPatrolLog = (gangId) => {
        setActiveGangId(gangId);
        setActiveModal('patrol');
        // Set default time to nearest quarter hour
        const now = roundToQuarterHour(new Date());
        // Format as local datetime for datetime-local input (YYYY-MM-DDTHH:MM)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        setPatrolTime(localDateTime);
        setPatrolPeopleCount(0);
        setPatrolPhoto(null);
        setPatrolNotes('');
    };

    const handleSubmitPatrolLog = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_patrol_log', {
                p_gang_id: activeGangId,
                p_patrol_time: new Date(patrolTime).toISOString(),
                p_people_count: parseInt(patrolPeopleCount),
                p_photo: patrolPhoto,
                p_notes: patrolNotes
            });
            if (error) throw error;
            closeModal();
            alert('Patrol log created successfully!');
        } catch (err) {
            alert('Error creating patrol log: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewPatrolLogs = async (gangId) => {
        setActiveGangId(gangId);
        setActiveModal('patrolTable');
        setLoadingActivity(true);
        try {
            const { data, error } = await supabase.rpc('get_patrol_logs', { p_gang_id: gangId });
            if (error) throw error;
            setPatrolLogs(data || []);
        } catch (err) {
            console.error('Error fetching patrol logs:', err);
            alert('Could not load patrol logs.');
        } finally {
            setLoadingActivity(false);
        }
    };

    const handleDeletePatrolLog = async (logId) => {
        if (!confirm('Are you sure you want to delete this patrol log?')) return;
        try {
            const { error } = await supabase.rpc('delete_patrol_log', { p_log_id: logId });
            if (error) throw error;
            // Refresh the list
            handleViewPatrolLogs(activeGangId);
        } catch (err) {
            alert('Error deleting patrol log: ' + err.message);
        }
    };

    // --- MEMBER PROFILE CARD HANDLERS ---
    const handleOpenMemberProfile = (member, gangId) => {
        setSelectedMember({ ...member, gang_id: gangId });
        setEditingMemberNotes(member.notes || '');
    };

    const handleSaveMemberNotes = async () => {
        if (!selectedMember) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('update_gang_member_notes', {
                p_member_id: selectedMember.id,
                p_notes: editingMemberNotes
            });
            if (error) throw error;

            // Update local state
            setGangs(gangs.map(g => {
                if (g.gang_id === selectedMember.gang_id) {
                    return {
                        ...g,
                        members: g.members.map(m =>
                            m.id === selectedMember.id
                                ? { ...m, notes: editingMemberNotes }
                                : m
                        )
                    };
                }
                return g;
            }));

            setSelectedMember({ ...selectedMember, notes: editingMemberNotes });
            alert('Notes saved successfully!');
        } catch (err) {
            alert('Error saving notes: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseMemberProfile = () => {
        setSelectedMember(null);
        setEditingMemberNotes('');
    };

    // --- EDIT GANG NAME HANDLER ---
    const handleEditGangName = (gangId) => {
        const gang = gangs.find(g => g.gang_id === gangId);
        if (gang) {
            setActiveGangId(gangId);
            setNewName(gang.name);
            setNewColor(gang.color || '#ffffff');
            setDetective1(gang.detective_in_charge_1 || '');
            setDetective2(gang.detective_in_charge_2 || '');
            setActiveModal('editGangName');
        }
    };

    const handleSaveGangName = async (e) => {
        e.preventDefault();
        if (!newName.trim()) {
            alert('Gang name cannot be empty');
            return;
        }
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('update_gang_details', {
                p_gang_id: activeGangId,
                p_name: newName.trim(),
                p_color: newColor,
                p_detective_in_charge_1: detective1 || null,
                p_detective_in_charge_2: detective2 || null
            });
            if (error) throw error;

            const d1User = users.find(u => u.id === detective1);
            const d2User = users.find(u => u.id === detective2);

            // Update local state
            setGangs(gangs.map(g =>
                g.gang_id === activeGangId
                    ? { 
                        ...g, 
                        name: newName.trim(), 
                        color: newColor,
                        detective_in_charge_1: detective1 || null,
                        detective_in_charge_1_name: d1User ? `${d1User.nombre} ${d1User.apellido}` : null,
                        detective_in_charge_2: detective2 || null,
                        detective_in_charge_2_name: d2User ? `${d2User.nombre} ${d2User.apellido}` : null
                      }
                    : g
            ));

            closeModal();
            alert('Gang details updated successfully!');
        } catch (err) {
            alert('Error updating gang details: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- HELPER HANDLERS ---
    const openModal = (type, gangId) => {
        // Special handling for patrol modal
        if (type === 'patrol') {
            handleOpenPatrolLog(gangId);
            return;
        }

        setActiveModal(type);
        setActiveGangId(gangId);
        if (type === 'updateZone') {
            // Find current gang and set existing image if any
            const gang = gangs.find(g => g.gang_id === gangId);
            if (gang) setZonesImage(gang.zones_image);
        }
    };

    const closeModal = () => {
        setActiveModal(null);
        setActiveGangId(null);
        setEditingItemId(null);
        setShowActivity(false);
        setActivityLog([]);
        resetFormFields();
    };

    const resetFormFields = () => {
        setNewName(''); setNewColor('#ffffff'); setZonesImage(null);
        setDetective1(''); setDetective2('');
        setVehModel(''); setVehPlate(''); setVehOwner(''); setVehNotes(''); setVehImages([]);
        setHomeOwner(''); setHomeNotes(''); setHomeImages([]);
        setMemName(''); setMemId(''); setMemRole('Sospechoso'); setMemNotes(''); setMemPhoto(null);
        setInfoType('info'); setInfoContent(''); setInfoImages([]);
        setGraffitiImage(null); setGpsImage(null); setGraffitiNotes('');
        setConflictTargetGangId(''); setConflictTargetName(''); setConflictReason('Desconocido'); setConflictStatus('active');
        setShowActivity(false);
        setActivityLog([]);
    };

    // --- DRAG TO SCROLL HANDLERS ---
    const handleMouseDown = (e) => {
        const container = scrollContainerRef.current;
        if (!container) return;
        setIsDragging(true);
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
        container.style.cursor = 'grabbing';
        container.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (!container) return;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        container.scrollLeft = scrollLeft - walk;
    };


    if (loading) return <div className="loading-container">{t('loadingIntel')}</div>;

    if (accessDenied) {
        return (
            <div className="documentation-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h1 style={{ color: 'red', fontSize: '3rem' }}>{t('accessDenied')}</h1>
                <p>{t('accessDeniedDesc')}</p>
            </div>
        );
    }

    const getSearchResults = () => {
        if (!searchQuery || !searchQuery.trim()) return [];
        const q = searchQuery.trim().toLowerCase();
        const results = [];

        gangs.forEach(gang => {
            const gangNameMatch = safeStrMatch(gang.name, q);
            const d1Match = safeStrMatch(gang.detective_in_charge_1_name, q);
            const d2Match = safeStrMatch(gang.detective_in_charge_2_name, q);

            if (gangNameMatch || d1Match || d2Match) {
                results.push({
                    type: 'gang',
                    title: gang.name,
                    subtitle: `Grupo Criminal${gang.is_archived ? ' [Archivado]' : ''}`,
                    gangId: gang.gang_id,
                    gangName: gang.name,
                    gangColor: gang.color
                });
            }

            (gang.members || []).forEach(m => {
                const nameMatch = safeStrMatch(m?.name, q);
                const roleMatch = safeStrMatch(m?.role, q);
                const notesMatch = safeStrMatch(m?.notes, q);
                const dniMatch = safeStrMatch(m?.dni || m?.citizen_id || m?.member_id, q);

                if (nameMatch || roleMatch || notesMatch || dniMatch) {
                    results.push({
                        type: 'member',
                        item: m,
                        title: m.name || 'Miembro',
                        subtitle: `${m.role || 'Miembro'}${m.notes ? ` • ${m.notes}` : ''}${gang.is_archived ? ' [Archivado]' : ''}`,
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color,
                        photo: m.photo
                    });
                }
            });

            (gang.vehicles || []).forEach(v => {
                const modelMatch = safeStrMatch(v?.model, q);
                const plateMatch = safeStrMatch(v?.plate, q);
                const ownerMatch = safeStrMatch(v?.owner, q);
                const notesMatch = safeStrMatch(v?.notes, q);

                if (modelMatch || plateMatch || ownerMatch || notesMatch) {
                    results.push({
                        type: 'vehicle',
                        item: v,
                        title: `${v.model || 'Vehículo'} [${v.plate || 'SIN PLACA'}]`,
                        subtitle: `Dueño: ${v.owner || 'Desconocido'}${v.notes ? ` • ${v.notes}` : ''}`,
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color
                    });
                }
            });

            (gang.homes || []).forEach(h => {
                const ownerMatch = safeStrMatch(h?.owner, q);
                const notesMatch = safeStrMatch(h?.notes, q);
                const locMatch = safeStrMatch(h?.location, q);

                if (ownerMatch || notesMatch || locMatch) {
                    results.push({
                        type: 'home',
                        item: h,
                        title: h.owner ? `Propiedad de ${h.owner}` : 'Propiedad / Inmueble',
                        subtitle: h.notes || h.location || 'Sin detalles',
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color
                    });
                }
            });

            (gang.info || []).forEach(inf => {
                const contentMatch = safeStrMatch(inf?.content, q);
                if (contentMatch) {
                    results.push({
                        type: 'info',
                        item: inf,
                        title: `Inteligencia (${inf.type === 'characteristic' ? 'Característica' : 'Info'})`,
                        subtitle: inf.content,
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color
                    });
                }
            });

            (gang.graffiti || []).forEach(g => {
                const notesMatch = safeStrMatch(g?.notes, q);
                const locMatch = safeStrMatch(g?.location, q);
                if (notesMatch || locMatch) {
                    results.push({
                        type: 'graffiti',
                        item: g,
                        title: 'Grafiti',
                        subtitle: g.notes || g.location,
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color
                    });
                }
            });

            (gang.conflicts || []).forEach(c => {
                const targetMatch = safeStrMatch(c?.target_gang_name, q);
                const reasonMatch = safeStrMatch(c?.reason, q);
                if (targetMatch || reasonMatch) {
                    results.push({
                        type: 'conflict',
                        item: c,
                        title: `Conflicto: ${c.target_gang_name}`,
                        subtitle: `Motivo: ${c.reason || 'Desconocido'}${gang.is_archived ? ' [Archivado]' : ''}`,
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color
                    });
                }
            });

            (gang.undercover_intel || []).forEach(ud => {
                const titleMatch = safeStrMatch(ud?.title, q);
                const contentMatch = safeStrMatch(ud?.content, q);
                const personaMatch = safeStrMatch(ud?.persona_name, q);
                const officerMatch = safeStrMatch(ud?.officer_name, q);
                if (titleMatch || contentMatch || personaMatch || officerMatch) {
                    results.push({
                        type: 'undercover',
                        item: ud,
                        title: `🕶️ Inteligencia UD: ${ud.title || 'Informe Encubierto'}`,
                        subtitle: `Agente/Identidad: ${ud.persona_name || ud.officer_name || 'Agente UD'} • ${ud.threat_level || 'MEDIO'}`,
                        gangId: gang.gang_id,
                        gangName: gang.name,
                        gangColor: gang.color
                    });
                }
            });
        });

        return results;
    };

    const searchResults = getSearchResults();

    const handleSelectSearchResult = (res) => {
        setSearchDropdownOpen(false);
        if (activeBoardGang) {
            setActiveBoardGang(null);
        }

        const targetGang = gangs.find(g => g.gang_id === res.gangId);
        if (targetGang) {
            if (targetGang.is_archived && viewMode !== 'archived') {
                setViewMode('archived');
            } else if (!targetGang.is_archived && viewMode !== 'active') {
                setViewMode('active');
            }
        }

        setTimeout(() => {
            const colElement = document.getElementById(`gang-col-${res.gangId}`);
            if (colElement && scrollContainerRef.current) {
                colElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
            if (res.type === 'member' && res.item) {
                handleOpenMemberProfile(res.item, res.gangId);
            }
        }, 100);
    };

    const gangHasMatch = (gang, q) => {
        if (!q || !q.trim()) return true;
        const query = q.trim().toLowerCase();
        return (
            safeStrMatch(gang.name, query) ||
            safeStrMatch(gang.detective_in_charge_1_name, query) ||
            safeStrMatch(gang.detective_in_charge_2_name, query) ||
            (gang.members || []).some(m => safeStrMatch(m?.name, query) || safeStrMatch(m?.role, query) || safeStrMatch(m?.notes, query) || safeStrMatch(m?.dni, query) || safeStrMatch(m?.citizen_id, query)) ||
            (gang.vehicles || []).some(v => safeStrMatch(v?.model, query) || safeStrMatch(v?.plate, query) || safeStrMatch(v?.owner, query) || safeStrMatch(v?.notes, query)) ||
            (gang.homes || []).some(h => safeStrMatch(h?.owner, query) || safeStrMatch(h?.notes, query) || safeStrMatch(h?.location, query)) ||
            (gang.info || []).some(i => safeStrMatch(i?.content, query)) ||
            (gang.graffiti || []).some(g => safeStrMatch(g?.notes, query) || safeStrMatch(g?.location, query)) ||
            (gang.conflicts || []).some(c => safeStrMatch(c?.target_gang_name, query) || safeStrMatch(c?.reason, query))
        );
    };

    const filteredGangs = gangs
        .filter(g => viewMode === 'active' ? !g.is_archived : g.is_archived)
        .filter(g => gangHasMatch(g, searchQuery));

    return (
        <div id="gangs-page" style={{ width: '100%', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', padding: '1rem 1.5rem 0px 1.5rem', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* Inner Header Navbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', padding: '0.3rem 0.8rem', gap: '1rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.015em' }}>{isLSSD ? t('gndTitle') : t('giuTitle')}</h2>

                        {/* Segmented Pill Tabs */}
                        <div className="mac-doc-tabs" style={{ padding: '0.25rem' }}>
                            <button className={`mac-doc-tab ${viewMode === 'active' ? 'active' : ''}`} onClick={() => setViewMode('active')} style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>{t('activeOperationTab')}</span>
                            </button>
                            <button className={`mac-doc-tab ${viewMode === 'archived' ? 'active' : ''}`} onClick={() => setViewMode('archived')} style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="21 8 21 21 3 21 3 8" />
                                    <rect x="1" y="3" width="22" height="5" />
                                    <line x1="10" y1="12" x2="14" y2="12" />
                                </svg>
                                <span>{t('archiveTab')}</span>
                            </button>
                            <button className={`mac-doc-tab ${viewMode === 'todo' ? 'active' : ''}`} onClick={() => setViewMode('todo')} style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 11l3 3L22 4" />
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </svg>
                                <span>{t('toDoListTab')}</span>
                            </button>
                        </div>

                        {/* SEARCH INPUT */}
                        <div ref={searchRef} style={{ position: 'relative', width: '260px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '20px',
                                padding: '0.35rem 0.85rem',
                                transition: 'all 0.3s ease',
                                boxShadow: searchQuery ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
                            }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#94a3b8' }}>
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Buscar persona, ID, vehículo..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setSearchDropdownOpen(true);
                                    }}
                                    onFocus={() => setSearchDropdownOpen(true)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: '#fff',
                                        fontSize: '0.82rem',
                                        width: '100%'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => { setSearchQuery(''); setSearchDropdownOpen(false); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.6)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            padding: '0 4px'
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Results */}
                            {searchDropdownOpen && searchQuery.trim() !== '' && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    width: '340px',
                                    maxHeight: '350px',
                                    overflowY: 'auto',
                                    background: 'rgba(15, 23, 42, 0.96)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    boxShadow: '0 15px 35px rgba(0,0,0,0.7)',
                                    zIndex: 1000,
                                    padding: '0.5rem'
                                }}>
                                    {searchResults.length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            No se encontraron resultados para "{searchQuery}"
                                        </div>
                                    ) : (
                                        searchResults.map((res, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => handleSelectSearchResult(res)}
                                                style={{
                                                    padding: '0.6rem 0.8rem',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    transition: 'background 0.2s',
                                                    borderBottom: idx < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {res.type === 'member' && res.photo ? (
                                                    <img src={res.photo} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${res.gangColor || '#fff'}` }} />
                                                ) : (
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(255,255,255,0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.9rem',
                                                        border: `1px solid ${res.gangColor || 'rgba(255,255,255,0.2)'}`
                                                    }}>
                                                        {res.type === 'member' ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                        ) : res.type === 'vehicle' ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                                                        ) : res.type === 'home' ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                                        ) : res.type === 'info' ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                        ) : res.type === 'graffiti' ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg>
                                                        ) : (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                                                        )}
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {res.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: res.gangColor || '#cfb53b', display: 'inline-block' }}></span>
                                                        <strong style={{ color: res.gangColor || '#fff' }}>{res.gangName}</strong>
                                                        <span>•</span>
                                                        <span>{res.subtitle}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            className="mac-btn mac-btn-secondary"
                            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.45rem', border: '1px solid rgba(255,255,255,0.18)' }}
                            onClick={handleCopyAllGangs}
                            title="Copiar información formateada de todos los grupos al portapapeles"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copiar Información Grupos</span>
                        </button>
                        {viewMode === 'active' && (
                            <button
                                className="mac-btn mac-btn-primary"
                                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                onClick={() => openModal('createGang', null)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>{t('trackNewSyndicateBtn')}</span>
                            </button>
                        )}
                    </div>
                </div>

            {feedbackNotice && (
                <div style={{
                    margin: '0.5rem 1.5rem',
                    padding: '0.8rem 1.2rem',
                    borderRadius: '6px',
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid #4ade80',
                    color: '#4ade80',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    {feedbackNotice}
                </div>
            )}

            {viewMode === 'todo' ? (
                <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
                    <GangTodoList />
                </div>
            ) : (
                /* Horizontal Scroll Container */
                <div
                    className="gang-scroll-container"
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    style={{ cursor: 'grab' }}
                >
                    {filteredGangs.length === 0 ? (
                        <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.6 }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                            <div>{t('noSyndicateFilesFound').replace('{mode}', viewMode === 'active' ? t('activeOperationTab') : t('archiveTab'))}</div>
                        </div>
                    ) : (
                        filteredGangs.map(gang => (
                            <GangColumn
                                key={gang.gang_id}
                                gang={gang}
                                searchQuery={searchQuery}
                                onAdd={openModal}
                                isVIP={isVIP()}
                                onArchive={() => handleToggleArchive(gang.gang_id, gang.is_archived)}
                                onDelete={() => handleDeleteGang(gang.gang_id)}
                                onViewImage={setExpandedImage}
                                onEdit={handleEditItem}
                                onDeleteSubItem={handleDeleteItem}
                                onViewActivity={handleViewActivity}
                                onViewMemberProfile={handleOpenMemberProfile}
                                onEditGangName={handleEditGangName}
                                onViewGangBoard={(g) => setActiveBoardGang(g)}
                                onExportPDF={handleExportGangPDF}
                                onToggleConflictStatus={handleToggleConflictStatus}
                                onCopyGangInfo={handleCopySingleGang}
                            />
                        ))
                    )}
                </div>
            )}

            {/* --- MODALS --- */}

            {/* Create Gang */}
            {activeModal === 'createGang' && (
                <Modal title={t('trackNewSyndicateModal')} onClose={closeModal} onSubmit={handleCreateGang} submitting={submitting}>
                    <Input label={t('syndicateNameLabel')} value={newName} onChange={e => setNewName(e.target.value)} required />
                    <ColorPicker label={t('colorIdLabel')} value={newColor} onChange={e => setNewColor(e.target.value)} />
                    <div className="form-group">
                        <label>{t('detectiveInCharge1')}</label>
                        <select className="form-input" value={detective1} onChange={e => setDetective1(e.target.value)}>
                            <option value="">{t('noneOption')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.rango ? `[${u.rango}] ` : ''}{u.nombre} {u.apellido}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('detectiveInCharge2')}</label>
                        <select className="form-input" value={detective2} onChange={e => setDetective2(e.target.value)}>
                            <option value="">{t('noneOption')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.rango ? `[${u.rango}] ` : ''}{u.nombre} {u.apellido}
                                </option>
                            ))}
                        </select>
                    </div>
                    <ImageUpload label={t('controlledZonesLabel')} image={zonesImage} onUpload={e => handleImageUpload(e, setZonesImage, true)} single />
                </Modal>
            )}

            {/* Edit Gang Name */}
            {activeModal === 'editGangName' && (
                <Modal title={t('editGangNameTitle')} onClose={closeModal} onSubmit={handleSaveGangName} submitting={submitting}>
                    <Input label={t('syndicateNameLabel')} value={newName} onChange={e => setNewName(e.target.value)} required />
                    <ColorPicker label={t('colorIdLabel')} value={newColor} onChange={e => setNewColor(e.target.value)} />
                    <div className="form-group">
                        <label>{t('detectiveInCharge1')}</label>
                        <select className="form-input" value={detective1} onChange={e => setDetective1(e.target.value)}>
                            <option value="">{t('noneOption')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.rango ? `[${u.rango}] ` : ''}{u.nombre} {u.apellido}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('detectiveInCharge2')}</label>
                        <select className="form-input" value={detective2} onChange={e => setDetective2(e.target.value)}>
                            <option value="">{t('noneOption')}</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.rango ? `[${u.rango}] ` : ''}{u.nombre} {u.apellido}
                                </option>
                            ))}
                        </select>
                    </div>
                </Modal>
            )}

            {/* Update Zone Map */}
            {activeModal === 'updateZone' && (
                <Modal title={t('updateZonesTitle')} onClose={closeModal} onSubmit={handleUpdateZone} submitting={submitting}>
                    <ImageUpload label={t('newMapImageLabel')} image={zonesImage} onUpload={e => handleImageUpload(e, setZonesImage, true)} single />
                </Modal>
            )}

            {/* Add/Edit Vehicle */}
            {activeModal === 'vehicle' && (
                <Modal title={editingItemId ? t('editVehTitle') : t('addVehIntelTitle')} onClose={closeModal} onSubmit={handleAddVehicle} submitting={submitting}>
                    <Input label={t('modelLabel')} value={vehModel} onChange={e => setVehModel(e.target.value)} />
                    <Input label={t('plateLabel')} value={vehPlate} onChange={e => setVehPlate(e.target.value)} />
                    <Input label={t('registeredOwnerLabel')} value={vehOwner} onChange={e => setVehOwner(e.target.value)} />
                    <TextArea label={t('notesLabel')} value={vehNotes} onChange={e => setVehNotes(e.target.value)} />
                    <MultiImageUpload images={vehImages} setImages={setVehImages} onUpload={e => handleImageUpload(e, setVehImages)} />
                </Modal>
            )}

            {/* Add/Edit Home */}
            {activeModal === 'home' && (
                <Modal title={editingItemId ? t('editPropTitle') : t('addPropIntelTitle')} onClose={closeModal} onSubmit={handleAddHome} submitting={submitting}>
                    <Input label={t('regOwnerOccLabel')} value={homeOwner} onChange={e => setHomeOwner(e.target.value)} />
                    <TextArea label={t('addressNotesLabel')} value={homeNotes} onChange={e => setHomeNotes(e.target.value)} />
                    <MultiImageUpload images={homeImages} setImages={setHomeImages} onUpload={e => handleImageUpload(e, setHomeImages)} />
                </Modal>
            )}

            {/* Add/Edit Member */}
            {activeModal === 'member' && (
                <Modal title={editingItemId ? t('editMemberTitle') : t('identifyMemberTitle')} onClose={closeModal} onSubmit={handleAddMember} submitting={submitting}>
                    <Input label={t('fullNameAliasLabel')} value={memName} onChange={e => setMemName(e.target.value)} required />
                    <Input label="ID" value={memId} onChange={e => setMemId(e.target.value)} placeholder="Ej: EBELT72G" />
                    <div className="form-group">
                        <label>{t('roleHierarchyLabel')}</label>
                        <select className="form-input" value={memRole} onChange={e => setMemRole(e.target.value)}>
                            <option value="Lider">Líder (Boss)</option>
                            <option value="Sublider">Sublíder (Underboss)</option>
                            <option value="Miembro">Miembro (Soldier)</option>
                            <option value="Sospechoso">Sospechoso (Associate)</option>
                            <option value="Inactivo">Inactivo (Inactive)</option>
                        </select>
                    </div>
                    <TextArea label={t('notesLabel')} value={memNotes} onChange={e => setMemNotes(e.target.value)} />
                    <ImageUpload label={t('mugshotPhotoLabel')} image={memPhoto} onUpload={e => handleImageUpload(e, setMemPhoto, true)} single />
                </Modal>
            )}

            {/* Add/Edit Info */}
            {activeModal === 'info' && (
                <Modal title={editingItemId ? t('editIntelTitle') : t('addIntelTitle')} onClose={closeModal} onSubmit={handleAddInfo} submitting={submitting}>
                    <div className="form-group">
                        <label>{t('entryTypeLabel')}</label>
                        <select className="form-input" value={infoType} onChange={e => setInfoType(e.target.value)}>
                            <option value="info">{t('generalInfoOpt')}</option>
                            <option value="characteristic">{t('defCharOpt')}</option>
                        </select>
                    </div>
                    <TextArea label={t('contentLabel')} value={infoContent} onChange={e => setInfoContent(e.target.value)} required />
                    <MultiImageUpload images={infoImages} setImages={setInfoImages} onUpload={e => handleImageUpload(e, setInfoImages)} />
                </Modal>
            )}

            {/* Add/Edit Graffiti */}
            {activeModal === 'graffiti' && (
                <Modal title={editingItemId ? t('editGraffitiTitle') : t('addGraffitiTitle')} onClose={closeModal} onSubmit={handleAddGraffiti} submitting={submitting}>
                    <ImageUpload label={t('graffitiImageLabel')} image={graffitiImage} onUpload={e => handleImageUpload(e, setGraffitiImage, true)} single />
                    <ImageUpload label={t('gpsImageLabel')} image={gpsImage} onUpload={e => handleImageUpload(e, setGpsImage, true)} single />
                    <TextArea label={t('notesLabel') + ' (Opcional)'} value={graffitiNotes} onChange={e => setGraffitiNotes(e.target.value)} />
                </Modal>
            )}

            {/* Add/Edit Conflict */}
            {activeModal === 'conflict' && (
                <Modal 
                    title={editingItemId ? (t('editConflictTitle') || 'Editar Conflicto') : (t('addConflictTitle') || 'Registrar Conflicto con Grupo')} 
                    onClose={closeModal} 
                    onSubmit={handleAddConflict} 
                    submitting={submitting}
                >
                    <div className="form-group">
                        <label>{t('rivalGroupLabel') || 'Grupo / Banda Rival'}</label>
                        <select
                            className="form-input"
                            value={conflictTargetGangId}
                            onChange={(e) => {
                                const selectedId = e.target.value;
                                setConflictTargetGangId(selectedId);
                                if (selectedId) {
                                    const targetG = gangs.find(g => g.gang_id === selectedId);
                                    if (targetG) {
                                        setConflictTargetName(targetG.name);
                                    }
                                }
                            }}
                        >
                            <option value="">{t('selectRivalGang') || '-- Seleccionar Banda Registrada o Escribir Abajo --'}</option>
                            {gangs
                                .filter(g => g.gang_id !== activeGangId)
                                .map(g => (
                                    <option key={g.gang_id} value={g.gang_id}>
                                        {g.name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>{t('customGroupName') || 'O escribir nombre de grupo / facción'}</label>
                        <input
                            type="text"
                            className="form-input"
                            value={conflictTargetName}
                            onChange={(e) => {
                                setConflictTargetName(e.target.value);
                                if (conflictTargetGangId) {
                                    const targetG = gangs.find(g => g.gang_id === conflictTargetGangId);
                                    if (!targetG || targetG.name !== e.target.value) {
                                        setConflictTargetGangId('');
                                    }
                                }
                            }}
                            placeholder="Ej. Marabunta Grande, Vagos..."
                            required={!conflictTargetName.trim() && !conflictTargetGangId}
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('conflictReasonLabel') || 'Motivo del Conflicto'}</label>
                        <textarea
                            className="eval-textarea"
                            rows="3"
                            value={conflictReason}
                            onChange={(e) => setConflictReason(e.target.value)}
                            placeholder="Motivo o causa del conflicto..."
                            required
                        />
                        <small style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                            * Por defecto se establecerá como "Desconocido" si no se especifica otra causa.
                        </small>
                    </div>

                    <div className="form-group">
                        <label>{t('conflictStatusLabel') || 'Estado del Conflicto'}</label>
                        <select
                            className="form-input"
                            value={conflictStatus}
                            onChange={(e) => setConflictStatus(e.target.value)}
                        >
                            <option value="active">⚔️ {t('conflictStatusActive') || 'Activo (En Conflicto)'}</option>
                            <option value="resolved">✅ {t('conflictStatusResolved') || 'Finalizado (Tregua / Resuelto)'}</option>
                        </select>
                    </div>
                </Modal>
            )}

            {/* Patrol Log Modal */}
            {activeModal === 'patrol' && (
                <Modal title={t('logPatrolTitle')} onClose={closeModal} onSubmit={handleSubmitPatrolLog} submitting={submitting}>
                    {/* Current Time Display */}
                    {patrolTime && (
                        <div style={{
                            background: 'rgba(212, 175, 55, 0.1)',
                            border: '1px solid var(--accent-gold)',
                            borderRadius: '4px',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Fecha y Hora Actual (redondeada)
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                {new Date(patrolTime).toLocaleString('es-ES', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>{t('patrolTimeLabel')}</label>
                        <input
                            type="datetime-local"
                            className="form-input"
                            value={patrolTime}
                            onChange={e => setPatrolTime(e.target.value)}
                            step="900"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('peopleCountLabel')}</label>
                        <input
                            type="number"
                            className="form-input"
                            value={patrolPeopleCount}
                            onChange={e => setPatrolPeopleCount(e.target.value)}
                            min="0"
                            required
                        />
                    </div>
                    <TextArea label={t('notesLabel') + ' (Opcional)'} value={patrolNotes} onChange={e => setPatrolNotes(e.target.value)} />
                    <ImageUpload label={t('mugshotPhotoLabel') + ' (Opcional)'} image={patrolPhoto} onUpload={e => handleImageUpload(e, setPatrolPhoto, true)} single />
                </Modal>
            )}

            {/* Patrol Logs Table Modal (Apple macOS Glassmorphic Window - Full Width 98vw) */}
            {activeModal === 'patrolTable' && (
                <div className="mac-modal-overlay" onClick={closeModal}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '98vw', width: '98vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={closeModal} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span>Control de Tiempos de Patrulla - Matriz de Actividad</span>
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                            {loadingActivity ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #eab308', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                    <span>Cargando matriz de patrullas...</span>
                                </div>
                            ) : (
                                <div>
                                    {patrolLogs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                            No hay registros de patrulla registrados para esta banda.
                                        </div>
                                    ) : (
                                        <PatrolMatrix logs={patrolLogs} onSelectLog={setSelectedLog} onDeleteLog={handleDeletePatrolLog} onViewImage={setExpandedImage} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Log Detail Modal (Apple macOS Glassmorphic Card) */}
            {selectedLog && (
                <div className="mac-modal-overlay" onClick={() => setSelectedLog(null)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setSelectedLog(null)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title" style={{ color: '#fef08a' }}>Detalle de Registro de Patrulla</span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>FECHA Y HORA REGISTRADA</span>
                                        <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>
                                            {new Date(selectedLog.patrol_time).toLocaleString('es-ES', {
                                                year: 'numeric', month: '2-digit', day: '2-digit',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1rem', textAlign: 'center' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>PERSONAS</span>
                                        <div style={{ fontSize: '1.4rem', color: '#eab308', fontWeight: 800 }}>{selectedLog.people_count}</div>
                                    </div>
                                </div>

                                {selectedLog.notes && (
                                    <div>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>NOTAS DE OBSERVACIÓN</span>
                                        <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                            {selectedLog.notes}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>REGISTRADO POR</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <img src={selectedLog.detective_avatar || '/logowebp/anon.webp'} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                        <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>{selectedLog.detective_rank} {selectedLog.detective_name}</span>
                                    </div>
                                </div>

                                {selectedLog.photo && (
                                    <div>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>EVIDENCIA / FOTO</span>
                                        <img
                                            src={selectedLog.photo}
                                            onClick={() => setExpandedImage(selectedLog.photo)}
                                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                                            alt="Patrol"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', background: 'rgba(15, 23, 42, 0.4)' }}>
                            {selectedLog.can_delete && (
                                <button
                                    className="mac-btn"
                                    onClick={() => { handleDeletePatrolLog(selectedLog.id); setSelectedLog(null); }}
                                    style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171' }}
                                >
                                    Eliminar Registro
                                </button>
                            )}
                            <button className="mac-btn mac-btn-secondary" onClick={() => setSelectedLog(null)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Activity View Modal (Apple macOS Dossier Window) */}
            {showActivity && (() => {
                const activeGang = gangs.find(g => g.gang_id === activeGangId) || {};
                const gangColor = activeGang.color || '#3b82f6';
                const cleanSearch = activitySearchQuery.trim().toLowerCase();

                const filteredList = activityLog.filter(item => {
                    if (!cleanSearch) return true;
                    if (activityType === 'incidents') {
                        return (
                            (item.title && item.title.toLowerCase().includes(cleanSearch)) ||
                            (item.description && item.description.toLowerCase().includes(cleanSearch)) ||
                            (item.tablet_incident_number && item.tablet_incident_number.toString().toLowerCase().includes(cleanSearch)) ||
                            (item.location && item.location.toLowerCase().includes(cleanSearch)) ||
                            (item.author_name && item.author_name.toLowerCase().includes(cleanSearch))
                        );
                    }
                    if (activityType === 'outings') {
                        return (
                            (item.title && item.title.toLowerCase().includes(cleanSearch)) ||
                            (item.reason && item.reason.toLowerCase().includes(cleanSearch)) ||
                            (item.info_obtained && item.info_obtained.toLowerCase().includes(cleanSearch)) ||
                            (item.tag && item.tag.toLowerCase().includes(cleanSearch)) ||
                            (item.author_name && item.author_name.toLowerCase().includes(cleanSearch)) ||
                            (item.detectives && item.detectives.some(d => d.name && d.name.toLowerCase().includes(cleanSearch)))
                        );
                    }
                    if (activityType === 'cases') {
                        return (
                            (item.title && item.title.toLowerCase().includes(cleanSearch)) ||
                            (item.case_number && item.case_number.toString().toLowerCase().includes(cleanSearch)) ||
                            (item.location && item.location.toLowerCase().includes(cleanSearch)) ||
                            (item.status && item.status.toLowerCase().includes(cleanSearch))
                        );
                    }
                    if (activityType === 'undercover') {
                        return (
                            (item.title && item.title.toLowerCase().includes(cleanSearch)) ||
                            (item.content && item.content.toLowerCase().includes(cleanSearch)) ||
                            (item.persona_name && item.persona_name.toLowerCase().includes(cleanSearch)) ||
                            (item.officer_name && item.officer_name.toLowerCase().includes(cleanSearch)) ||
                            (item.category && item.category.toLowerCase().includes(cleanSearch)) ||
                            (item.threat_level && item.threat_level.toLowerCase().includes(cleanSearch))
                        );
                    }
                    return true;
                });

                return (
                    <div className="mac-modal-overlay" onClick={closeModal} style={{ zIndex: 3500 }}>
                        <div 
                            className="mac-modal-card" 
                            onClick={e => e.stopPropagation()} 
                            style={{ 
                                maxWidth: '900px', 
                                width: '94vw', 
                                height: '88vh', 
                                maxHeight: '90vh',
                                display: 'flex', 
                                flexDirection: 'column',
                                background: 'rgba(15, 23, 42, 0.9)',
                                backdropFilter: 'blur(30px)',
                                WebkitBackdropFilter: 'blur(30px)',
                                borderRadius: '22px',
                                border: '1px solid rgba(255, 255, 255, 0.14)',
                                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 40px rgba(0,0,0,0.5)',
                                overflow: 'hidden'
                            }}
                        >
                            {/* macOS Window Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1.1rem 1.5rem',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                background: 'rgba(255, 255, 255, 0.02)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span 
                                        className="mac-window-dot close" 
                                        onClick={closeModal} 
                                        title="Cerrar ventana" 
                                        style={{ cursor: 'pointer', width: '12px', height: '12px' }} 
                                    />
                                    <span className="mac-window-dot min" style={{ width: '12px', height: '12px' }} />
                                    <span className="mac-window-dot max" style={{ width: '12px', height: '12px' }} />
                                </div>

                                {/* Center Gang Pill & Dossier Title */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '7px',
                                        padding: '4px 12px',
                                        borderRadius: '9999px',
                                        background: `${gangColor}22`,
                                        border: `1px solid ${gangColor}60`,
                                        color: gangColor,
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.02em',
                                        boxShadow: `0 0 15px ${gangColor}25`
                                    }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: gangColor, boxShadow: `0 0 8px ${gangColor}` }} />
                                        <span>{activeGang.name || 'Organización'}</span>
                                    </div>
                                    <span style={{ fontSize: '0.86rem', color: '#94a3b8', fontWeight: 600 }}>
                                        • Expediente de Inteligencia y Registros
                                    </span>
                                </div>

                                <div style={{ width: '60px', textAlign: 'right' }}>
                                    <button
                                        onClick={closeModal}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            color: '#94a3b8',
                                            fontSize: '0.82rem',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Cerrar"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Apple Segmented Bar (Tabs) */}
                            <div style={{
                                padding: '0.85rem 1.5rem',
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    padding: '4px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    gap: '3px'
                                }}>
                                    {/* Tab 1: Incidents */}
                                    <button
                                        onClick={() => handleViewActivity('incidents', activeGangId)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: activityType === 'incidents' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                                            color: activityType === 'incidents' ? '#38bdf8' : '#94a3b8',
                                            fontWeight: activityType === 'incidents' ? 700 : 500,
                                            fontSize: '0.84rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: activityType === 'incidents' ? '0 2px 10px rgba(56, 189, 248, 0.25)' : 'none'
                                        }}
                                    >
                                        <span>📁</span>
                                        <span>Informes e Incidentes</span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 7px',
                                            borderRadius: '9999px',
                                            background: activityType === 'incidents' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                                            color: activityType === 'incidents' ? '#0f172a' : '#cbd5e1',
                                            fontWeight: 800
                                        }}>
                                            {activeGang.incident_count || (activityType === 'incidents' ? activityLog.length : 0)}
                                        </span>
                                    </button>

                                    {/* Tab 2: Outings */}
                                    <button
                                        onClick={() => handleViewActivity('outings', activeGangId)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: activityType === 'outings' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                                            color: activityType === 'outings' ? '#fbbf24' : '#94a3b8',
                                            fontWeight: activityType === 'outings' ? 700 : 500,
                                            fontSize: '0.84rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: activityType === 'outings' ? '0 2px 10px rgba(245, 158, 11, 0.25)' : 'none'
                                        }}
                                    >
                                        <span>🚓</span>
                                        <span>Vigilancias y Salidas</span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 7px',
                                            borderRadius: '9999px',
                                            background: activityType === 'outings' ? '#fbbf24' : 'rgba(255, 255, 255, 0.1)',
                                            color: activityType === 'outings' ? '#0f172a' : '#cbd5e1',
                                            fontWeight: 800
                                        }}>
                                            {activeGang.outing_count || (activityType === 'outings' ? activityLog.length : 0)}
                                        </span>
                                    </button>

                                    {/* Tab 3: Cases */}
                                    <button
                                        onClick={() => handleViewActivity('cases', activeGangId)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: activityType === 'cases' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                            color: activityType === 'cases' ? '#34d399' : '#94a3b8',
                                            fontWeight: activityType === 'cases' ? 700 : 500,
                                            fontSize: '0.84rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: activityType === 'cases' ? '0 2px 10px rgba(16, 185, 129, 0.25)' : 'none'
                                        }}
                                    >
                                        <span>📂</span>
                                        <span>Casos Ligados</span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 7px',
                                            borderRadius: '9999px',
                                            background: activityType === 'cases' ? '#34d399' : 'rgba(255, 255, 255, 0.1)',
                                            color: activityType === 'cases' ? '#0f172a' : '#cbd5e1',
                                            fontWeight: 800
                                        }}>
                                            {activeGang.case_count || (activeGang.cases ? activeGang.cases.length : (activityType === 'cases' ? activityLog.length : 0))}
                                        </span>
                                    </button>

                                    {/* Tab 4: Undercover (UD) Intelligence */}
                                    <button
                                        onClick={() => handleViewActivity('undercover', activeGangId)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: activityType === 'undercover' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                                            color: activityType === 'undercover' ? '#c084fc' : '#94a3b8',
                                            fontWeight: activityType === 'undercover' ? 700 : 500,
                                            fontSize: '0.84rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: activityType === 'undercover' ? '0 2px 10px rgba(168, 85, 247, 0.3)' : 'none'
                                        }}
                                    >
                                        <span>🕶️</span>
                                        <span>Inteligencia UD</span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 7px',
                                            borderRadius: '9999px',
                                            background: activityType === 'undercover' ? '#c084fc' : 'rgba(255, 255, 255, 0.1)',
                                            color: activityType === 'undercover' ? '#0f172a' : '#cbd5e1',
                                            fontWeight: 800
                                        }}>
                                            {activeGang.undercover_count || (activeGang.undercover_intel ? activeGang.undercover_intel.length : (activityType === 'undercover' ? activityLog.length : 0))}
                                        </span>
                                    </button>
                                </div>

                                {/* Search Field */}
                                <div style={{ position: 'relative', width: '250px', maxWidth: '100%' }}>
                                    <input
                                        type="text"
                                        placeholder="Filtrar por texto, agente..."
                                        value={activitySearchQuery}
                                        onChange={(e) => setActivitySearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '0.45rem 2rem 0.45rem 0.85rem',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            border: '1px solid rgba(255, 255, 255, 0.14)',
                                            borderRadius: '10px',
                                            color: '#ffffff',
                                            fontSize: '0.8rem',
                                            outline: 'none'
                                        }}
                                    />
                                    {activitySearchQuery && (
                                        <button
                                            onClick={() => setActivitySearchQuery('')}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Scrollable Records Body */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                                {loadingActivity ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: '0.85rem' }}>
                                        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>Cargando registros de inteligencia...</span>
                                    </div>
                                ) : filteredList.length === 0 ? (
                                    <div style={{
                                        padding: '3.5rem 1.5rem',
                                        textAlign: 'center',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '18px',
                                        border: '1px dashed rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem', opacity: 0.85 }}>
                                            {activityType === 'incidents' ? '📁' : activityType === 'outings' ? '🚓' : '📂'}
                                        </div>
                                        <h4 style={{ margin: '0 0 0.4rem 0', color: '#ffffff', fontSize: '1.1rem', fontWeight: 700 }}>
                                            {cleanSearch ? 'No se encontraron coincidencias' : 'Sin registros vinculados'}
                                        </h4>
                                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.86rem', maxWidth: '420px', marginInline: 'auto', lineHeight: '1.5' }}>
                                            {cleanSearch 
                                                ? `No hay registros que coincidan con el término "${activitySearchQuery}".`
                                                : `No hay ${activityType === 'incidents' ? 'informes o incidentes' : activityType === 'outings' ? 'vigilancias operativas' : 'casos criminales'} vinculados a ${activeGang.name || 'este grupo'}.`}
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {filteredList.map(item => (
                                            activityType === 'incidents' ? (
                                                <IncidentCard
                                                    key={item.record_id || item.id}
                                                    data={item}
                                                    onExpand={setExpandedImage}
                                                    onDelete={null}
                                                    onEdit={null}
                                                />
                                            ) : activityType === 'cases' ? (
                                                <div
                                                    key={item.id}
                                                    onClick={() => { closeModal(); navigate(`/cases/${item.id}`); }}
                                                    style={{
                                                        padding: '1.1rem 1.3rem',
                                                        background: 'rgba(255, 255, 255, 0.035)',
                                                        border: '1px solid rgba(255, 255, 255, 0.09)',
                                                        borderLeft: `4px solid ${(!item.status || item.status.toLowerCase() === 'open' || item.status.toLowerCase() === 'abierto') ? '#10b981' : '#ef4444'}`,
                                                        borderRadius: '14px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        gap: '1rem'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                                                    }}
                                                >
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                                            <span style={{ color: 'var(--accent-gold, #f59e0b)', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.88rem' }}>
                                                                #{item.case_number || '---'}
                                                            </span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                                                                {item.title}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                            {item.location && <span>📍 {item.location}</span>}
                                                            {item.occurred_at && <span>🕒 {new Date(item.occurred_at).toLocaleDateString()}</span>}
                                                            {item.assigned_detective_name && <span>🛡️ {item.assigned_detective_name}</span>}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                                                        <span style={{
                                                            fontSize: '0.74rem',
                                                            fontWeight: 800,
                                                            color: (!item.status || item.status.toLowerCase() === 'open' || item.status.toLowerCase() === 'abierto') ? '#34d399' : '#f87171',
                                                            background: (!item.status || item.status.toLowerCase() === 'open' || item.status.toLowerCase() === 'abierto') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                            border: `1px solid ${(!item.status || item.status.toLowerCase() === 'open' || item.status.toLowerCase() === 'abierto') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                            padding: '0.32rem 0.7rem',
                                                            borderRadius: '6px'
                                                        }}>
                                                            {(!item.status || item.status.toLowerCase() === 'open' || item.status.toLowerCase() === 'abierto') ? 'ABIERTO' : item.status.toUpperCase()}
                                                        </span>
                                                        <span style={{ fontSize: '0.84rem', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            Ver Expediente ↗
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : activityType === 'undercover' ? (
                                                <div
                                                    key={item.id}
                                                    style={{
                                                        padding: '1.25rem',
                                                        background: 'rgba(15, 23, 42, 0.6)',
                                                        border: '1px solid rgba(168, 85, 247, 0.25)',
                                                        borderLeft: `4px solid ${
                                                            item.threat_level === 'CRÍTICO' ? '#ef4444' :
                                                            item.threat_level === 'ALTO' ? '#f97316' :
                                                            item.threat_level === 'MEDIO' ? '#f59e0b' : '#3b82f6'
                                                        }`,
                                                        borderRadius: '14px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.75rem',
                                                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: 800,
                                                                    background: 'rgba(168, 85, 247, 0.15)',
                                                                    color: '#c084fc',
                                                                    border: '1px solid rgba(168, 85, 247, 0.35)'
                                                                }}>
                                                                    🕶️ {item.category || 'INFORMACIÓN GENERAL'}
                                                                </span>
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: 800,
                                                                    background: item.threat_level === 'CRÍTICO' ? 'rgba(239, 68, 68, 0.2)' : item.threat_level === 'ALTO' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                                    color: item.threat_level === 'CRÍTICO' ? '#f87171' : item.threat_level === 'ALTO' ? '#fb923c' : '#fbbf24',
                                                                    border: `1px solid ${item.threat_level === 'CRÍTICO' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                                                                }}>
                                                                    AMENAZA {item.threat_level || 'MEDIO'}
                                                                </span>
                                                                {item.is_confidential && (
                                                                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 700 }}>
                                                                        🔒 CONFIDENCIAL UD
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '1.05rem', fontWeight: 700 }}>
                                                                {item.title}
                                                            </h4>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                                                                {item.persona_name && (
                                                                    <span style={{ color: '#c084fc', fontWeight: 600 }}>
                                                                        🎭 Identidad: {item.persona_name}
                                                                    </span>
                                                                )}
                                                                {item.officer_name && (
                                                                    <span>
                                                                        🛡️ {item.officer_rank ? `${item.officer_rank} ` : ''}{item.officer_name}
                                                                    </span>
                                                                )}
                                                                {item.created_at && (
                                                                    <span>
                                                                        📅 {new Date(item.created_at).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{
                                                        color: '#cbd5e1',
                                                        fontSize: '0.86rem',
                                                        lineHeight: '1.5',
                                                        whiteSpace: 'pre-line',
                                                        background: 'rgba(0, 0, 0, 0.25)',
                                                        padding: '0.85rem',
                                                        borderRadius: '8px',
                                                        border: '1px solid rgba(255, 255, 255, 0.05)'
                                                    }}>
                                                        {item.content}
                                                    </div>

                                                    {item.photos && item.photos.length > 0 && (
                                                        <div>
                                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>EVIDENCIA FOTOGRÁFICA / ARCHIVO:</span>
                                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                {item.photos.map((ph, phIdx) => (
                                                                    <img
                                                                        key={phIdx}
                                                                        src={ph}
                                                                        onClick={() => setExpandedImage(ph)}
                                                                        alt="Intel photo"
                                                                        style={{ width: '80px', height: '65px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', transition: 'transform 0.15s' }}
                                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <OutingCard
                                                    key={item.record_id || item.id}
                                                    data={item}
                                                    onExpand={setExpandedImage}
                                                    onDelete={null}
                                                />
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* macOS Modal Footer */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.9rem 1.5rem',
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                background: 'rgba(255, 255, 255, 0.02)'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                    Mostrando <strong style={{ color: '#ffffff' }}>{filteredList.length}</strong> {filteredList.length === 1 ? 'registro' : 'registros'}
                                </span>
                                <button
                                    onClick={closeModal}
                                    className="mac-btn mac-btn-secondary"
                                    style={{ padding: '0.45rem 1.2rem', fontSize: '0.84rem', borderRadius: '8px' }}
                                >
                                    Cerrar Ventana
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Image Viewer */}
            {expandedImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setExpandedImage(null)}>
                    <img src={expandedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} alt="Enlarged Evidence" />
                </div>
            )}

            {/* Member Profile Card (Ficha) */}
            {selectedMember && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleCloseMemberProfile}>
                    <div style={{
                        background: isLSSD 
                            ? 'linear-gradient(180deg, rgba(22, 54, 30, 0.95) 0%, rgba(18, 30, 21, 0.98) 100%)' 
                            : 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        border: isLSSD ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(212, 175, 55, 0.3)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <img
                                src={selectedMember.photo || '/logowebp/anon.webp'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedMember.photo) {
                                        setExpandedImage(selectedMember.photo);
                                    }
                                }}
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '12px',
                                    objectFit: 'cover',
                                    border: `3px solid ${getStatusColor(selectedMember.role, isLSSD)}`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    cursor: selectedMember.photo ? 'pointer' : 'default',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={e => selectedMember.photo && (e.currentTarget.style.transform = 'scale(1.05)')}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                alt={selectedMember.name}
                            />
                            <div style={{ flex: 1 }}>
                                <h2 style={{ color: selectedMember.role === 'Inactivo' ? '#ef4444' : (isLSSD ? '#4ade80' : 'var(--accent-gold)'), fontSize: '1.8rem', marginBottom: '0.5rem' }}>{selectedMember.name}</h2>
                                <div style={{
                                    display: 'inline-block',
                                    padding: '0.4rem 0.8rem',
                                    background: getStatusColor(selectedMember.role, isLSSD),
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: '#fff'
                                }}>
                                    {selectedMember.role}
                                </div>
                                {selectedMember.role === 'Inactivo' && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        marginLeft: '0.6rem',
                                        padding: '0.4rem 0.8rem',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.6)',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        color: '#ef4444',
                                        letterSpacing: '1px',
                                        textTransform: 'uppercase'
                                    }}>
                                        ⚫ INACTIVO
                                    </div>
                                )}
                                {selectedMember.status && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                                        Status: {selectedMember.status}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes Section */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: isLSSD ? '#4ade80' : 'var(--accent-gold)',
                                fontSize: '1.1rem',
                                fontWeight: '600'
                            }}>
                                📋 Intelligence Notes
                            </label>
                            <textarea
                                value={editingMemberNotes}
                                onChange={e => setEditingMemberNotes(e.target.value)}
                                placeholder="Add intelligence notes about this affiliate..."
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.95rem',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                className="login-button btn-secondary"
                                onClick={handleCloseMemberProfile}
                                style={{ width: 'auto', padding: '0.7rem 1.5rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                className="login-button"
                                onClick={handleSaveMemberNotes}
                                disabled={submitting}
                                style={{ width: 'auto', padding: '0.7rem 1.5rem' }}
                            >
                                {submitting ? 'Saving...' : '💾 Save Notes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN APPLE MAC OS WHITEBOARD MODAL */}
            {activeBoardGang && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    background: 'rgba(8, 9, 13, 0.96)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Apple macOS Traffic Light Window Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(15, 23, 42, 0.95)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                        userSelect: 'none'
                    }}>
                        {/* Traffic light buttons with macOS hover animation */}
                        <div className="mac-window-dots">
                            <div
                                className="mac-window-dot close"
                                onClick={() => setActiveBoardGang(null)}
                                title="Cerrar Pizarra (Esc)"
                            />
                            <div
                                className="mac-window-dot min"
                                onClick={() => setActiveBoardGang(null)}
                                title="Minimizar (Esc)"
                            />
                            <div
                                className="mac-window-dot max"
                                title="Pantalla Completa"
                            />
                        </div>

                        {/* Title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeBoardGang.color || 'var(--accent-gold)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <line x1="12" y1="17" x2="12" y2="22" />
                                <path d="M5 17h14v-2l-2-2V5h1V3H6v2h1v8l-2 2v2z" />
                            </svg>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                                Pizarra de Investigación: <span style={{ color: activeBoardGang.color || 'var(--accent-gold)' }}>{activeBoardGang.name}</span>
                            </span>
                        </div>

                        {/* Spacer for symmetry */}
                        <div style={{ width: '60px' }} />
                    </div>

                    {/* Canvas Container */}
                    <div style={{ flex: 1, width: '100%', height: 'calc(100vh - 48px)', position: 'relative', overflow: 'hidden' }}>
                        <CaseWhiteboard
                            gangId={activeBoardGang.gang_id}
                            isGang={true}
                            caseData={gangs.find(g => g.gang_id === activeBoardGang.gang_id) || activeBoardGang}
                        />
                    </div>
                </div>
            )}

        </div>
    );
}

// --- SUB-COMPONENTS ---

function GangColumn({ gang, searchQuery, onAdd, isVIP, onArchive, onDelete, onViewImage, onEdit, onDeleteSubItem, onViewActivity, onViewMemberProfile, onEditGangName, onViewGangBoard, onExportPDF, onToggleConflictStatus, onCopyGangInfo }) {
    const { t } = useLanguage();
    const { isLSSD } = useTheme();
    const navigate = useNavigate();
    // Helper for buttons
    const ActionButtons = ({ type, item }) => (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px', zIndex: 10, position: 'relative' }}>
            <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onEdit(type, gang.gang_id, item); }} 
                style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px', color: '#94a3b8' }} 
                title="Edit"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
            </button>
            <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDeleteSubItem(type, item.id); }} 
                style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px', color: '#f87171' }} 
                title="Delete"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
            </button>
        </div>
    );
    return (
        <div className="gang-column" id={`gang-col-${gang.gang_id}`}>

            {/* Header Card */}
            <div className="gang-header-card" style={{ borderTop: `4px solid ${gang.color}` }}>
                <div className="gang-header-top">
                    <h3 className="gang-title" style={{ color: gang.color }}>{gang.name}</h3>
                    <div className="gang-actions">
                        <button
                            className="gang-icon-btn"
                            onClick={() => onCopyGangInfo && onCopyGangInfo(gang)}
                            title="Copiar información de este grupo al portapapeles"
                            style={{ color: '#38bdf8' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                        </button>
                        <button
                            className="gang-board-btn"
                            onClick={() => onViewGangBoard(gang)}
                            title="Abrir Pizarra de Investigación"
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="17" x2="12" y2="22" />
                                <path d="M5 17h14l-1.5-6h2L18 3H6L4.5 11h2z" />
                            </svg>
                            <span>Pizarra</span>
                        </button>
                        {isVIP && (
                            <button
                                className="gang-icon-btn"
                                onClick={() => onEditGangName(gang.gang_id)}
                                title="Editar Nombre"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </button>
                        )}
                        {isVIP && (
                            <button className="gang-icon-btn" onClick={onArchive} title={gang.is_archived ? "Desarchivar" : "Archivar"}>
                                {gang.is_archived ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                )}
                            </button>
                        )}
                        {isVIP && (
                            <button className="gang-icon-btn delete" onClick={onDelete} title="Eliminar Permanentemente">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                {/* Detectives al cargo */}
                <div style={{ padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>{t('detectivesInCharge')}</span>
                    </div>
                    <div style={{ color: '#cbd5e1', fontWeight: '500' }}>
                        {gang.detective_in_charge_1_name || gang.detective_in_charge_2_name ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {gang.detective_in_charge_1_name && <div>• {gang.detective_in_charge_1_name}</div>}
                                {gang.detective_in_charge_2_name && <div>• {gang.detective_in_charge_2_name}</div>}
                            </div>
                        ) : (
                            <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.25)' }}>{t('noneSelected')}</span>
                        )}
                    </div>
                </div>


                <div className="gang-image-container" style={{ position: 'relative' }}>
                    {/* Edit Button for Map */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onAdd('updateZone', gang.gang_id); }}
                        style={{
                            position: 'absolute', top: 10, right: 10, zIndex: 10,
                            background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                            borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.78rem',
                            display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}
                    >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>{t('editMapBtnGangs')}</span>
                    </button>

                    <div onClick={() => gang.zones_image && onViewImage(gang.zones_image)} style={{ width: '100%', height: '100%', cursor: gang.zones_image ? 'pointer' : 'default' }}>
                        {gang.zones_image ? (
                            <img src={gang.zones_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Zones" />
                        ) : (
                            <div className="gang-image-empty">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                    <line x1="8" y1="2" x2="8" y2="18" />
                                    <line x1="16" y1="6" x2="16" y2="22" />
                                </svg>
                                <span>{t('noZoneData')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="gang-stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <StatBox label={t('gangIncidentsLabel')} count={gang.incident_count} onClick={() => onViewActivity('incidents', gang.gang_id)} />
                <StatBox label={t('gangOutingsLabel')} count={gang.outing_count} onClick={() => onViewActivity('outings', gang.gang_id)} />
                <StatBox label={t('gangCasesLabel') || 'Casos'} count={gang.case_count || (gang.cases ? gang.cases.length : 0)} onClick={() => onViewActivity('cases', gang.gang_id)} />
            </div>

            {/* Linked Cases Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>{t('linkedCasesToGang') || 'Casos Ligados'} ({(gang.cases || []).length})</span>
                    </span>
                    {(gang.cases || []).length > 0 && (
                        <button 
                            className="mac-btn mac-btn-secondary" 
                            style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}
                            onClick={() => onViewActivity('cases', gang.gang_id)}
                        >
                            {t('viewMatrixBtn') || 'Ver Todo'}
                        </button>
                    )}
                </div>
                <div className="gang-list-content">
                    {(gang.cases || []).map(c => {
                        const isCaseMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(c?.case_number, searchQuery) ||
                            safeStrMatch(c?.title, searchQuery) ||
                            safeStrMatch(c?.location, searchQuery)
                        );
                        const statusColors = {
                            open: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#ef4444' },
                            closed: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: '#10b981' },
                            archived: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: '#64748b' }
                        };
                        const sc = statusColors[c.status] || statusColors.open;
                        return (
                            <div 
                                key={c.id} 
                                onClick={() => navigate(`/cases/${c.id}`)}
                                className={`gang-list-item ${isCaseMatch ? 'search-highlight-item' : ''}`}
                                style={{ 
                                    flexDirection: 'column', 
                                    alignItems: 'flex-start', 
                                    borderLeft: `3px solid ${sc.border}`, 
                                    paddingLeft: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    marginBottom: '0.4rem',
                                    borderRadius: '0 6px 6px 0',
                                    padding: '0.5rem 0.8rem'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                                title="Abrir expediente del caso"
                            >
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--accent-gold, #f59e0b)', fontFamily: 'monospace', fontWeight: '700', fontSize: '0.8rem' }}>
                                        #{c.case_number}
                                    </span>
                                    <span style={{ 
                                        fontSize: '0.65rem', 
                                        padding: '1px 6px', 
                                        borderRadius: '4px', 
                                        backgroundColor: sc.bg, 
                                        color: sc.text, 
                                        fontWeight: '600', 
                                        textTransform: 'uppercase' 
                                    }}>
                                        {c.status === 'open' ? (t('statusOpen') || 'Abierto') : c.status === 'closed' ? (t('closed') || 'Cerrado') : (t('archived') || 'Archivado')}
                                    </span>
                                </div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.82rem', marginTop: '3px' }}>
                                    {c.title}
                                </div>
                                {(c.location || c.incident_date) && (
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {c.incident_date && <span>📅 {new Date(c.incident_date).toLocaleDateString()}</span>}
                                        {c.location && <span>📍 {c.location}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {(!gang.cases || gang.cases.length === 0) && (
                        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>
                            {t('noLinkedCasesGang') || 'Sin casos criminales vinculados'}
                        </div>
                    )}
                </div>
            </div>

            {/* Intel Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>{t('intelAndCharacteristics')}</span>
                    </span>
                    <button className="gang-add-btn" onClick={() => onAdd('info', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {gang.info && gang.info.map(i => {
                        const isInfoMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(i?.content, searchQuery)
                        );
                        return (
                            <div key={i.id} className={isInfoMatch ? 'search-highlight-item' : ''} style={{
                                fontSize: '0.85rem', marginBottom: '0.8rem',
                                borderLeft: `3px solid ${i.type === 'characteristic' ? 'var(--accent-gold)' : '#64748b'}`,
                                paddingLeft: '0.8rem', color: '#cbd5e1', position: 'relative',
                                padding: isInfoMatch ? '0.5rem 0.8rem' : '0 0 0 0.8rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1, marginRight: '10px' }}>{(i.content && i.content.trim()) ? i.content : <span style={{ fontStyle: 'italic', opacity: 0.5, color: '#f59e0b' }}>{t('emptyContentFix')}</span>}</div>
                                    <ActionButtons type="info" item={i} />
                                </div>
                                {i.images && i.images.length > 0 && (
                                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                        {i.images.map((img, idx) => (
                                            <img key={idx} src={img} onClick={() => onViewImage(img)} style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} alt="Intel" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {(!gang.info || gang.info.length === 0) && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>{t('noIntelGathered')}</div>}
                </div>
            </div>

            {/* Patrol Time Control Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{t('patrolTimeControl')}</span>
                    </span>
                </div>
                <div className="gang-list-content" style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <button
                            className="mac-btn mac-btn-primary"
                            onClick={() => onAdd('patrol', gang.gang_id)}
                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>{t('logPatrolBtn')}</span>
                        </button>
                        <button
                            className="mac-btn mac-btn-secondary"
                            onClick={() => onViewActivity('patrolTable', gang.gang_id)}
                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                            <span>{t('viewMatrixBtn')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Conflicts Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                        <span>{t('conflictsLabel') || 'Conflictos'} ({(gang.conflicts || []).length})</span>
                    </span>
                    <button className="gang-add-btn" onClick={() => onAdd('conflict', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {(gang.conflicts || []).map(c => {
                        const isResolved = c.status === 'resolved';
                        const isConflictMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(c?.target_gang_name, searchQuery) ||
                            safeStrMatch(c?.reason, searchQuery)
                        );
                        return (
                            <div 
                                key={c.id} 
                                className={`gang-list-item ${isConflictMatch ? 'search-highlight-item' : ''}`} 
                                style={{ 
                                    flexDirection: 'column', 
                                    alignItems: 'flex-start', 
                                    borderLeft: `3px solid ${isResolved ? '#10b981' : (c.target_gang_color || '#ef4444')}`, 
                                    paddingLeft: '0.8rem', 
                                    padding: isConflictMatch ? '0.5rem 0.8rem' : '0.4rem 0.8rem',
                                    background: isResolved ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                                    borderRadius: '0 6px 6px 0',
                                    marginBottom: '0.4rem',
                                    opacity: isResolved ? 0.85 : 1
                                }}
                            >
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                    {isResolved ? (
                                        <span style={{ 
                                            backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                                            border: '1px solid rgba(16, 185, 129, 0.4)', 
                                            color: '#34d399', 
                                            fontWeight: '700', 
                                            fontSize: '0.78rem', 
                                            padding: '2px 8px', 
                                            borderRadius: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            textDecoration: 'line-through'
                                        }}>
                                            ✓ {c.target_gang_name} <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 'normal', textDecoration: 'none' }}>({t('conflictStatusResolved') ? 'Finalizado' : 'Finalizado'})</span>
                                        </span>
                                    ) : (
                                        <span style={{ 
                                            backgroundColor: c.target_gang_color ? `${c.target_gang_color}22` : 'rgba(239, 68, 68, 0.15)', 
                                            border: `1px solid ${c.target_gang_color ? `${c.target_gang_color}88` : 'rgba(239, 68, 68, 0.4)'}`, 
                                            color: c.target_gang_color || '#f87171', 
                                            fontWeight: '700', 
                                            fontSize: '0.78rem', 
                                            padding: '2px 8px', 
                                            borderRadius: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            ⚡ {c.target_gang_name} <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 'normal' }}>({t('conflictStatusActive') ? 'Activo' : 'Activo'})</span>
                                        </span>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                        <button
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => { e.stopPropagation(); onToggleConflictStatus && onToggleConflictStatus(c.id, c.status); }}
                                            style={{
                                                background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                padding: '2px 6px',
                                                color: isResolved ? '#34d399' : '#fca5a5',
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                            }}
                                            title={isResolved ? (t('reopenConflictBtn') || 'Reabrir Conflicto') : (t('finishConflictBtn') || 'Dar por Finalizado')}
                                        >
                                            {isResolved ? `🔄 ${t('reopenConflictBtn') || 'Reabrir'}` : `✓ ${t('finishConflictBtn') || 'Finalizar'}`}
                                        </button>
                                        <ActionButtons type="conflict" item={c} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.76rem', color: isResolved ? '#94a3b8' : '#cbd5e1', marginTop: '5px', lineHeight: '1.4', textDecoration: isResolved ? 'line-through' : 'none' }}>
                                    <span style={{ color: '#94a3b8', fontWeight: '600' }}>Motivo:</span> {c.reason || 'Desconocido'}
                                </div>
                            </div>
                        );
                    })}
                    {(!gang.conflicts || gang.conflicts.length === 0) && (
                        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>
                            {t('noKnownConflicts') || 'Sin conflictos registrados'}
                        </div>
                    )}
                </div>
            </div>

            {/* Vehicles Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="3" width="15" height="13" rx="2" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                        <span>{t('fleetLabel')} ({gang.vehicles.length})</span>
                    </span>
                    <button className="gang-add-btn" onClick={() => onAdd('vehicle', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {gang.vehicles.map(v => {
                        const isVehMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(v?.model, searchQuery) ||
                            safeStrMatch(v?.plate, searchQuery) ||
                            safeStrMatch(v?.owner, searchQuery) ||
                            safeStrMatch(v?.notes, searchQuery)
                        );
                        return (
                            <div key={v.id} className={`gang-list-item ${isVehMatch ? 'search-highlight-item' : ''}`} style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: '3px solid var(--color-blue)', paddingLeft: '0.8rem', padding: isVehMatch ? '0.5rem 0.8rem' : undefined }}>
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{(v.model && v.model.trim()) ? v.model : <span style={{ fontStyle: 'italic', opacity: 0.5, fontWeight: 'normal', color: '#f59e0b' }}>{t('unknownModel')}</span>}</span>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--accent-gold)', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>[{v.plate}]</span>
                                        <ActionButtons type="vehicle" item={v} />
                                    </div>
                                </div>
                                {v.owner && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>{t('ownerLabelText')} {v.owner}</div>}
                                {v.notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '5px', fontStyle: 'italic' }}>{v.notes}</div>}
                                {v.images && v.images.length > 0 && (
                                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                        {v.images.map((img, idx) => (
                                            <img key={idx} src={img} onClick={() => onViewImage(img)} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} alt="Car" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {gang.vehicles.length === 0 && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>{t('noKnownVehicles')}</div>}
                </div>
            </div>

            {/* Homes Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span>{t('propertiesLabel')} ({gang.homes.length})</span>
                    </span>
                    <button className="gang-add-btn" onClick={() => onAdd('home', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {gang.homes.map(h => {
                        const isHomeMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(h?.owner, searchQuery) ||
                            safeStrMatch(h?.notes, searchQuery) ||
                            safeStrMatch(h?.location, searchQuery)
                        );
                        return (
                            <div key={h.id} className={`gang-list-item ${isHomeMatch ? 'search-highlight-item' : ''}`} style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: '3px solid #10b981', paddingLeft: '0.8rem', padding: isHomeMatch ? '0.5rem 0.8rem' : undefined }}>
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                                    <span>{(h.owner && h.owner.trim()) ? h.owner : <span style={{ fontStyle: 'italic', opacity: 0.5, color: '#f59e0b' }}>{t('unknownOwner')}</span>}</span>
                                    <ActionButtons type="home" item={h} />
                                </div>
                                {h.notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '5px', fontStyle: 'italic' }}>{h.notes}</div>}
                                {h.images && h.images.length > 0 && (
                                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                        {h.images.map((img, idx) => (
                                            <img key={idx} src={img} onClick={() => onViewImage(img)} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} alt="Home" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {gang.homes.length === 0 && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>{t('noKnownProperties')}</div>}
                </div>
            </div>

            {/* Graffiti Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                        </svg>
                        <span>{t('graffitisLabel')} ({(gang.graffiti || []).length})</span>
                    </span>
                    <button className="gang-add-btn" onClick={() => onAdd('graffiti', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {(gang.graffiti || []).map(g => {
                        const isGraffitiMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(g?.notes, searchQuery) ||
                            safeStrMatch(g?.location, searchQuery)
                        );
                        return (
                            <div key={g.id} className={`gang-list-item ${isGraffitiMatch ? 'search-highlight-item' : ''}`} style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: '3px solid #a855f7', paddingLeft: '0.8rem', padding: isGraffitiMatch ? '0.5rem 0.8rem' : undefined }}>
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.8rem' }}>
                                        {g.notes ? g.notes : <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('noNotes')}</span>}
                                    </span>
                                    <ActionButtons type="graffiti" item={g} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', width: '100%' }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{t('graffitiImageLabel')}</span>
                                        {g.graffiti_image ? (
                                            <img 
                                                src={g.graffiti_image} 
                                                onClick={() => onViewImage(g.graffiti_image)} 
                                                style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} 
                                                alt="Graffiti" 
                                            />
                                        ) : (
                                            <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#ef4444' }}>No image</div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{t('gpsImageLabel')}</span>
                                        {g.gps_image ? (
                                            <img 
                                                src={g.gps_image} 
                                                onClick={() => onViewImage(g.gps_image)} 
                                                style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} 
                                                alt="GPS Location" 
                                            />
                                        ) : (
                                            <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#ef4444' }}>No image</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {(!gang.graffiti || gang.graffiti.length === 0) && (
                        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>
                            {t('noGraffitis')}
                        </div>
                    )}
                </div>
            </div>

            {/* Members Section */}
            <div className="gang-section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>{t('knownAffiliatesLabel')} ({gang.members.length})</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button 
                            className="mac-btn mac-btn-secondary" 
                            style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => onCopyGangInfo && onCopyGangInfo(gang)}
                            title="Copiar lista de miembros de este grupo"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copiar</span>
                        </button>
                        <button className="gang-add-btn" onClick={() => onAdd('member', gang.gang_id)}>+</button>
                    </div>
                </div>
                <div className="gang-member-grid">
                    {[...gang.members]
                        .sort((a, b) => {
                            const aInactive = a.role === 'Inactivo';
                            const bInactive = b.role === 'Inactivo';
                            if (aInactive && !bInactive) return 1;
                            if (!aInactive && bInactive) return -1;
                            return 0;
                        })
                        .map(m => {
                            const isMemMatch = searchQuery && searchQuery.trim() !== '' && (
                                safeStrMatch(m?.name, searchQuery) ||
                                safeStrMatch(m?.role, searchQuery) ||
                                safeStrMatch(m?.notes, searchQuery) ||
                                safeStrMatch(m?.dni || m?.citizen_id || m?.member_id, searchQuery)
                            );
                            return (
                                <div
                                    key={m.id}
                                    className={`gang-member-item ${isMemMatch ? 'search-highlight-item' : ''}`}
                                    onClick={() => onViewMemberProfile(m, gang.gang_id)}
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        padding: '0.4rem',
                                        borderRadius: '8px',
                                        ...(m.role === 'Inactivo' && !isMemMatch ? {
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            border: '1px solid rgba(239, 68, 68, 0.35)',
                                            opacity: 0.75
                                        } : {})
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                        e.currentTarget.style.boxShadow = m.role === 'Inactivo'
                                            ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                                            : '0 4px 12px rgba(212, 175, 55, 0.3)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ position: 'relative', display: 'inline-block', width: '60px', height: '60px', margin: '0 auto' }}>
                                        <img
                                            src={m.photo || '/logowebp/anon.webp'}
                                            className="gang-member-photo"
                                            style={{ border: `2px solid ${getStatusColor(m.role, isLSSD)}`, width: '100%', height: '100%', filter: m.role === 'Inactivo' ? 'grayscale(30%)' : 'none' }}
                                            alt=""
                                        />
                                        {m.role === 'Inactivo' && (
                                            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: '50%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <line x1="15" y1="15" x2="85" y2="85" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" opacity="0.9" />
                                                <line x1="85" y1="15" x2="15" y2="85" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" opacity="0.9" />
                                            </svg>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        color: m.role === 'Inactivo' ? '#ef4444' : '#94a3b8',
                                        fontWeight: m.role === 'Inactivo' ? '600' : '400'
                                    }}>{m.role}</div>
                                    {m.role === 'Inactivo' && (
                                        <div style={{
                                            fontSize: '0.55rem',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.5)',
                                            borderRadius: '4px',
                                            padding: '1px 5px',
                                            marginTop: '2px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            fontWeight: '700'
                                        }}>INACTIVO</div>
                                    )}
                                    {m.notes && (
                                        <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '3px', fontStyle: 'italic', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }} title={m.notes}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            <span>{t('hasNotes')}</span>
                                        </div>
                                    )}
                                    <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '5px' }} onClick={e => e.stopPropagation()}>
                                        <button onClick={() => onEdit('member', gang.gang_id, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', opacity: 0.85 }} title="Edit">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => onDeleteSubItem('member', m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', opacity: 0.85 }} title="Delete">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    {gang.members.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>{t('noKnownMembers')}</div>}
                </div>
            </div>

            {/* Media de Actividad por Día de la Semana (Bottom of column) */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{t('weeklyActivityPattern') || 'Media de Actividad por Día'}</span>
                    </span>
                    {gang.weekly_activity?.totalIncidents > 0 && (
                        <button 
                            className="mac-btn mac-btn-secondary" 
                            style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px' }}
                            onClick={() => onViewActivity('incidents', gang.gang_id)}
                            title="Ver informes del grupo"
                        >
                            {gang.weekly_activity.totalIncidents} {gang.weekly_activity.totalIncidents === 1 ? 'informe' : 'informes'}
                        </button>
                    )}
                </div>
                <div className="gang-list-content" style={{ padding: '0.55rem 0.75rem' }}>
                    {(!gang.weekly_activity || gang.weekly_activity.totalIncidents === 0) ? (
                        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.78rem', padding: '0.75rem 0.5rem' }}>
                            <div style={{ opacity: 0.5, fontSize: '1.1rem', marginBottom: '0.15rem' }}>📅</div>
                            <div>{t('noIncidentActivity') || 'Sin informes para calcular la media de actividad semanal'}</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {/* Highlight Peak Summary Banner */}
                            {gang.weekly_activity.peakDay && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.4rem 0.6rem',
                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(245, 158, 11, 0.04))',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '7px',
                                    marginBottom: '0.15rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '0.85rem' }}>🔥</span>
                                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fbbf24' }}>
                                            {t('peakActivityDay') || 'Mayor Actividad'}:
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ffffff' }}>
                                            {gang.weekly_activity.peakDay.label}
                                        </span>
                                    </div>
                                    <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: '800',
                                        color: '#fbbf24',
                                        background: 'rgba(245, 158, 11, 0.22)',
                                        padding: '1px 6px',
                                        borderRadius: '9999px',
                                        border: '1px solid rgba(245, 158, 11, 0.35)'
                                    }}>
                                        {gang.weekly_activity.peakDay.count} inf. ({gang.weekly_activity.peakDay.formattedPercentage}%)
                                    </span>
                                </div>
                            )}

                            {/* Ranked Days Breakdown (1º al 7º de mayor a menor actividad) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                                {gang.weekly_activity.sortedDays.map((d, rankIdx) => {
                                    const isTop1 = rankIdx === 0 && d.count > 0;
                                    const isTop2 = rankIdx === 1 && d.count > 0;
                                    const isTop3 = rankIdx === 2 && d.count > 0;
                                    const rankBadgeColor = isTop1 ? '#f59e0b' : isTop2 ? '#cbd5e1' : isTop3 ? '#cd7f32' : '#64748b';
                                    const rankBadgeBg = isTop1 ? 'rgba(245, 158, 11, 0.2)' : isTop2 ? 'rgba(203, 213, 225, 0.15)' : isTop3 ? 'rgba(205, 127, 50, 0.15)' : 'rgba(255, 255, 255, 0.04)';
                                    const barFillPercent = gang.weekly_activity.maxDayCount > 0 ? (d.count / gang.weekly_activity.maxDayCount) * 100 : 0;

                                    return (
                                        <div
                                            key={d.key}
                                            onClick={() => onViewActivity('incidents', gang.gang_id)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                                padding: '0.3rem 0.45rem',
                                                borderRadius: '5px',
                                                background: isTop1 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                                                border: isTop1 ? '1px solid rgba(245, 158, 11, 0.18)' : '1px solid rgba(255, 255, 255, 0.04)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = isTop1 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)';
                                            }}
                                            title={`${d.label}: ${d.count} informes (${d.formattedPercentage}% de los incidentes)`}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{
                                                        fontSize: '0.62rem',
                                                        fontWeight: '800',
                                                        color: rankBadgeColor,
                                                        background: rankBadgeBg,
                                                        width: '17px',
                                                        height: '17px',
                                                        borderRadius: '4px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {rankIdx + 1}º
                                                    </span>
                                                    <span style={{ fontWeight: isTop1 ? '700' : '500', color: d.count > 0 ? '#f1f5f9' : '#64748b' }}>
                                                        {d.label}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem' }}>
                                                    <span style={{ fontWeight: '700', color: d.count > 0 ? (isTop1 ? '#fbbf24' : '#38bdf8') : '#64748b' }}>
                                                        {d.count} inf.
                                                    </span>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.64rem', fontFamily: 'monospace' }}>
                                                        ({d.formattedPercentage}%)
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Bar Track & Fill */}
                                            <div style={{
                                                width: '100%',
                                                height: '3.5px',
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                borderRadius: '9999px',
                                                overflow: 'hidden',
                                                marginTop: '2px'
                                            }}>
                                                <div style={{
                                                    width: `${barFillPercent}%`,
                                                    height: '100%',
                                                    background: isTop1
                                                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                                        : d.count > 0
                                                            ? 'linear-gradient(90deg, #0284c7, #38bdf8)'
                                                            : 'transparent',
                                                    borderRadius: '9999px',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Undercover Division (UD) Intelligence Section (At bottom of column) */}
            <div className="gang-section-card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                <div className="gang-section-header" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12), transparent)' }}>
                    <span className="gang-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#c084fc' }}>
                        <span>🕶️</span>
                        <span>Inteligencia Encubierta (UD) ({(gang.undercover_intel || []).length})</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                            className="mac-btn mac-btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', borderColor: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' }}
                            onClick={() => onViewActivity('undercover', gang.gang_id)}
                            title="Ver todo el dossier de inteligencia encubierta"
                        >
                            Ver Todo
                        </button>
                        <button
                            className="gang-add-btn"
                            style={{ background: 'rgba(168, 85, 247, 0.25)', borderColor: 'rgba(168, 85, 247, 0.5)', color: '#e9d5ff' }}
                            onClick={() => navigate('/undercover')}
                            title="Ir a Undercover Division para redactar nuevo informe"
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="gang-list-content">
                    {(gang.undercover_intel || []).slice(0, 3).map(intel => {
                        const isIntelMatch = searchQuery && searchQuery.trim() !== '' && (
                            safeStrMatch(intel?.title, searchQuery) ||
                            safeStrMatch(intel?.content, searchQuery) ||
                            safeStrMatch(intel?.persona_name, searchQuery) ||
                            safeStrMatch(intel?.officer_name, searchQuery)
                        );
                        return (
                            <div
                                key={intel.id}
                                onClick={() => onViewActivity('undercover', gang.gang_id)}
                                className={`gang-list-item ${isIntelMatch ? 'search-highlight-item' : ''}`}
                                style={{
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    borderLeft: `3px solid ${
                                        intel.threat_level === 'CRÍTICO' ? '#ef4444' :
                                        intel.threat_level === 'ALTO' ? '#f97316' :
                                        intel.threat_level === 'MEDIO' ? '#f59e0b' : '#a855f7'
                                    }`,
                                    paddingLeft: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: 'rgba(168, 85, 247, 0.04)',
                                    marginBottom: '0.4rem',
                                    borderRadius: '0 6px 6px 0',
                                    padding: '0.5rem 0.8rem'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.04)'; }}
                                title="Click para abrir en el visor de inteligencia"
                            >
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.82rem' }}>
                                        {intel.title}
                                    </span>
                                    <span style={{
                                        fontSize: '0.62rem',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        background: intel.threat_level === 'CRÍTICO' ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.2)',
                                        color: intel.threat_level === 'CRÍTICO' ? '#f87171' : '#c084fc',
                                        fontWeight: '700'
                                    }}>
                                        {intel.threat_level || 'MEDIO'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3' }}>
                                    {intel.content}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {intel.persona_name && <span style={{ color: '#c084fc' }}>🎭 {intel.persona_name}</span>}
                                    {intel.category && <span>🏷️ {intel.category}</span>}
                                </div>
                            </div>
                        );
                    })}
                    {(!gang.undercover_intel || gang.undercover_intel.length === 0) && (
                        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>
                            Sin reportes de agentes encubiertos
                        </div>
                    )}
                </div>
            </div>

            {/* Footer action to export full criminal organization summary PDF */}
            <div style={{ marginTop: '0.8rem', marginBottom: '0.4rem', padding: '0.2rem 0.2rem' }}>
                <button
                    className="mac-btn"
                    onClick={() => onExportPDF(gang)}
                    title="Sacar e imprimir resumen de la organización criminal en PDF"
                    style={{
                        width: '100%',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '0.4rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isLSSD
                            ? 'rgba(6, 78, 59, 0.7)'
                            : 'rgba(30, 58, 138, 0.7)';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = isLSSD ? '#10b981' : '#60a5fa';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>Sacar resumen de la organización criminal</span>
                </button>
            </div>

        </div>
    );
}

// --- FORM COMPONENTS ---

function ColorPicker({ label, value, onChange }) {
    return (
        <div className="form-group">
            <label>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    position: 'relative',
                    width: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    backgroundColor: value,
                    border: '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    <input
                        type="color"
                        value={value}
                        onChange={onChange}
                        style={{
                            opacity: 0,
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'pointer'
                        }}
                    />
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={onChange}
                    className="form-input"
                    style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '1px' }}
                    placeholder="#RRGGBB"
                />
            </div>
        </div>
    );
}

function Modal({ title, onClose, onSubmit, submitting, children }) {
    return (
        <div className="mac-modal-overlay">
            <div className="mac-modal-card" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="mac-modal-header">
                    <div className="mac-window-dots">
                        <div className="mac-window-dot close" onClick={onClose}></div>
                        <div className="mac-window-dot min"></div>
                        <div className="mac-window-dot max"></div>
                    </div>
                    <span className="mac-modal-title">{title}</span>
                    <div style={{ width: 52 }} />
                </div>
                <div className="mac-modal-body">
                    <form onSubmit={onSubmit}>
                        {children}
                        <div className="mac-modal-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button type="button" className="mac-btn mac-btn-secondary" onClick={onClose}>Cancelar</button>
                            <button type="submit" className="mac-btn mac-btn-primary" disabled={submitting}>
                                {submitting ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function Input({ label, ...props }) {
    return (
        <div className="mac-form-group" style={{ marginBottom: '0.85rem' }}>
            {label && <label className="mac-form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>}
            <input className="mac-form-input" style={{ width: '100%' }} {...props} />
        </div>
    );
}

function TextArea({ label, ...props }) {
    return (
        <div className="mac-form-group" style={{ marginBottom: '0.85rem' }}>
            {label && <label className="mac-form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>}
            <textarea className="mac-form-textarea" rows="3" style={{ width: '100%' }} {...props} />
        </div>
    );
}

function ImageUpload({ label, onUpload, image, single }) {
    return (
        <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>{label}</label>
            <label className="login-button btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', height: '50px', borderStyle: 'dashed' }}>
                📷 Upload Image
                <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
            </label>
            {image && <img src={image} style={{ marginTop: '10px', width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} alt="" />}
        </div>
    );
}

function MultiImageUpload({ images, setImages, onUpload }) {
    return (
        <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Images (Optional)</label>
            <label className="login-button btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', height: '50px', borderStyle: 'dashed' }}>
                📷 Upload Images
                <input type="file" multiple accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {images.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                        <img src={src} style={{ height: '70px', borderRadius: '4px', border: '1px solid #444' }} alt="" />
                        <button
                            type="button"
                            onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatBox({ label, count, onClick }) {
    return (
        <div className="gang-stat-box" onClick={onClick} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>{count || 0}</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>{label}</div>
        </div>
    );
}

function getStatusColor(role, isLSSD = false) {
    if (role === 'Inactivo') return '#7f1d1d'; // dark red for Inactivo regardless of theme
    if (isLSSD) {
        if (role === 'Lider') return '#15803d'; // green-700
        if (role === 'Sublider') return '#16a34a'; // green-600
        if (role === 'Miembro') return '#22c55e'; // green-500
        return '#86efac'; // green-300
    }
    if (role === 'Lider') return '#ef4444';
    if (role === 'Sublider') return '#f97316';
    if (role === 'Miembro') return '#eab308';
    return '#94a3b8';
}

// Patrol Matrix Component - Calendar-style view
function PatrolMatrix({ logs, onSelectLog }) {
    const [showAnalytics, setShowAnalytics] = useState(false);
    // Organize logs by date and time
    const matrix = {};
    const hours = [];

    // Helper to round any date/time to nearest 15 minutes slot (:00, :15, :30, :45)
    const roundToQuarterHour = (dateInput) => {
        const d = new Date(dateInput);
        const minutes = d.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        d.setMinutes(roundedMinutes);
        d.setSeconds(0);
        d.setMilliseconds(0);
        return d;
    };

    // Generate hour slots starting from 18:00 to 17:45 (wrapping around midnight)
    // This reflects typical gang activity patterns (evening to late afternoon)
    for (let h = 18; h < 42; h++) { // 18 to 41 (wraps to 0-17)
        for (let m = 0; m < 60; m += 15) {
            const actualHour = h % 24; // Wrap around after 23
            hours.push(`${String(actualHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }

    // Organize logs into matrix structure
    logs.forEach(log => {
        const roundedDate = roundToQuarterHour(log.patrol_time);
        const dateKey = roundedDate.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeKey = `${String(roundedDate.getHours()).padStart(2, '0')}:${String(roundedDate.getMinutes()).padStart(2, '0')}`;

        if (!matrix[dateKey]) matrix[dateKey] = {};

        const existingLog = matrix[dateKey][timeKey];
        // Si dos personas rellenan el mismo cuadrante, mostramos el registro con mayor cantidad de personas
        if (!existingLog || (Number(log.people_count) || 0) > (Number(existingLog.people_count) || 0)) {
            matrix[dateKey][timeKey] = log;
        }
    });

    const dates = Object.keys(matrix).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/');
        const [dayB, monthB, yearB] = b.split('/');
        return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
    });

    // Calculate Best Hours for a Raid based on total accumulated gang presence and recurrence
    const topHoursStats = useMemo(() => {
        if (!logs || logs.length === 0) return [];

        const statsByHour = {};
        for (let h = 0; h < 24; h++) {
            statsByHour[h] = {
                hour: h,
                timeLabel: `${String(h).padStart(2, '0')}:00 - ${String((h + 1) % 24).padStart(2, '0')}:00`,
                shortLabel: `${String(h).padStart(2, '0')}:00`,
                totalPeople: 0,
                logCount: 0,
                maxPeople: 0
            };
        }

        logs.forEach(log => {
            if (!log.patrol_time) return;
            const d = new Date(log.patrol_time);
            const h = d.getHours();
            const count = Number(log.people_count) || 0;
            statsByHour[h].totalPeople += count;
            statsByHour[h].logCount += 1;
            if (count > statsByHour[h].maxPeople) {
                statsByHour[h].maxPeople = count;
            }
        });

        // Rank primarily by total accumulated people seen in that hour (real presence volume)
        // and secondarily by number of active patrols (consistency)
        const activeHours = Object.values(statsByHour)
            .filter(st => st.logCount > 0 && st.totalPeople > 0)
            .map(st => ({
                ...st,
                avgPeople: Number((st.totalPeople / st.logCount).toFixed(1))
            }))
            .sort((a, b) => {
                if (b.totalPeople !== a.totalPeople) return b.totalPeople - a.totalPeople;
                if (b.logCount !== a.logCount) return b.logCount - a.logCount;
                return b.maxPeople - a.maxPeople;
            });

        return activeHours.slice(0, 5);
    }, [logs]);

    const rankStyles = [
        {
            badgeBg: 'linear-gradient(135deg, #eab308, #ca8a04)',
            badgeColor: '#000',
            borderColor: 'rgba(234, 179, 8, 0.45)',
            bgColor: 'rgba(234, 179, 8, 0.1)',
            textColor: '#fef08a',
            glow: '0 0 16px rgba(234, 179, 8, 0.2)',
            icon: '🥇'
        },
        {
            badgeBg: 'linear-gradient(135deg, #94a3b8, #64748b)',
            badgeColor: '#000',
            borderColor: 'rgba(148, 163, 184, 0.45)',
            bgColor: 'rgba(148, 163, 184, 0.1)',
            textColor: '#e2e8f0',
            glow: '0 0 16px rgba(148, 163, 184, 0.15)',
            icon: '🥈'
        },
        {
            badgeBg: 'linear-gradient(135deg, #d97706, #b45309)',
            badgeColor: '#fff',
            borderColor: 'rgba(217, 119, 6, 0.45)',
            bgColor: 'rgba(217, 119, 6, 0.1)',
            textColor: '#fed7aa',
            glow: '0 0 16px rgba(217, 119, 6, 0.15)',
            icon: '🥉'
        },
        {
            badgeBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
            badgeColor: '#fff',
            borderColor: 'rgba(56, 189, 248, 0.45)',
            bgColor: 'rgba(56, 189, 248, 0.1)',
            textColor: '#bae6fd',
            glow: '0 0 16px rgba(56, 189, 248, 0.15)',
            icon: '⚡'
        },
        {
            badgeBg: 'linear-gradient(135deg, #9333ea, #7e22ce)',
            badgeColor: '#fff',
            borderColor: 'rgba(168, 85, 247, 0.45)',
            bgColor: 'rgba(168, 85, 247, 0.1)',
            textColor: '#e9d5ff',
            glow: '0 0 16px rgba(168, 85, 247, 0.15)',
            icon: '📍'
        }
    ];

    const bestRaidHour = topHoursStats[0];

    return (
        <>
            {/* Header Control & Legend Bar */}
            <div style={{
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.65rem 1rem',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)'
            }}>
                {/* Legend */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    fontSize: '0.78rem'
                }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Escala:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}>
                        <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></div>
                        <span>1-2 pers.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}>
                        <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '3px' }}></div>
                        <span>3-5 pers.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}>
                        <div style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></div>
                        <span>6-10 pers.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}>
                        <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></div>
                        <span>11+ pers.</span>
                    </div>
                </div>

                {/* Toggle Button for Raid Analytics */}
                {topHoursStats.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAnalytics(prev => !prev)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            background: showAnalytics ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'rgba(234, 179, 8, 0.12)',
                            border: `1px solid ${showAnalytics ? '#eab308' : 'rgba(234, 179, 8, 0.35)'}`,
                            color: showAnalytics ? '#000' : '#fef08a',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: showAnalytics ? '0 0 12px rgba(234, 179, 8, 0.3)' : 'none'
                        }}
                    >
                        <span>🎯</span>
                        <span>{showAnalytics ? 'Ocultar Análisis de Redada' : 'Mejor Hora para Redada'}</span>
                        {!showAnalytics && bestRaidHour && (
                            <span style={{
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: '#eab308',
                                color: '#000',
                                fontWeight: 800,
                                fontSize: '0.72rem'
                            }}>
                                {bestRaidHour.shortLabel}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Collapsible Tactical Intelligence / Raid Advisory Card */}
            {showAnalytics && topHoursStats.length > 0 && (
                <div style={{
                    marginBottom: '1.25rem',
                    padding: '1.15rem 1.35rem',
                    background: 'rgba(15, 23, 42, 0.85)',
                    borderRadius: '14px',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    animation: 'fadeIn 0.25s ease'
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.3), rgba(234, 179, 8, 0.1))',
                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#eab308',
                                fontSize: '1.1rem'
                            }}>
                                🎯
                            </div>
                            <div>
                                <div style={{ color: '#fef08a', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>Inteligencia de Horarios para Redadas y Operativos</span>
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                    Momento del día donde más presencia y miembros se suelen concentrar en el barrio según el historial de patrullas
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Registros analizados: <strong style={{ color: '#e2e8f0' }}>{logs.length}</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAnalytics(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    padding: '0.2rem 0.4rem',
                                    borderRadius: '4px'
                                }}
                                title="Cerrar panel"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Operational Recommendation Highlight */}
                    {bestRaidHour && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            marginBottom: '1rem',
                            borderRadius: '8px',
                            background: 'rgba(234, 179, 8, 0.08)',
                            border: '1px solid rgba(234, 179, 8, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.6rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                                <span style={{ color: '#eab308', fontWeight: 800 }}>⚡ Momento Óptimo Recomendado:</span>
                                <span style={{ fontWeight: 800, background: '#eab308', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                                    {bestRaidHour.timeLabel}
                                </span>
                                <span style={{ color: '#cbd5e1' }}>
                                    — Mayor volumen registrado: <strong>{bestRaidHour.totalPeople} personas</strong> avistadas en <strong>{bestRaidHour.logCount} patrullas</strong> (pico de {bestRaidHour.maxPeople}).
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Top 5 Cards Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '0.75rem'
                    }}>
                        {topHoursStats.map((st, idx) => {
                            const style = rankStyles[idx] || rankStyles[4];
                            return (
                                <div
                                    key={st.hour}
                                    style={{
                                        padding: '0.85rem 1rem',
                                        borderRadius: '10px',
                                        background: style.bgColor,
                                        border: `1px solid ${style.borderColor}`,
                                        boxShadow: style.glow,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem',
                                        transition: 'all 0.2s ease',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '6px',
                                            background: style.badgeBg,
                                            color: style.badgeColor,
                                            fontWeight: 900,
                                            fontSize: '0.7rem',
                                            letterSpacing: '0.04em'
                                        }}>
                                            {style.icon} #{idx + 1}
                                        </span>
                                        <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.03em' }}>
                                            {st.shortLabel}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: style.textColor, lineHeight: 1 }}>
                                            {st.totalPeople}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                            pers. registradas
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                                        <span>📋 {st.logCount} {st.logCount === 1 ? 'patrulla' : 'patrullas'}</span>
                                        <span style={{ color: '#cbd5e1' }}>Pico: <strong style={{ color: style.textColor }}>{st.maxPeople}</strong></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Table Container with Custom Scrollbar */}
            <div style={{
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: '76vh',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(9, 13, 22, 0.8)',
                padding: '0.25rem',
                scrollbarWidth: 'thin',
                scrollbarColor: '#eab308 rgba(255,255,255,0.05)'
            }}
                className="patrol-matrix-scroll"
            >
                <style>{`
                    .patrol-matrix-scroll::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                    }
                    .patrol-matrix-scroll::-webkit-scrollbar-track {
                        background: rgba(255,255,255,0.03);
                        border-radius: 4px;
                    }
                    .patrol-matrix-scroll::-webkit-scrollbar-thumb {
                        background: rgba(234, 179, 8, 0.4);
                        border-radius: 4px;
                    }
                    .patrol-matrix-scroll::-webkit-scrollbar-thumb:hover {
                        background: #eab308;
                    }
                    .patrol-matrix-scroll::-webkit-scrollbar-corner {
                        background: transparent;
                    }
                `}</style>
                <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.75rem', minWidth: '100%' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 10 }}>
                        <tr>
                            <th style={{
                                position: 'sticky',
                                left: 0,
                                background: '#0f172a',
                                padding: '0.65rem 0.75rem',
                                borderBottom: '2px solid rgba(234, 179, 8, 0.4)',
                                borderRight: '2px solid rgba(255,255,255,0.12)',
                                color: '#eab308',
                                zIndex: 11,
                                minWidth: '95px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontSize: '0.7rem',
                                fontWeight: 800
                            }}>
                                FECHA
                            </th>
                            {hours.map(hour => {
                                const [h, m] = hour.split(':');
                                return (
                                    <th key={hour} style={{
                                        padding: '0.35rem 0.2rem',
                                        borderBottom: '2px solid rgba(234, 179, 8, 0.4)',
                                        borderLeft: hour.endsWith(':00') ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                        background: 'transparent',
                                        color: hour.endsWith(':00') ? '#fef08a' : '#94a3b8',
                                        minWidth: '32px',
                                        fontSize: '0.65rem',
                                        textAlign: 'center',
                                        lineHeight: '1.1',
                                        fontWeight: hour.endsWith(':00') ? 700 : 400
                                    }}>
                                        <div>{h}:</div>
                                        <div>{m}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {dates.map(date => (
                            <tr key={date}>
                                <td style={{
                                    position: 'sticky',
                                    left: 0,
                                    background: '#0f172a',
                                    padding: '0.6rem 0.75rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    borderRight: '2px solid rgba(255,255,255,0.12)',
                                    fontWeight: 700,
                                    color: '#cbd5e1',
                                    zIndex: 5,
                                    fontSize: '0.78rem'
                                }}>
                                    {date}
                                </td>
                                {hours.map(hour => {
                                    const log = matrix[date]?.[hour];
                                    return (
                                        <td
                                            key={hour}
                                            onClick={() => log && onSelectLog(log)}
                                            style={{
                                                padding: '0.5rem 0.2rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                borderLeft: hour.endsWith(':00') ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.04)',
                                                textAlign: 'center',
                                                background: log ? (
                                                    log.people_count > 10 ? 'rgba(239, 68, 68, 0.85)' :
                                                        log.people_count > 5 ? 'rgba(245, 158, 11, 0.85)' :
                                                            log.people_count > 2 ? 'rgba(59, 130, 246, 0.85)' :
                                                                'rgba(16, 185, 129, 0.85)'
                                                ) : 'transparent',
                                                color: log ? '#ffffff' : 'transparent',
                                                fontWeight: log ? 800 : 400,
                                                cursor: log ? 'pointer' : 'default',
                                                transition: 'all 0.15s ease',
                                                fontSize: '0.75rem',
                                                boxShadow: log ? 'inset 0 0 6px rgba(0,0,0,0.3)' : 'none'
                                            }}
                                            onMouseEnter={e => {
                                                if (log) {
                                                    e.currentTarget.style.transform = 'scale(1.2)';
                                                    e.currentTarget.style.zIndex = '3';
                                                    e.currentTarget.style.borderRadius = '4px';
                                                    e.currentTarget.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (log) {
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                    e.currentTarget.style.zIndex = '1';
                                                    e.currentTarget.style.borderRadius = '0px';
                                                    e.currentTarget.style.boxShadow = 'inset 0 0 6px rgba(0,0,0,0.3)';
                                                }
                                            }}
                                        >
                                            {log ? log.people_count : ''}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

export default Gangs;


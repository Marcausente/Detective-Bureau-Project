import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { uploadImageToStorage } from '../../utils/imageStorage';
import { useLanguage } from '../../contexts/LanguageContext';

const CATEGORY_CONFIG = {
    suspect: { label: 'categorySuspect', icon: '👤', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5' },
    evidence: { label: 'categoryEvidence', icon: '🔍', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fde68a' },
    location: { label: 'categoryLocation', icon: '📍', bg: 'rgba(20, 184, 166, 0.15)', border: '#14b8a6', text: '#99f6e4' },
    vehicle: { label: 'categoryVehicle', icon: '🚗', bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#e9d5ff' },
    witness: { label: 'categoryWitness', icon: '👁️', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#a7f3d0' },
    victim: { label: 'categoryVictim', icon: '🎯', bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fecdd3' },
    note: { label: 'categoryNote', icon: '📝', bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fef08a' },
};

const COLOR_SCHEMES = {
    red: { bg: '#2b1418', border: '#7f1d1d', header: '#991b1b', text: '#fca5a5' },
    yellow: { bg: '#2e2714', border: '#713f12', header: '#854d0e', text: '#fef08a' },
    blue: { bg: '#131e33', border: '#1e3a8a', header: '#1e40af', text: '#bfdbfe' },
    green: { bg: '#11291f', border: '#064e3b', header: '#065f46', text: '#a7f3d0' },
    purple: { bg: '#251533', border: '#581c87', header: '#6b21a8', text: '#e9d5ff' },
    dark: { bg: '#18181b', border: '#3f3f46', header: '#27272a', text: '#e4e4e7' }
};

export default function CaseWhiteboard({ caseId = null, isIA = false, isGang = false, gangId = null, caseData = null, onGoToUpdate = null }) {
    const { t, language } = useLanguage();
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingStatus, setSavingStatus] = useState('saved'); // 'saved', 'saving', 'error'

    // Canvas pan & zoom state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const boardRef = useRef(null);

    // Node Dragging State
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // Link Creation & Customization State
    const [connectingSourceId, setConnectingSourceId] = useState(null);
    const [showLinkLabelModal, setShowLinkLabelModal] = useState(false);
    const [pendingTargetId, setPendingTargetId] = useState(null);
    const [newLinkLabel, setNewLinkLabel] = useState('');

    const [hoveredLinkId, setHoveredLinkId] = useState(null);
    const [draggingLinkId, setDraggingLinkId] = useState(null);
    const [editingLink, setEditingLink] = useState(null);
    const [editLinkLabel, setEditLinkLabel] = useState('');

    // Modal State (Add/Edit Node)
    const [showNodeModal, setShowNodeModal] = useState(false);
    const [editingNode, setEditingNode] = useState(null);
    const [nodeTitle, setNodeTitle] = useState('');
    const [nodeContent, setNodeContent] = useState('');
    const [nodeCategory, setNodeCategory] = useState('note');
    const [nodeColor, setNodeColor] = useState('red');
    const [nodeImage, setNodeImage] = useState('');
    const [nodeLinkedUpdates, setNodeLinkedUpdates] = useState([]); // Array of update IDs
    const [nodeIsInactive, setNodeIsInactive] = useState(false);
    const [submittingNode, setSubmittingNode] = useState(false);

    // Preview Modal for Linked Update
    const [selectedPreviewUpdate, setSelectedPreviewUpdate] = useState(null);

    // Image Viewer Modal
    const [expandedImage, setExpandedImage] = useState(null);

    // Debounce save for node positions
    const positionSaveTimeoutsRef = useRef({});

    const targetId = isGang ? gangId : caseId;

    // Load Board Data
    const loadBoardData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_case_board_data', {
                p_case_id: isGang ? null : caseId,
                p_is_ia: isIA,
                p_gang_id: isGang ? gangId : null
            });

            if (error) throw error;

            if (data) {
                setNodes(data.nodes || []);
                setLinks(data.links || []);
            }
        } catch (err) {
            console.error('Error loading whiteboard data:', err);
            // Fallback direct query if RPC fails
            try {
                const column = isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id';
                const { data: nData } = await supabase.from('case_board_nodes').select('*').eq(column, targetId);
                const { data: lData } = await supabase.from('case_board_links').select('*').eq(column, targetId);
                setNodes(nData || []);
                setLinks(lData || []);
            } catch (fallbackErr) {
                console.error('Fallback query error:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    }, [caseId, isIA, isGang, gangId, targetId]);

    useEffect(() => {
        if (targetId) loadBoardData();
    }, [targetId, loadBoardData]);

    // Save Node Position in Database (Debounced)
    const saveNodePosition = (nodeId, x, y) => {
        setSavingStatus('saving');
        if (positionSaveTimeoutsRef.current[nodeId]) {
            clearTimeout(positionSaveTimeoutsRef.current[nodeId]);
        }

        positionSaveTimeoutsRef.current[nodeId] = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('case_board_nodes')
                    .update({ pos_x: Math.round(x), pos_y: Math.round(y) })
                    .eq('id', nodeId);

                if (error) throw error;
                setSavingStatus('saved');
            } catch (err) {
                console.error('Error saving node position:', err);
                setSavingStatus('error');
            }
        }, 500);
    };

    // Save Link Label Position (Debounced)
    const saveLinkPos = (linkId, pos) => {
        const roundPos = Math.round(pos * 100) / 100;
        if (positionSaveTimeoutsRef.current['link_' + linkId]) {
            clearTimeout(positionSaveTimeoutsRef.current['link_' + linkId]);
        }
        positionSaveTimeoutsRef.current['link_' + linkId] = setTimeout(async () => {
            try {
                await supabase.from('case_board_links').update({ label_pos: roundPos }).eq('id', linkId);
            } catch (err) {
                console.error('Error saving link label position:', err);
            }
        }, 500);
    };

    // Handle Card Drag Start
    const handleNodeMouseDown = (e, nodeId) => {
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = {
                x: e.clientX - pan.x,
                y: e.clientY - pan.y
            };
            return;
        }
        e.stopPropagation();
        if (connectingSourceId) {
            // Uniting mode
            if (connectingSourceId !== nodeId) {
                setPendingTargetId(nodeId);
                setShowLinkLabelModal(true);
            }
            return;
        }

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        setDraggingNodeId(nodeId);
        dragOffsetRef.current = {
            x: e.clientX / zoom - node.pos_x,
            y: e.clientY / zoom - node.pos_y
        };
    };

    // Global Mouse Move & Mouse Up listeners for dragging and panning
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isPanning || (e.buttons & 4) !== 0) {
                if ((e.buttons & 4) !== 0 && !isPanning) {
                    setIsPanning(true);
                    panStartRef.current = {
                        x: e.clientX - pan.x,
                        y: e.clientY - pan.y
                    };
                }
                if (isPanning) {
                    setPan({
                        x: e.clientX - panStartRef.current.x,
                        y: e.clientY - panStartRef.current.y
                    });
                    return;
                }
            }

            if (draggingNodeId) {
                const newX = e.clientX / zoom - dragOffsetRef.current.x;
                const newY = e.clientY / zoom - dragOffsetRef.current.y;

                setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, pos_x: newX, pos_y: newY } : n));
                saveNodePosition(draggingNodeId, newX, newY);
            } else if (draggingLinkId) {
                // Drag link label along line
                const linkObj = links.find(l => l.id === draggingLinkId);
                if (linkObj) {
                    const source = nodes.find(n => n.id === linkObj.source_id);
                    const target = nodes.find(n => n.id === linkObj.target_id);
                    if (source && target) {
                        const sW = source.width || 240;
                        const tW = target.width || 240;
                        const x1 = source.pos_x + sW / 2;
                        const y1 = source.pos_y - 2;
                        const x2 = target.pos_x + tW / 2;
                        const y2 = target.pos_y - 2;

                        const rect = boardRef.current ? boardRef.current.getBoundingClientRect() : { left: 0, top: 0 };
                        const mouseCanvasX = (e.clientX - rect.left) / zoom - pan.x;
                        const mouseCanvasY = (e.clientY - rect.top) / zoom - pan.y;

                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const lenSq = dx * dx + dy * dy;
                        let tProj = lenSq > 0 ? ((mouseCanvasX - x1) * dx + (mouseCanvasY - y1) * dy) / lenSq : 0.5;
                        tProj = Math.min(Math.max(0.1, tProj), 0.9);

                        setLinks(prev => prev.map(l => l.id === draggingLinkId ? { ...l, label_pos: tProj } : l));
                        saveLinkPos(draggingLinkId, tProj);
                    }
                }
            }
        };

        const handleMouseUp = (e) => {
            if (e.button === 1 || (e.buttons & 4) === 0) {
                if (isPanning) setIsPanning(false);
            }
            if (draggingNodeId) setDraggingNodeId(null);
            if (draggingLinkId) setDraggingLinkId(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingNodeId, draggingLinkId, isPanning, zoom, pan, links, nodes]);

    // Handle Pan Canvas
    const handleBoardMouseDown = (e) => {
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = {
                x: e.clientX - pan.x,
                y: e.clientY - pan.y
            };
            return;
        }
        if (e.target.closest('.whiteboard-card') || e.target.closest('.whiteboard-controls')) return;
        if (connectingSourceId) {
            setConnectingSourceId(null);
            return;
        }
        setIsPanning(true);
        panStartRef.current = {
            x: e.clientX - pan.x,
            y: e.clientY - pan.y
        };
    };

    // Handle Wheel Zoom (Native non-passive listener)
    const handleWheel = useCallback((e) => {
        if (e.target.closest('.whiteboard-card')) return;
        if (e.preventDefault) e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom(z => Math.min(Math.max(0.3, z * zoomFactor), 2.0));
    }, []);

    // Callback ref for non-passive wheel listener
    const setBoardRef = useCallback((node) => {
        if (boardRef.current) {
            boardRef.current.removeEventListener('wheel', handleWheel);
        }
        boardRef.current = node;
        if (node) {
            node.addEventListener('wheel', handleWheel, { passive: false });
        }
    }, [handleWheel]);

    // Auto-center and fit all cards in view
    const handleFitAll = () => {
        if (nodes.length === 0) {
            setPan({ x: 0, y: 0 });
            setZoom(1);
            return;
        }
        const minX = Math.min(...nodes.map(n => n.pos_x));
        const maxX = Math.max(...nodes.map(n => n.pos_x + (n.width || 240)));
        const minY = Math.min(...nodes.map(n => n.pos_y));
        const maxY = Math.max(...nodes.map(n => n.pos_y + 240));

        const boardWidth = boardRef.current ? boardRef.current.clientWidth : 1000;
        const boardHeight = boardRef.current ? boardRef.current.clientHeight : 750;

        const contentW = Math.max(maxX - minX + 160, 400);
        const contentH = Math.max(maxY - minY + 160, 300);

        const newZoom = Math.min(Math.max(Math.min(boardWidth / contentW, boardHeight / contentH), 0.5), 1.2);
        setZoom(newZoom);
        setPan({
            x: (boardWidth - (minX + maxX) * newZoom) / 2,
            y: (boardHeight - (minY + maxY) * newZoom) / 2
        });
    };

    // Open Modal for New or Edit Node
    const openNodeModal = (node = null) => {
        if (node) {
            setEditingNode(node);
            setNodeTitle(node.title);
            setNodeContent(node.content || '');
            setNodeCategory(node.category || 'note');
            setNodeColor(node.color || 'red');
            setNodeImage(node.image_url || '');
            setNodeLinkedUpdates(Array.isArray(node.linked_update_ids) ? node.linked_update_ids : []);
            setNodeIsInactive(!!node.is_inactive);
        } else {
            setEditingNode(null);
            setNodeTitle('');
            setNodeContent('');
            setNodeCategory('note');
            setNodeColor('red');
            setNodeImage('');
            setNodeLinkedUpdates([]);
            setNodeIsInactive(false);
        }
        setShowNodeModal(true);
    };

    // Save Node (Create / Update)
    const handleSaveNode = async (e) => {
        e.preventDefault();
        if (!nodeTitle.trim()) return alert(t('cardTitleLabel') + ' is required');

        try {
            setSubmittingNode(true);
            const { data: { user } } = await supabase.auth.getUser();

            let finalImageUrl = nodeImage;
            if (finalImageUrl && finalImageUrl.startsWith('data:')) {
                const folder = isGang ? 'gangs' : 'whiteboards';
                finalImageUrl = await uploadImageToStorage(finalImageUrl, folder);
            }

            const payload = {
                title: nodeTitle.trim(),
                content: nodeContent.trim(),
                category: nodeCategory,
                color: nodeColor,
                image_url: finalImageUrl || null,
                linked_update_ids: nodeLinkedUpdates,
                is_inactive: nodeIsInactive,
                created_by: user ? user.id : null
            };

            if (isGang) {
                payload.gang_id = gangId;
            } else if (isIA) {
                payload.ia_case_id = caseId;
            } else {
                payload.case_id = caseId;
            }

            if (editingNode) {
                const { error } = await supabase
                    .from('case_board_nodes')
                    .update(payload)
                    .eq('id', editingNode.id);
                if (error) throw error;
            } else {
                // Calculate position near current view center
                payload.pos_x = Math.max(50, (350 - pan.x) / zoom + (nodes.length % 4) * 30);
                payload.pos_y = Math.max(50, (250 - pan.y) / zoom + (nodes.length % 4) * 30);

                const { error } = await supabase
                    .from('case_board_nodes')
                    .insert([payload]);
                if (error) throw error;
            }

            setShowNodeModal(false);
            loadBoardData();
        } catch (err) {
            alert('Error saving card: ' + err.message);
        } finally {
            setSubmittingNode(false);
        }
    };

    // Delete Node
    const handleDeleteNode = async (nodeId, title) => {
        if (!window.confirm(`Delete card "${title}"?`)) return;
        try {
            const { error } = await supabase.from('case_board_nodes').delete().eq('id', nodeId);
            if (error) throw error;
            loadBoardData();
        } catch (err) {
            alert('Error deleting card: ' + err.message);
        }
    };

    // Create Connection Link
    const handleConfirmLink = async (e) => {
        e.preventDefault();
        if (!connectingSourceId || !pendingTargetId) return;

        try {
            const payload = {
                source_id: connectingSourceId,
                target_id: pendingTargetId,
                label: newLinkLabel.trim() || null,
                label_pos: 0.5,
                color: '#ef4444'
            };

            if (isGang) {
                payload.gang_id = gangId;
            } else if (isIA) {
                payload.ia_case_id = caseId;
            } else {
                payload.case_id = caseId;
            }

            const { error } = await supabase.from('case_board_links').insert([payload]);
            if (error) throw error;

            setConnectingSourceId(null);
            setPendingTargetId(null);
            setNewLinkLabel('');
            setShowLinkLabelModal(false);
            loadBoardData();
        } catch (err) {
            alert('Error creating link: ' + err.message);
        }
    };

    // Update Link Label Text
    const handleSaveLinkLabel = async (e) => {
        e.preventDefault();
        if (!editingLink) return;

        try {
            const newLabelVal = editLinkLabel.trim() || null;
            const { error } = await supabase
                .from('case_board_links')
                .update({ label: newLabelVal })
                .eq('id', editingLink.id);

            if (error) throw error;

            setLinks(prev => prev.map(l => l.id === editingLink.id ? { ...l, label: newLabelVal } : l));
            setEditingLink(null);
            setEditLinkLabel('');
        } catch (err) {
            alert('Error updating link text: ' + err.message);
        }
    };

    // Delete Connection Link
    const handleDeleteLink = async (linkId) => {
        try {
            const { error } = await supabase.from('case_board_links').delete().eq('id', linkId);
            if (error) throw error;
            setLinks(prev => prev.filter(l => l.id !== linkId));
        } catch (err) {
            alert('Error removing link: ' + err.message);
        }
    };

    // Import Evidence & Updates from caseData or Gang Data
    const handleImportCaseEvidence = async () => {
        if (!caseData) return alert("Data not available.");

        // Fetch fresh existing nodes directly from database to avoid stale React state
        let existingNodes = [...nodes];
        try {
            const column = isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id';
            const { data: dbNodes } = await supabase.from('case_board_nodes').select('*').eq(column, targetId);
            if (dbNodes && dbNodes.length > 0) {
                existingNodes = dbNodes;
            }
        } catch (err) {
            console.error("Error fetching latest board nodes for duplicate check:", err);
        }

        const itemsToInsert = [];
        const { data: { user } } = await supabase.auth.getUser();

        let posX = 100;
        let posY = 100;

        const clean = (str) => (str ? String(str).toLowerCase().trim() : '');

        if (isGang) {
            // 1. Members
            if (caseData.members && caseData.members.length > 0) {
                caseData.members.forEach(m => {
                    const mNameClean = clean(m.name);
                    const mIdClean = clean(m.id_card);
                    const mPhoto = m.photo_url || m.photo || null;
                    const titleStr = `${m.name} (${m.role || 'Miembro'})`;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (nTitle === clean(titleStr)) return true;
                        if (mNameClean && (nTitle.includes(mNameClean) || nContent.includes(mNameClean))) return true;
                        if (mIdClean && (nTitle.includes(mIdClean) || nContent.includes(mIdClean))) return true;
                        if (mPhoto && n.image_url === mPhoto) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        const isInactive = m.role === 'Inactivo';
                        itemsToInsert.push({
                            gang_id: gangId,
                            title: titleStr,
                            content: `Rol: ${m.role || 'Miembro'}${m.id_card ? '\nID: ' + m.id_card : ''}\n${m.notes || ''}`,
                            category: 'suspect',
                            color: isInactive ? 'dark' : m.role === 'Lider' ? 'red' : m.role === 'Sublider' ? 'yellow' : 'blue',
                            image_url: mPhoto,
                            is_inactive: isInactive,
                            pos_x: posX,
                            pos_y: posY,
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                        if (posX > 900) { posX = 100; posY += 280; }
                    }
                });
            }

            // 2. Vehicles
            if (caseData.vehicles && caseData.vehicles.length > 0) {
                caseData.vehicles.forEach(v => {
                    const plateClean = clean(v.plate);
                    const modelClean = clean(v.model);
                    const ownerClean = clean(v.owner);
                    const img = (v.images && v.images.length > 0) ? v.images[0] : null;
                    const titleStr = `${v.model || 'Vehículo'} [${v.plate || 'SIN PLACA'}]`;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (nTitle === clean(titleStr)) return true;
                        if (plateClean && plateClean !== 'sin placa' && (nTitle.includes(plateClean) || nContent.includes(plateClean))) return true;
                        if (modelClean && ownerClean && nTitle.includes(modelClean) && nContent.includes(ownerClean)) return true;
                        if (img && n.image_url === img) return true;
                        if (v.images && v.images.length > 0 && v.images.includes(n.image_url)) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        itemsToInsert.push({
                            gang_id: gangId,
                            title: titleStr,
                            content: `Propietario: ${v.owner || 'Desconocido'}\n${v.notes || ''}`,
                            category: 'vehicle',
                            color: 'purple',
                            image_url: img,
                            pos_x: posX,
                            pos_y: posY,
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                        if (posX > 900) { posX = 100; posY += 280; }
                    }
                });
            }

            // 3. Homes / Properties
            if (caseData.homes && caseData.homes.length > 0) {
                caseData.homes.forEach(h => {
                    const ownerClean = clean(h.owner);
                    const notesClean = clean(h.notes);
                    const img = (h.images && h.images.length > 0) ? h.images[0] : null;
                    const titleStr = `Propiedad: ${h.owner || 'Ubicación Banda'}`;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (nTitle === clean(titleStr)) return true;
                        if (ownerClean && ownerClean !== 'ubicación banda' && (nTitle.includes(ownerClean) || nContent.includes(ownerClean))) return true;
                        if (notesClean && notesClean.length > 5 && nContent.includes(notesClean.slice(0, 30))) return true;
                        if (img && n.image_url === img) return true;
                        if (h.images && h.images.length > 0 && h.images.includes(n.image_url)) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        itemsToInsert.push({
                            gang_id: gangId,
                            title: titleStr,
                            content: `Notas: ${h.notes || 'Sin notas'}`,
                            category: 'location',
                            color: 'green',
                            image_url: img,
                            pos_x: posX,
                            pos_y: posY,
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                        if (posX > 900) { posX = 100; posY += 280; }
                    }
                });
            }

            // 4. Intelligence
            if (caseData.info && caseData.info.length > 0) {
                caseData.info.forEach((i) => {
                    const contentClean = clean(i.content);
                    const img = (i.images && i.images.length > 0) ? i.images[0] : null;
                    const titleStr = `Inteligencia (${i.type === 'characteristic' ? 'Característica' : 'Info'})`;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (nTitle.includes('inteligencia') && contentClean && nContent.includes(contentClean.slice(0, 30))) return true;
                        if (contentClean && contentClean.length > 5 && nContent === contentClean) return true;
                        if (img && n.image_url === img) return true;
                        if (i.images && i.images.length > 0 && i.images.includes(n.image_url)) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        itemsToInsert.push({
                            gang_id: gangId,
                            title: titleStr,
                            content: i.content || '',
                            category: i.type === 'characteristic' ? 'evidence' : 'note',
                            color: i.type === 'characteristic' ? 'yellow' : 'dark',
                            image_url: img,
                            pos_x: posX,
                            pos_y: posY,
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                        if (posX > 900) { posX = 100; posY += 280; }
                    }
                });
            }

            // 5. Graffiti
            if (caseData.graffiti && caseData.graffiti.length > 0) {
                caseData.graffiti.forEach((g) => {
                    const notesClean = clean(g.notes);
                    const img = g.graffiti_image || g.gps_image || null;
                    const titleStr = `Grafiti / GPS`;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (nTitle.includes('grafiti') && notesClean && nContent.includes(notesClean.slice(0, 30))) return true;
                        if (g.graffiti_image && n.image_url === g.graffiti_image) return true;
                        if (g.gps_image && n.image_url === g.gps_image) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        itemsToInsert.push({
                            gang_id: gangId,
                            title: titleStr,
                            content: g.notes || 'Sin detalles de grafiti',
                            category: 'evidence',
                            color: 'purple',
                            image_url: img,
                            pos_x: posX,
                            pos_y: posY,
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                        if (posX > 900) { posX = 100; posY += 280; }
                    }
                });
            }

            if (itemsToInsert.length === 0) {
                return alert(language === 'es' ? "No hay nuevos elementos de la banda para importar." : "No new gang items to import.");
            }
        } else {
            // Import Regular Case Data
            if (caseData.info?.initial_image_url) {
                const initialImg = caseData.info.initial_image_url;
                const alreadyExists = existingNodes.some(n => {
                    const nTitle = clean(n.title);
                    return nTitle.includes('escena inicial') || nTitle.includes('foto clave') || n.image_url === initialImg;
                });

                if (!alreadyExists) {
                    itemsToInsert.push({
                        [isIA ? 'ia_case_id' : 'case_id']: caseId,
                        title: 'Escena Inicial / Foto Clave',
                        content: caseData.info.title || 'Evidencia principal registrada al abrir el caso.',
                        category: 'evidence',
                        color: 'red',
                        image_url: initialImg,
                        pos_x: posX,
                        pos_y: posY,
                        created_by: user ? user.id : null
                    });
                    posX += 280;
                }
            }

            if (caseData.updates && caseData.updates.length > 0) {
                caseData.updates.forEach((upd, idx) => {
                    const titleStr = `Novedad #${idx + 1} (${upd.author_name || 'Agente'})`;
                    const updContentClean = upd.content ? clean(upd.content.replace(/<[^>]*>?/gm, '')) : '';
                    const img = (upd.images && upd.images.length > 0) ? upd.images[0] : upd.image || null;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (n.linked_update_ids && Array.isArray(n.linked_update_ids) && n.linked_update_ids.includes(upd.id)) return true;
                        if (nTitle === clean(titleStr)) return true;
                        if (updContentClean && updContentClean.length > 10 && nContent.includes(updContentClean.slice(0, 40))) return true;
                        if (img && n.image_url === img) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        itemsToInsert.push({
                            [isIA ? 'ia_case_id' : 'case_id']: caseId,
                            title: titleStr,
                            content: upd.content ? upd.content.replace(/<[^>]*>?/gm, '').slice(0, 150) : '',
                            category: img ? 'evidence' : 'note',
                            color: img ? 'yellow' : 'blue',
                            image_url: img,
                            pos_x: posX,
                            pos_y: posY,
                            linked_update_ids: [upd.id],
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                        if (posX > 900) { posX = 100; posY += 280; }
                    }
                });
            }

            if (caseData.interrogations && caseData.interrogations.length > 0) {
                caseData.interrogations.forEach((inter) => {
                    const suspectClean = clean(inter.suspect_name);
                    const titleClean = clean(inter.title);
                    const titleStr = `Interrogatorio: ${inter.suspect_name || inter.title || 'Declaración'}`;

                    const alreadyExists = existingNodes.some(n => {
                        const nTitle = clean(n.title);
                        const nContent = clean(n.content);
                        if (nTitle === clean(titleStr)) return true;
                        if (suspectClean && (nTitle.includes(suspectClean) || nContent.includes(suspectClean))) return true;
                        if (titleClean && (nTitle.includes(titleClean) || nContent.includes(titleClean))) return true;
                        return false;
                    });

                    if (!alreadyExists) {
                        itemsToInsert.push({
                            [isIA ? 'ia_case_id' : 'case_id']: caseId,
                            title: titleStr,
                            content: `Interrogado por ${inter.interrogator_name || 'Agente'}. Estado: ${inter.status || 'Completado'}`,
                            category: 'suspect',
                            color: 'red',
                            pos_x: posX,
                            pos_y: posY,
                            created_by: user ? user.id : null
                        });
                        posX += 280;
                    }
                });
            }

            if (itemsToInsert.length === 0) {
                return alert(language === 'es' ? "No hay nuevas evidencias disponibles para importar." : "No new evidence items available to import.");
            }
        }

        try {
            setLoading(true);
            const { error } = await supabase.from('case_board_nodes').insert(itemsToInsert);
            if (error) throw error;
            loadBoardData();
        } catch (err) {
            alert("Error importing evidence: " + err.message);
            setLoading(false);
        }
    };

    // Auto Import on First Load for Gang Whiteboard if empty
    useEffect(() => {
        if (isGang && !loading && nodes.length === 0 && caseData) {
            handleImportCaseEvidence();
        }
    }, [isGang, loading, nodes.length]);

    // Auto-fit all cards on load when nodes are populated
    useEffect(() => {
        if (!loading && nodes.length > 0) {
            const timer = setTimeout(() => {
                handleFitAll();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [loading, nodes.length === 0]);

    // Handle Image File Upload in Node Form
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const folder = isGang ? 'gangs' : 'whiteboards';
            const publicUrl = await uploadImageToStorage(file, folder);
            if (publicUrl) {
                setNodeImage(publicUrl);
            }
        } catch (err) {
            console.error('Error uploading whiteboard card image:', err);
            alert('Error subiendo imagen al Storage: ' + err.message);
        }
    };

    if (loading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-gold)' }}>🕵️ Cargando Pizarra de Investigación...</div>;
    }

    return (
        <div className="case-whiteboard-wrapper" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '450px', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', userSelect: 'none' }}>

            {/* Top Bar Controls */}
            <div className="whiteboard-controls" style={{
                position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)',
                padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📌 {isGang ? `Pizarra: ${caseData?.name || 'Gang Unit'}` : t('whiteboardTab')}
                    </h3>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                        {savingStatus === 'saving' ? `⏳ ${t('savingBoardStatus')}` : savingStatus === 'saved' ? `✓ ${t('savedBoardStatus')}` : '⚠️ Error'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => openNodeModal(null)}
                        className="login-button"
                        style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                    >
                        {t('newCardBtn')}
                    </button>

                    <button
                        onClick={handleImportCaseEvidence}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                        title="Importar evidencias y fotos registradas"
                    >
                        {t('importEvidenceBtn')}
                    </button>

                    {connectingSourceId ? (
                        <button
                            onClick={() => setConnectingSourceId(null)}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                        >
                            ✕ {language === 'es' ? 'Cancelar Unión' : 'Cancel Link'}
                        </button>
                    ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                            {language === 'es' ? '💡 Usa ' : '💡 Use '} <strong>🔗</strong> {language === 'es' ? 'en una tarjeta para unirla con otra' : 'on a card to connect it'}
                        </span>
                    )}

                    {/* Zoom & Fit controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', width: '24px' }}>-</button>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(1.8, z + 0.1))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', width: '24px' }}>+</button>
                        <button onClick={handleFitAll} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '4px', fontWeight: 'bold' }}>
                            🎯 {language === 'es' ? 'Centrar' : 'Fit'}
                        </button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '2px' }}>Reset</button>
                    </div>
                </div>
            </div>

            {/* Connecting Active Banner */}
            {connectingSourceId && (
                <div style={{
                    position: 'absolute', top: 75, left: '50%', transform: 'translateX(-50%)', zIndex: 25,
                    background: 'rgba(239, 68, 68, 0.95)', color: 'white', padding: '0.4rem 1.2rem',
                    borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <span>🧵 {t('connectingModeActive')}</span>
                </div>
            )}

            {/* Main Interactive Canvas Area */}
            <div
                ref={setBoardRef}
                onMouseDown={handleBoardMouseDown}
                style={{
                    width: '100%', height: '100%', minHeight: '750px', cursor: isPanning ? 'grabbing' : 'grab', position: 'relative',
                    backgroundImage: `
                        radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                        linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)
                    `,
                    backgroundSize: '30px 30px, 120px 120px, 120px 120px',
                    backgroundPosition: `${pan.x}px ${pan.y}px`
                }}
            >
                <div style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0
                }}>

                    {/* SVG Connector Strings Layer */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: '-5000px',
                            left: '-5000px',
                            width: '10000px',
                            height: '10000px',
                            pointerEvents: 'none',
                            zIndex: 1,
                            overflow: 'visible'
                        }}
                        viewBox="-5000 -5000 10000 10000"
                    >
                        <defs>
                            <filter id="string-glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.7" />
                            </filter>
                            <filter id="string-hover-glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.9" />
                            </filter>
                        </defs>

                        {links.map((link) => {
                            const source = nodes.find(n => n.id === link.source_id);
                            const target = nodes.find(n => n.id === link.target_id);
                            if (!source || !target) return null;

                            const sW = source.width || 240;
                            const tW = target.width || 240;

                            const x1 = source.pos_x + sW / 2;
                            const y1 = source.pos_y - 2;
                            const x2 = target.pos_x + tW / 2;
                            const y2 = target.pos_y - 2;

                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            const sag = Math.min(dist * 0.1, 45);
                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2 + sag;

                            const isHovered = hoveredLinkId === link.id;

                            // Calculate position along curve (t in [0.1, 0.9])
                            const tPos = link.label_pos ?? 0.5;
                            const posX = (1 - tPos) * (1 - tPos) * x1 + 2 * (1 - tPos) * tPos * midX + tPos * tPos * x2;
                            const posY = (1 - tPos) * (1 - tPos) * y1 + 2 * (1 - tPos) * tPos * midY + tPos * tPos * y2;

                            const hasLabelText = link.label && link.label.trim().length > 0;

                            return (
                                <g key={link.id}>
                                    {/* Visible Red String Line */}
                                    <path
                                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                                        stroke={isHovered ? '#f59e0b' : (link.color || '#ef4444')}
                                        strokeWidth={isHovered ? "3.5" : "2.5"}
                                        fill="none"
                                        strokeDasharray={link.style === 'dashed' ? '6,4' : 'none'}
                                        filter={isHovered ? "url(#string-hover-glow)" : "url(#string-glow)"}
                                    />

                                    {/* Invisible Wide Interactive Stroke for Hover & Click */}
                                    <path
                                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                                        stroke="transparent"
                                        strokeWidth="18"
                                        fill="none"
                                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredLinkId(link.id)}
                                        onMouseLeave={() => setHoveredLinkId(null)}
                                        onClick={(e) => { e.stopPropagation(); setEditingLink(link); setEditLinkLabel(link.label || ''); }}
                                    />

                                    {/* Pin Dots */}
                                    <circle cx={x1} cy={y1} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                                    <circle cx={x2} cy={y2} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />

                                    {/* Label Badge / Control Item */}
                                    {hasLabelText ? (
                                        /* Draggable Label Badge */
                                        <foreignObject x={posX - 75} y={posY - 14} width="150" height="32" style={{ pointerEvents: 'auto' }}>
                                            <div
                                                onMouseEnter={() => setHoveredLinkId(link.id)}
                                                onMouseLeave={() => setHoveredLinkId(null)}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setDraggingLinkId(link.id);
                                                }}
                                                style={{
                                                    background: isHovered ? 'rgba(245, 158, 11, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                                                    color: 'white', fontSize: '0.75rem', fontWeight: 'bold',
                                                    padding: '2px 8px', borderRadius: '12px', textAlign: 'center',
                                                    cursor: draggingLinkId === link.id ? 'grabbing' : 'grab',
                                                    boxShadow: '0 3px 8px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
                                                    textOverflow: 'ellipsis', overflow: 'hidden',
                                                    border: '1px solid rgba(255,255,255,0.4)',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                                    maxWidth: '150px'
                                                }}
                                                title="Arrastra para mover la etiqueta por el hilo"
                                            >
                                                <span>🧵 {link.label}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingLink(link); setEditLinkLabel(link.label || ''); }}
                                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.7rem', opacity: 0.8, padding: 0 }}
                                                    title="Editar texto de relación"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }}
                                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.7rem', opacity: 0.8, padding: 0 }}
                                                    title="Eliminar conexión"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </foreignObject>
                                    ) : (
                                        /* Clean Thread: Floating quick actions on hover */
                                        isHovered && (
                                            <foreignObject x={posX - 55} y={posY - 14} width="110" height="28" style={{ pointerEvents: 'auto' }}>
                                                <div
                                                    style={{
                                                        background: 'rgba(15, 23, 42, 0.95)', color: 'var(--accent-gold)', fontSize: '0.7rem', fontWeight: 'bold',
                                                        padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--accent-gold)',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                        boxShadow: '0 4px 10px rgba(0,0,0,0.6)', cursor: 'pointer'
                                                    }}
                                                >
                                                    <span onClick={(e) => { e.stopPropagation(); setEditingLink(link); setEditLinkLabel(''); }} title="Añadir texto a la relación">
                                                        ✏️ Texto
                                                    </span>
                                                    <span onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }} style={{ color: '#ef4444' }} title="Eliminar hilo rojo">
                                                        🗑️
                                                    </span>
                                                </div>
                                            </foreignObject>
                                        )
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {/* Empty State Banner */}
                    {nodes.length === 0 && (
                        <div style={{
                            position: 'absolute', top: '220px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(30, 41, 59, 0.7)', padding: '2rem', borderRadius: '12px',
                            border: '1px border dashed rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '420px'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🕵️‍♂️</div>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-gold)' }}>{t('whiteboardTitle')}</h4>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('emptyBoardMessage')}</p>
                            <button
                                onClick={() => openNodeModal(null)}
                                className="login-button"
                                style={{ width: 'auto', marginTop: '1rem', padding: '0.4rem 1rem' }}
                            >
                                {t('newCardBtn')}
                            </button>
                        </div>
                    )}

                    {/* Nodes / Cards */}
                    {nodes.map((node) => {
                        const scheme = COLOR_SCHEMES[node.color] || COLOR_SCHEMES.red;
                        const catConfig = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.note;
                        const isSource = connectingSourceId === node.id;
                        const cardWidth = node.width || 240;

                        return (
                            <div
                                key={node.id}
                                className="whiteboard-card"
                                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                style={{
                                    position: 'absolute',
                                    left: `${node.pos_x}px`,
                                    top: `${node.pos_y}px`,
                                    width: `${cardWidth}px`,
                                    background: scheme.bg,
                                    border: `2px solid ${isSource ? '#ef4444' : node.is_inactive ? '#991b1b' : scheme.border}`,
                                    borderRadius: '8px',
                                    boxShadow: isSource ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 8px 24px rgba(0, 0, 0, 0.6)',
                                    zIndex: isSource ? 15 : draggingNodeId === node.id ? 10 : 2,
                                    transition: draggingNodeId === node.id ? 'none' : 'box-shadow 0.2s',
                                    cursor: connectingSourceId ? 'pointer' : 'move',
                                    opacity: node.is_inactive ? 0.88 : 1,
                                    filter: node.is_inactive ? 'grayscale(25%)' : 'none'
                                }}
                            >
                                {/* Inactive Visual Overlay with Big Red Cross */}
                                {node.is_inactive && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        pointerEvents: 'none',
                                        zIndex: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '8px',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Red Diagonal SVG Cross Lines */}
                                        <svg style={{ position: 'absolute', width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <line x1="0" y1="0" x2="100" y2="100" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
                                            <line x1="100" y1="0" x2="0" y2="100" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
                                        </svg>
                                        {/* Inactive Stamp / Badge */}
                                        <div style={{
                                            background: 'rgba(185, 28, 28, 0.95)',
                                            color: 'white',
                                            fontWeight: '900',
                                            fontSize: '0.8rem',
                                            letterSpacing: '1.5px',
                                            padding: '4px 14px',
                                            borderRadius: '4px',
                                            border: '2px solid #ffffff',
                                            boxShadow: '0 4px 14px rgba(0,0,0,0.85)',
                                            transform: 'rotate(-12deg)',
                                            textTransform: 'uppercase',
                                            zIndex: 11
                                        }}>
                                            ❌ {t('inactiveBadge') || 'INACTIVO'}
                                        </div>
                                    </div>
                                )}

                                {/* Top Red Pin Accent */}
                                <div style={{
                                    position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                                    width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444',
                                    border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.6)', zIndex: 3
                                }} />

                                {/* Card Header */}
                                <div style={{
                                    background: scheme.header, padding: '0.5rem 0.75rem', borderTopLeftRadius: '6px', borderTopRightRadius: '6px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>{catConfig.icon}</span>
                                        <span>{t(catConfig.label) || node.category}</span>
                                        {node.is_inactive && (
                                            <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px' }}>
                                                ❌ INACTIVO
                                            </span>
                                        )}
                                    </span>

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConnectingSourceId(isSource ? null : node.id);
                                            }}
                                            style={{
                                                background: isSource ? '#ef4444' : 'rgba(255,255,255,0.15)',
                                                border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer',
                                                fontSize: '0.75rem', padding: '1px 5px'
                                            }}
                                            title="Conectar hilo rojo a otra tarjeta"
                                        >
                                            🔗
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openNodeModal(node); }}
                                            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', padding: '1px 5px' }}
                                            title="Editar tarjeta"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id, node.title); }}
                                            style={{ background: 'rgba(239, 68, 68, 0.4)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', padding: '1px 5px' }}
                                            title="Eliminar tarjeta"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div style={{ padding: '0.75rem' }}>
                                    <h4 style={{ margin: '0 0 0.4rem 0', color: scheme.text, fontSize: '0.95rem', fontWeight: 'bold', wordBreak: 'break-word' }}>
                                        {node.title}
                                    </h4>

                                    {/* Pinned Photo / Polaroid */}
                                    {node.image_url && (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setExpandedImage(node.image_url); }}
                                            style={{
                                                background: '#000', padding: '4px', borderRadius: '4px', marginBottom: '0.5rem',
                                                border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer'
                                            }}
                                        >
                                            <img
                                                src={node.image_url}
                                                alt="Evidence"
                                                style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '2px', display: 'block' }}
                                            />
                                        </div>
                                    )}

                                    {node.content && (
                                        <p style={{
                                            margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem',
                                            lineHeight: '1.3', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                        }}>
                                            {node.content}
                                        </p>
                                    )}

                                    {/* Linked Updates / Entradas Badges */}
                                    {!isGang && node.linked_update_ids && Array.isArray(node.linked_update_ids) && node.linked_update_ids.length > 0 && (
                                        <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {node.linked_update_ids.map((updId) => {
                                                const updObj = caseData?.updates?.find(u => u.id === updId);
                                                if (!updObj) return null;
                                                const idxInUpdates = caseData.updates.indexOf(updObj);
                                                const numStr = caseData.updates.length - idxInUpdates;
                                                return (
                                                    <span
                                                        key={updId}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedPreviewUpdate(updObj); }}
                                                        style={{
                                                            fontSize: '0.7rem', background: 'rgba(212, 175, 55, 0.2)', color: 'var(--accent-gold)',
                                                            border: '1px solid rgba(212, 175, 55, 0.4)', borderRadius: '4px', padding: '1px 6px',
                                                            cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px'
                                                        }}
                                                        title="Clic para ver detalle de la novedad"
                                                    >
                                                        🔗 Novedad #{numStr}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal: Create / Edit Node */}
            {showNodeModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        background: '#1e293b', border: '1px solid var(--accent-gold)', borderRadius: '12px',
                        width: '100%', maxWidth: '500px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                            {editingNode ? t('editItemTitle') : t('newCardBtn')}
                        </h3>

                        <form onSubmit={handleSaveNode}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                    {t('cardTitleLabel')} *
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={nodeTitle}
                                    onChange={e => setNodeTitle(e.target.value)}
                                    placeholder="ej. Sospechoso: Juan Pérez / Vehículo Sospechoso"
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                        {t('cardCategoryLabel')}
                                    </label>
                                    <select
                                        className="form-input"
                                        value={nodeCategory}
                                        onChange={e => setNodeCategory(e.target.value)}
                                    >
                                        {Object.keys(CATEGORY_CONFIG).map(catKey => (
                                            <option key={catKey} value={catKey}>
                                                {CATEGORY_CONFIG[catKey].icon} {t(CATEGORY_CONFIG[catKey].label)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                        {t('cardColorLabel')}
                                    </label>
                                    <select
                                        className="form-input"
                                        value={nodeColor}
                                        onChange={e => setNodeColor(e.target.value)}
                                    >
                                        <option value="red">🔴 Rojo Sospechoso</option>
                                        <option value="yellow">🟡 Amarillo Nota</option>
                                        <option value="blue">🔵 Azul Policial</option>
                                        <option value="green">🟢 Verde Testigo</option>
                                        <option value="purple">🟣 Púrpura Vehículo</option>
                                        <option value="dark">⚫ Oscuro / Slate</option>
                                    </select>
                                </div>
                            </div>

                            {/* Option: Mark as Inactive */}
                            <div style={{
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: nodeIsInactive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                padding: '0.65rem 0.85rem',
                                borderRadius: '6px',
                                border: `1px solid ${nodeIsInactive ? '#ef4444' : 'rgba(255, 255, 255, 0.15)'}`,
                                transition: 'all 0.2s'
                            }}>
                                <input
                                    type="checkbox"
                                    id="nodeIsInactive"
                                    checked={nodeIsInactive}
                                    onChange={e => setNodeIsInactive(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ef4444' }}
                                />
                                <label htmlFor="nodeIsInactive" style={{ cursor: 'pointer', fontSize: '0.85rem', color: nodeIsInactive ? '#fca5a5' : 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, userSelect: 'none' }}>
                                    ❌ {t('inactiveCardLabel') || 'Marcar como Inactivo / No activo (Mostrar cruz roja)'}
                                </label>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                    {t('cardDescriptionLabel')}
                                </label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    value={nodeContent}
                                    onChange={e => setNodeContent(e.target.value)}
                                    placeholder="Detalles, notas clave o hallazgos sobre esta tarjeta..."
                                />
                            </div>

                            {/* Section: Link Case Entries / Updates */}
                            {!isGang && (
                                <div style={{ marginBottom: '1.2rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                                        {t('linkEntriesTitle')}
                                    </label>
                                    {caseData?.updates && caseData.updates.length > 0 ? (
                                        <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {caseData.updates.map((upd, idx) => {
                                                const isChecked = nodeLinkedUpdates.includes(upd.id);
                                                const snippet = upd.content ? upd.content.replace(/<[^>]*>?/gm, '').slice(0, 50) : 'Sin contenido';
                                                const numStr = caseData.updates.length - idx;
                                                return (
                                                    <label key={upd.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNodeLinkedUpdates(prev => [...prev, upd.id]);
                                                                } else {
                                                                    setNodeLinkedUpdates(prev => prev.filter(id => id !== upd.id));
                                                                }
                                                            }}
                                                        />
                                                        <span style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>Novedad #{numStr}:</span>
                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{snippet}...</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No hay novedades registradas en este caso.</div>
                                    )}
                                </div>
                            )}

                            {/* Image upload / Base64 */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                    {t('cardImageLabel')}
                                </label>
                                {nodeImage ? (
                                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.5rem' }}>
                                        <img src={nodeImage} alt="Preview" style={{ height: '90px', borderRadius: '4px', border: '1px solid var(--accent-gold)' }} />
                                        <button
                                            type="button"
                                            onClick={() => setNodeImage('')}
                                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer' }}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ) : (
                                    <label className="custom-file-upload" style={{ display: 'inline-block', width: 'auto', margin: 0, fontSize: '0.85rem' }}>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                                        📷 {t('uploadImageBtn')}
                                    </label>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowNodeModal(false)} style={{ width: 'auto' }}>
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submittingNode}>
                                    {submittingNode ? t('savingBtn') : t('saveBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Link Label Input / New Link */}
            {showLinkLabelModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        background: '#1e293b', border: '1px solid var(--accent-gold)', borderRadius: '12px',
                        width: '100%', maxWidth: '400px', padding: '1.5rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)' }}>🧵 {t('connectModeBtn')}</h3>
                        <form onSubmit={handleConfirmLink}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'Texto de relación entre tarjetas (Opcional - dejar vacío para hilo limpio):' : 'Relationship label (Optional - leave empty for clean thread):'}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newLinkLabel}
                                    onChange={e => setNewLinkLabel(e.target.value)}
                                    placeholder={t('linkLabelPlaceholder')}
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="login-button btn-secondary"
                                    onClick={() => { setShowLinkLabelModal(false); setConnectingSourceId(null); }}
                                    style={{ width: 'auto' }}
                                >
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }}>
                                    {language === 'es' ? 'Unir con Hilo Rojo' : 'Connect with Red Thread'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Edit Existing Link Label */}
            {editingLink && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        background: '#1e293b', border: '1px solid var(--accent-gold)', borderRadius: '12px',
                        width: '100%', maxWidth: '420px', padding: '1.5rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)' }}>✏️ {language === 'es' ? 'Editar Texto de Relación' : 'Edit Relationship Text'}</h3>
                        <form onSubmit={handleSaveLinkLabel}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'Texto de la caja flotante (vacío = ocultar caja):' : 'Label text (empty = hide text box):'}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={editLinkLabel}
                                    onChange={e => setEditLinkLabel(e.target.value)}
                                    placeholder={t('linkLabelPlaceholder')}
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="login-button btn-secondary"
                                    onClick={() => handleDeleteLink(editingLink.id)}
                                    style={{ width: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444' }}
                                >
                                    🗑️ {language === 'es' ? 'Eliminar Hilo' : 'Delete Thread'}
                                </button>
                                <button
                                    type="button"
                                    className="login-button btn-secondary"
                                    onClick={() => setEditingLink(null)}
                                    style={{ width: 'auto' }}
                                >
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }}>
                                    {t('saveBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Linked Entry Preview */}
            {!isGang && selectedPreviewUpdate && (
                <div
                    onClick={() => setSelectedPreviewUpdate(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 10000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#1e293b', border: '1px solid var(--accent-gold)', borderRadius: '12px',
                            width: '100%', maxWidth: '560px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.1rem' }}>
                                📝 {t('linkedEntryPreview')}
                            </h3>
                            <button onClick={() => setSelectedPreviewUpdate(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <img src={selectedPreviewUpdate.author_avatar || '/logowebp/anon.webp'} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--accent-gold)' }} />
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedPreviewUpdate.author_rank} {selectedPreviewUpdate.author_name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(selectedPreviewUpdate.created_at).toLocaleString()}</div>
                            </div>
                        </div>

                        <div
                            className="quill-content"
                            style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', color: 'var(--text-primary)', maxHeight: '300px', overflowY: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: selectedPreviewUpdate.content }}
                        />

                        {(selectedPreviewUpdate.images && selectedPreviewUpdate.images.length > 0) ? (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                {selectedPreviewUpdate.images.map((img, i) => (
                                    <img key={i} src={img} alt="Evidence" style={{ height: '90px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} onClick={() => setExpandedImage(img)} />
                                ))}
                            </div>
                        ) : selectedPreviewUpdate.image ? (
                            <div style={{ marginBottom: '1rem' }}>
                                <img src={selectedPreviewUpdate.image} alt="Evidence" style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} onClick={() => setExpandedImage(selectedPreviewUpdate.image)} />
                            </div>
                        ) : null}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setSelectedPreviewUpdate(null)} style={{ width: 'auto' }}>
                                {t('closeBtnText')}
                            </button>
                            {onGoToUpdate && (
                                <button
                                    className="login-button"
                                    onClick={() => {
                                        const upId = selectedPreviewUpdate.id;
                                        setSelectedPreviewUpdate(null);
                                        onGoToUpdate(upId);
                                    }}
                                    style={{ width: 'auto' }}
                                >
                                    {t('viewInLogBtn')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Fullscreen Image View */}
            {expandedImage && (
                <div
                    onClick={() => setExpandedImage(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2rem'
                    }}
                >
                    <img src={expandedImage} alt="Enlarged evidence" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 0 30px rgba(0,0,0,0.9)' }} />
                </div>
            )}
        </div>
    );
}

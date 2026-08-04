import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
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

export default function CaseWhiteboard({ caseId, isIA = false, caseData = null }) {
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

    // Link Creation State
    const [connectingSourceId, setConnectingSourceId] = useState(null);
    const [showLinkLabelModal, setShowLinkLabelModal] = useState(false);
    const [pendingTargetId, setPendingTargetId] = useState(null);
    const [newLinkLabel, setNewLinkLabel] = useState('');

    // Modal State (Add/Edit Node)
    const [showNodeModal, setShowNodeModal] = useState(false);
    const [editingNode, setEditingNode] = useState(null);
    const [nodeTitle, setNodeTitle] = useState('');
    const [nodeContent, setNodeContent] = useState('');
    const [nodeCategory, setNodeCategory] = useState('note');
    const [nodeColor, setNodeColor] = useState('red');
    const [nodeImage, setNodeImage] = useState('');
    const [submittingNode, setSubmittingNode] = useState(false);

    // Image Viewer Modal
    const [expandedImage, setExpandedImage] = useState(null);

    // Debounce save for node positions
    const positionSaveTimeoutsRef = useRef({});

    // Load Board Data
    const loadBoardData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_case_board_data', {
                p_case_id: caseId,
                p_is_ia: isIA
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
                const column = isIA ? 'ia_case_id' : 'case_id';
                const { data: nData } = await supabase.from('case_board_nodes').select('*').eq(column, caseId);
                const { data: lData } = await supabase.from('case_board_links').select('*').eq(column, caseId);
                setNodes(nData || []);
                setLinks(lData || []);
            } catch (fallbackErr) {
                console.error('Fallback query error:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    }, [caseId, isIA]);

    useEffect(() => {
        if (caseId) loadBoardData();
    }, [caseId, loadBoardData]);

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

    // Handle Card Drag Start
    const handleNodeMouseDown = (e, nodeId) => {
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
            if (draggingNodeId) {
                const newX = e.clientX / zoom - dragOffsetRef.current.x;
                const newY = e.clientY / zoom - dragOffsetRef.current.y;

                setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, pos_x: newX, pos_y: newY } : n));
                saveNodePosition(draggingNodeId, newX, newY);
            } else if (isPanning) {
                setPan({
                    x: e.clientX - panStartRef.current.x,
                    y: e.clientY - panStartRef.current.y
                });
            }
        };

        const handleMouseUp = () => {
            if (draggingNodeId) setDraggingNodeId(null);
            if (isPanning) setIsPanning(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingNodeId, isPanning, zoom]);

    // Handle Pan Canvas
    const handleBoardMouseDown = (e) => {
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

    // Handle Wheel Zoom
    const handleWheel = (e) => {
        if (e.target.closest('.whiteboard-card')) return;
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom(z => Math.min(Math.max(0.3, z * zoomFactor), 2.0));
    };

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
        } else {
            setEditingNode(null);
            setNodeTitle('');
            setNodeContent('');
            setNodeCategory('note');
            setNodeColor('red');
            setNodeImage('');
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

            const payload = {
                title: nodeTitle.trim(),
                content: nodeContent.trim(),
                category: nodeCategory,
                color: nodeColor,
                image_url: nodeImage || null,
                created_by: user ? user.id : null
            };

            if (isIA) {
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
                color: '#ef4444'
            };

            if (isIA) {
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

    // Import Evidence & Updates from caseData
    const handleImportCaseEvidence = async () => {
        if (!caseData) return alert("Case data not available.");

        const existingTitles = new Set(nodes.map(n => n.title.toLowerCase()));
        const itemsToInsert = [];
        const { data: { user } } = await supabase.auth.getUser();

        let posX = 100;
        let posY = 100;

        // 1. Initial report image if available
        if (caseData.info?.initial_image_url && !existingTitles.has('escena inicial / foto clave')) {
            itemsToInsert.push({
                [isIA ? 'ia_case_id' : 'case_id']: caseId,
                title: 'Escena Inicial / Foto Clave',
                content: caseData.info.title || 'Evidencia principal registrada al abrir el caso.',
                category: 'evidence',
                color: 'red',
                image_url: caseData.info.initial_image_url,
                pos_x: posX,
                pos_y: posY,
                created_by: user ? user.id : null
            });
            posX += 280;
        }

        // 2. Updates with images or key info
        if (caseData.updates && caseData.updates.length > 0) {
            caseData.updates.forEach((upd, idx) => {
                const titleStr = `Novedad #${idx + 1} (${upd.author_name || 'Agente'})`;
                if (!existingTitles.has(titleStr.toLowerCase())) {
                    const img = (upd.images && upd.images.length > 0) ? upd.images[0] : upd.image || null;
                    itemsToInsert.push({
                        [isIA ? 'ia_case_id' : 'case_id']: caseId,
                        title: titleStr,
                        content: upd.content ? upd.content.replace(/<[^>]*>?/gm, '').slice(0, 150) : '',
                        category: img ? 'evidence' : 'note',
                        color: img ? 'yellow' : 'blue',
                        image_url: img,
                        pos_x: posX,
                        pos_y: posY,
                        created_by: user ? user.id : null
                    });
                    posX += 280;
                    if (posX > 900) {
                        posX = 100;
                        posY += 280;
                    }
                }
            });
        }

        // 3. Interrogations
        if (caseData.interrogations && caseData.interrogations.length > 0) {
            caseData.interrogations.forEach((inter) => {
                const titleStr = `Interrogatorio: ${inter.suspect_name || inter.title || 'Declaración'}`;
                if (!existingTitles.has(titleStr.toLowerCase())) {
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

    // Handle Image File Upload in Node Form
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (ev) => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 600;
                const scale = img.width > MAX_W ? MAX_W / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                setNodeImage(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
    };

    if (loading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-gold)' }}>🕵️ Cargando Pizarra de Investigación...</div>;
    }

    return (
        <div className="case-whiteboard-wrapper" style={{ position: 'relative', width: '100%', minHeight: '750px', height: 'calc(100vh - 220px)', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', userSelect: 'none' }}>

            {/* Top Bar Controls */}
            <div className="whiteboard-controls" style={{
                position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)',
                padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📌 {t('whiteboardTab')}
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
                        title="Importar evidencias y fotos registradas en el caso"
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
                            {language === 'es' ? '💡 Usa ' : '💡 Use '} <strong>🔗</strong> {language === 'es' ? 'en una tarjeta para unila con otra' : 'on a card to connect it'}
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
                ref={boardRef}
                onMouseDown={handleBoardMouseDown}
                onWheel={handleWheel}
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

                    {/* SVG Connector Strings Layer - Large viewBox covering infinite space */}
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
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.6" />
                            </filter>
                        </defs>

                        {links.map((link) => {
                            const source = nodes.find(n => n.id === link.source_id);
                            const target = nodes.find(n => n.id === link.target_id);
                            if (!source || !target) return null;

                            const sW = source.width || 240;
                            const tW = target.width || 240;

                            // Pin center at top of card (pos_y - 2px offset)
                            const x1 = source.pos_x + sW / 2;
                            const y1 = source.pos_y - 2;
                            const x2 = target.pos_x + tW / 2;
                            const y2 = target.pos_y - 2;

                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            // Natural hanging thread curve sagging downwards
                            const sag = Math.min(dist * 0.1, 45);
                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2 + sag;

                            return (
                                <g key={link.id}>
                                    {/* Curved Red Thread Line */}
                                    <path
                                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                                        stroke={link.color || '#ef4444'}
                                        strokeWidth="2.5"
                                        fill="none"
                                        strokeDasharray={link.style === 'dashed' ? '6,4' : 'none'}
                                        filter="url(#string-glow)"
                                    />
                                    {/* String Pins */}
                                    <circle cx={x1} cy={y1} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                                    <circle cx={x2} cy={y2} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />

                                    {/* Label Badge on Thread */}
                                    <foreignObject x={midX - 70} y={midY - 14} width="140" height="28" style={{ pointerEvents: 'auto' }}>
                                        <div
                                            onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }}
                                            title="Clic para eliminar conexión"
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.95)', color: 'white', fontSize: '0.7rem', fontWeight: 'bold',
                                                padding: '2px 8px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                                                border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                            }}
                                        >
                                            <span>{link.label || '🧵'}</span>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>×</span>
                                        </div>
                                    </foreignObject>
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
                                    border: `2px solid ${isSource ? '#ef4444' : scheme.border}`,
                                    borderRadius: '8px',
                                    boxShadow: isSource ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 8px 24px rgba(0, 0, 0, 0.6)',
                                    zIndex: isSource ? 15 : draggingNodeId === node.id ? 10 : 2,
                                    transition: draggingNodeId === node.id ? 'none' : 'box-shadow 0.2s',
                                    cursor: connectingSourceId ? 'pointer' : 'move'
                                }}
                            >
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
                        width: '100%', maxWidth: '480px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
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

            {/* Modal: Link Label Input */}
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
                                    {language === 'es' ? 'Texto de relación entre tarjetas (Opcional):' : 'Relationship label (Optional):'}
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

            {/* Modal: Fullscreen Image View */}
            {expandedImage && (
                <div
                    onClick={() => setExpandedImage(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2rem'
                    }}
                >
                    <img src={expandedImage} alt="Enlarged evidence" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 0 30px rgba(0,0,0,0.9)' }} />
                </div>
            )}
        </div>
    );
}

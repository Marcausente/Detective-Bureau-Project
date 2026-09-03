import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { uploadImageToStorage } from '../../utils/imageStorage';
import { useLanguage } from '../../contexts/LanguageContext';

// Sleek vector SVG icon system replacing all emojis
const BoardIcon = ({ name, size = 14, color = 'currentColor', style = {} }) => {
    const s = {
        width: size,
        height: size,
        stroke: color,
        fill: 'none',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style
    };

    switch (name) {
        case 'pin':
            return <svg style={s} viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-2l-2-2V5h1V3H6v2h1v8l-2 2v2z" /></svg>;
        case 'move':
            return <svg style={s} viewBox="0 0 24 24"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>;
        case 'pencil':
            return <svg style={s} viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>;
        case 'eraser':
            return <svg style={s} viewBox="0 0 24 24"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>;
        case 'image':
            return <svg style={s} viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>;
        case 'plus':
            return <svg style={s} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
        case 'todo':
            return <svg style={s} viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="m9 14 2 2 4-4" /></svg>;
        case 'timeline':
        case 'clock':
            return <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
        case 'folder':
            return <svg style={s} viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
        case 'link':
            return <svg style={s} viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
        case 'target':
            return <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
        case 'trash':
            return <svg style={s} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
        case 'edit':
            return <svg style={s} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
        case 'lock':
            return <svg style={s} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
        case 'unlock':
            return <svg style={s} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>;
        case 'search':
            return <svg style={s} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
        case 'user':
            return <svg style={s} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
        case 'mapPin':
            return <svg style={s} viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
        case 'car':
            return <svg style={s} viewBox="0 0 24 24"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H7.5a1 1 0 0 0-.8.4L4 11l-5.16.86a1 1 0 0 0-.84.99V16h3m14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" /></svg>;
        case 'eye':
            return <svg style={s} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
        case 'note':
            return <svg style={s} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
        case 'arrow':
            return <svg style={s} viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
        case 'line':
            return <svg style={s} viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" /></svg>;
        case 'rectangle':
            return <svg style={s} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>;
        case 'circle':
            return <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>;
        case 'free':
            return <svg style={s} viewBox="0 0 24 24"><path d="M3 12c3-4 6 4 9 0s6 4 9 0" /></svg>;
        case 'check':
            return <svg style={s} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>;
        case 'close':
            return <svg style={s} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
        case 'copy':
            return <svg style={s} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
        case 'chevronUp':
            return <svg style={s} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>;
        case 'chevronDown':
            return <svg style={s} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>;
        default:
            return null;
    }
};

const CATEGORY_CONFIG = {
    suspect: { label: 'categorySuspect', iconName: 'user', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5' },
    evidence: { label: 'categoryEvidence', iconName: 'search', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fde68a' },
    location: { label: 'categoryLocation', iconName: 'mapPin', bg: 'rgba(20, 184, 166, 0.15)', border: '#14b8a6', text: '#99f6e4' },
    vehicle: { label: 'categoryVehicle', iconName: 'car', bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#e9d5ff' },
    witness: { label: 'categoryWitness', iconName: 'eye', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#a7f3d0' },
    victim: { label: 'categoryVictim', iconName: 'target', bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fecdd3' },
    note: { label: 'categoryNote', iconName: 'note', bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fef08a' },
    todo: { label: 'categoryTodo', iconName: 'todo', bg: 'rgba(15, 23, 42, 0.95)', border: 'rgba(56, 189, 248, 0.4)', text: '#38bdf8' },
    timeline: { label: 'categoryTimeline', iconName: 'timeline', bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#fbcfe8' },
    image: { label: 'addImageBtn', iconName: 'image', bg: 'rgba(15, 23, 42, 0.85)', border: '#3b82f6', text: '#93c5fd' },
    drawing: { label: 'pencilToolBtn', iconName: 'pencil', bg: 'transparent', border: '#ef4444', text: '#ffffff' }
};

const COLOR_SCHEMES = {
    red: { bg: '#2b1418', border: '#7f1d1d', header: '#991b1b', text: '#fca5a5' },
    yellow: { bg: '#2e2714', border: '#713f12', header: '#854d0e', text: '#fef08a' },
    blue: { bg: '#131e33', border: '#1e3a8a', header: '#1e40af', text: '#bfdbfe' },
    green: { bg: '#11291f', border: '#064e3b', header: '#065f46', text: '#a7f3d0' },
    purple: { bg: '#251533', border: '#581c87', header: '#6b21a8', text: '#e9d5ff' },
    pink: { bg: '#331526', border: '#831843', header: '#9d174d', text: '#fbcfe8' },
    dark: { bg: '#18181b', border: '#3f3f46', header: '#27272a', text: '#e4e4e7' }
};

export default function CaseWhiteboard({ caseId = null, isIA = false, isGang = false, gangId = null, caseData = null, onGoToUpdate = null }) {
    const { t, language } = useLanguage();
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingStatus, setSavingStatus] = useState('saved'); // 'saved', 'saving', 'error'

    // Interactive Tool Modes: 'move' | 'pencil' | 'eraser'
    const [toolMode, setToolMode] = useState('move');

    // Canvas pan & zoom state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const boardRef = useRef(null);

    // Selection & Element Dragging / Resizing State
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef({ x: 0, y: 0, initW: 320, initH: 240 });

    // Pencil & Shape Drawing State
    const [pencilShape, setPencilShape] = useState('free'); // 'free' | 'line' | 'arrow' | 'rectangle' | 'circle'
    const [pencilColor, setPencilColor] = useState('#ef4444');
    const [pencilWidth, setPencilWidth] = useState(4);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);

    // Direct Image Upload Ref
    const imageFileInputRef = useRef(null);

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
    const [nodeLinkedUpdates, setNodeLinkedUpdates] = useState([]);
    const [nodeIsInactive, setNodeIsInactive] = useState(false);
    const [submittingNode, setSubmittingNode] = useState(false);

    // Import To-Do Modal State
    const [showImportTodoModal, setShowImportTodoModal] = useState(false);
    const [todoCategories, setTodoCategories] = useState([]);
    const [loadingTodos, setLoadingTodos] = useState(false);
    const [selectedTodoCategoryIds, setSelectedTodoCategoryIds] = useState([]);
    const [selectedTodoTaskIds, setSelectedTodoTaskIds] = useState([]);

    // Timeline Modal State (Single cohesive card widget matching reference)
    const [showTimelineModal, setShowTimelineModal] = useState(false);
    const [timelineItems, setTimelineItems] = useState([]);
    const [editingTimelineItemIndex, setEditingTimelineItemIndex] = useState(null);
    const [timelineDateInput, setTimelineDateInput] = useState('');
    const [timelineTimeInput, setTimelineTimeInput] = useState('');
    const [timelineTextInput, setTimelineTextInput] = useState('');
    const [activeTimelineNodeId, setActiveTimelineNodeId] = useState(null);

    // Preview Modal for Linked Update
    const [selectedPreviewUpdate, setSelectedPreviewUpdate] = useState(null);

    // Image Viewer Modal
    const [expandedImage, setExpandedImage] = useState(null);

    // Debounce save for node positions & dimensions
    const positionSaveTimeoutsRef = useRef({});

    const targetId = isGang ? gangId : caseId;

    // Helper: parse extra JSON metadata stored in node content
    const parseNodeExtra = (node) => {
        if (!node || !node.content) return {};
        try {
            if (typeof node.content === 'string' && node.content.startsWith('{') && node.content.endsWith('}')) {
                return JSON.parse(node.content);
            }
        } catch { }
        return {};
    };

    // Helper: convert Points Array to SVG Path String
    const pointsToSvgPath = (pts) => {
        if (!pts || pts.length === 0) return '';
        return pts.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
    };

    // Helper: convert Screen Client Coords to Canvas Board Coords
    const getCanvasCoordinates = useCallback((e) => {
        const rect = boardRef.current ? boardRef.current.getBoundingClientRect() : { left: 0, top: 0 };
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom
        };
    }, [pan, zoom]);

    // Load Board Data (and sync live To-Do status)
    const loadBoardData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_case_board_data', {
                p_case_id: isGang ? null : caseId,
                p_is_ia: isIA,
                p_gang_id: isGang ? gangId : null
            });

            if (error) throw error;

            let loadedNodes = [];
            let loadedLinks = [];

            if (data) {
                loadedNodes = data.nodes || [];
                loadedLinks = data.links || [];
            } else {
                const column = isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id';
                const { data: nData } = await supabase.from('case_board_nodes').select('*').eq(column, targetId);
                const { data: lData } = await supabase.from('case_board_links').select('*').eq(column, targetId);
                loadedNodes = nData || [];
                loadedLinks = lData || [];
            }

            // Sync live status of To-Do items from the database
            try {
                let liveTodos = [];
                if (isGang) {
                    const { data: gData } = await supabase.rpc('get_gang_todos');
                    if (gData) liveTodos = gData;
                } else if (isIA) {
                    const { data: iaData } = await supabase.rpc('get_ia_case_todos', { p_case_id: caseId });
                    if (iaData) liveTodos = iaData;
                } else if (caseId) {
                    const { data: cData } = await supabase.rpc('get_case_todos', { p_case_id: caseId });
                    if (cData) liveTodos = cData;
                }

                if (liveTodos.length > 0) {
                    const taskMap = new Map();
                    liveTodos.forEach(cat => {
                        (cat.tasks || []).forEach(t => {
                            taskMap.set(t.id, t);
                        });
                    });

                    loadedNodes = loadedNodes.map(node => {
                        if (node.category === 'todo') {
                            const extra = parseNodeExtra(node);
                            if (Array.isArray(extra.tasks) && extra.tasks.length > 0) {
                                let changed = false;
                                const updatedTasks = extra.tasks.map(t => {
                                    const live = taskMap.get(t.id);
                                    if (live && live.is_completed !== t.is_completed) {
                                        changed = true;
                                        return { ...t, is_completed: live.is_completed, content: live.content || t.content };
                                    }
                                    return t;
                                });
                                if (changed) {
                                    extra.tasks = updatedTasks;
                                    return { ...node, content: JSON.stringify(extra) };
                                }
                            }
                        }
                        return node;
                    });
                }
            } catch (syncErr) {
                console.warn('Could not sync live todos with board:', syncErr);
            }

            setNodes(loadedNodes);
            setLinks(loadedLinks);
        } catch (err) {
            console.error('Error loading whiteboard data:', err);
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
        }, 400);
    };

    // Save Node Dimension (Width/Height) in Database (Debounced)
    const saveNodeDimensions = (nodeId, width, height) => {
        setSavingStatus('saving');
        const timeoutKey = 'dim_' + nodeId;
        if (positionSaveTimeoutsRef.current[timeoutKey]) {
            clearTimeout(positionSaveTimeoutsRef.current[timeoutKey]);
        }

        positionSaveTimeoutsRef.current[timeoutKey] = setTimeout(async () => {
            try {
                const targetNode = nodes.find(n => n.id === nodeId);
                const extra = parseNodeExtra(targetNode);
                extra.height = Math.round(height);

                const updatePayload = { width: Math.round(width) };
                if (targetNode?.category === 'image' || targetNode?.category === 'drawing' || targetNode?.category === 'todo') {
                    updatePayload.content = JSON.stringify(extra);
                }

                const { error } = await supabase
                    .from('case_board_nodes')
                    .update(updatePayload)
                    .eq('id', nodeId);

                if (error) throw error;
                setSavingStatus('saved');
            } catch (err) {
                console.error('Error saving node dimensions:', err);
                setSavingStatus('error');
            }
        }, 400);
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
        }, 400);
    };

    // Global Paste Listener to Paste Images Directly onto Whiteboard
    useEffect(() => {
        const handleGlobalPaste = async (e) => {
            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            if (!items) return;

            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    if (file) {
                        try {
                            setSavingStatus('saving');
                            const folder = isGang ? 'gangs' : 'whiteboards';
                            const publicUrl = await uploadImageToStorage(file, folder);
                            if (publicUrl) {
                                const { data: { user } } = await supabase.auth.getUser();
                                const posX = Math.max(60, Math.round((400 - pan.x) / zoom));
                                const posY = Math.max(60, Math.round((300 - pan.y) / zoom));

                                const payload = {
                                    [isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id']: targetId,
                                    title: 'Captura / Imagen',
                                    category: 'image',
                                    image_url: publicUrl,
                                    color: 'dark',
                                    width: 340,
                                    content: JSON.stringify({ height: 260, isLocked: false }),
                                    pos_x: posX,
                                    pos_y: posY,
                                    created_by: user ? user.id : null
                                };

                                const { data: newNode, error } = await supabase
                                    .from('case_board_nodes')
                                    .insert([payload])
                                    .select()
                                    .single();

                                if (error) throw error;
                                if (newNode) {
                                    setNodes(prev => [...prev, newNode]);
                                    setSelectedNodeId(newNode.id);
                                }
                                setSavingStatus('saved');
                            }
                        } catch (err) {
                            console.error('Error pasting image to whiteboard:', err);
                            setSavingStatus('error');
                        }
                    }
                }
            }
        };

        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
    }, [pan, zoom, isGang, isIA, targetId]);

    // Save Finish Drawing to Database
    const handleFinishDrawing = async (points) => {
        if (!points || points.length < 2) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.round(Math.min(...xs));
            const minY = Math.round(Math.min(...ys));
            const maxX = Math.round(Math.max(...xs));
            const maxY = Math.round(Math.max(...ys));

            const payload = {
                [isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id']: targetId,
                title: `Trazo: ${pencilShape}`,
                category: 'drawing',
                color: pencilColor,
                width: Math.max(20, maxX - minX),
                content: JSON.stringify({
                    shape: pencilShape,
                    strokeWidth: pencilWidth,
                    points: points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
                    height: Math.max(20, maxY - minY),
                    isLocked: false
                }),
                pos_x: minX,
                pos_y: minY,
                created_by: user ? user.id : null
            };

            const { data: newNode, error } = await supabase
                .from('case_board_nodes')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            if (newNode) {
                setNodes(prev => [...prev, newNode]);
            }
        } catch (err) {
            console.error('Error saving drawn stroke:', err);
        }
    };

    // Direct Image Upload File Picker Handler
    const handleDirectImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setSavingStatus('saving');
            const folder = isGang ? 'gangs' : 'whiteboards';
            const publicUrl = await uploadImageToStorage(file, folder);
            if (publicUrl) {
                const { data: { user } } = await supabase.auth.getUser();
                const posX = Math.max(60, Math.round((400 - pan.x) / zoom));
                const posY = Math.max(60, Math.round((300 - pan.y) / zoom));

                const payload = {
                    [isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id']: targetId,
                    title: file.name ? file.name.slice(0, 40) : 'Imagen',
                    category: 'image',
                    image_url: publicUrl,
                    color: 'dark',
                    width: 340,
                    content: JSON.stringify({ height: 260, isLocked: false }),
                    pos_x: posX,
                    pos_y: posY,
                    created_by: user ? user.id : null
                };

                const { data: newNode, error } = await supabase
                    .from('case_board_nodes')
                    .insert([payload])
                    .select()
                    .single();

                if (error) throw error;
                if (newNode) {
                    setNodes(prev => [...prev, newNode]);
                    setSelectedNodeId(newNode.id);
                }
                setSavingStatus('saved');
            }
        } catch (err) {
            console.error('Error uploading image to board:', err);
            alert('Error subiendo imagen: ' + err.message);
            setSavingStatus('error');
        } finally {
            if (imageFileInputRef.current) imageFileInputRef.current.value = '';
        }
    };

    // Card / Element Drag Start
    const handleNodeMouseDown = (e, nodeId) => {
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            return;
        }

        e.stopPropagation();

        if (toolMode === 'eraser') {
            handleDeleteNode(nodeId, '', true);
            return;
        }

        if (connectingSourceId) {
            if (connectingSourceId !== nodeId) {
                setPendingTargetId(nodeId);
                setShowLinkLabelModal(true);
            }
            return;
        }

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        setSelectedNodeId(nodeId);

        const extra = parseNodeExtra(node);
        if (!extra.isLocked) {
            setDraggingNodeId(nodeId);
            dragOffsetRef.current = {
                x: e.clientX / zoom - node.pos_x,
                y: e.clientY / zoom - node.pos_y
            };
        }
    };

    // Corner Resizing Start (For Images & Cards)
    const handleResizeMouseDown = (e, nodeId) => {
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        const extra = parseNodeExtra(node);
        const currentH = extra.height || (node.category === 'image' ? 260 : 200);

        setIsResizing(true);
        setSelectedNodeId(nodeId);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            initW: node.width || 320,
            initH: currentH
        };
    };

    // Global Mouse Move & Mouse Up listeners
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isPanning || (e.buttons & 4) !== 0) {
                if ((e.buttons & 4) !== 0 && !isPanning) {
                    setIsPanning(true);
                    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
                }
                if (isPanning) {
                    setPan({
                        x: e.clientX - panStartRef.current.x,
                        y: e.clientY - panStartRef.current.y
                    });
                    return;
                }
            }

            // Pencil Active Stroke Dragging
            if (isDrawing && toolMode === 'pencil') {
                const { x, y } = getCanvasCoordinates(e);
                if (pencilShape === 'free') {
                    setCurrentPoints(prev => [...prev, { x, y }]);
                } else {
                    setCurrentPoints(prev => [prev[0] || { x, y }, { x, y }]);
                }
                return;
            }

            // Resizing Element (Width & Height)
            if (isResizing && selectedNodeId) {
                const dx = (e.clientX - resizeStartRef.current.x) / zoom;
                const dy = (e.clientY - resizeStartRef.current.y) / zoom;
                const newW = Math.max(120, Math.round(resizeStartRef.current.initW + dx));
                const newH = Math.max(80, Math.round(resizeStartRef.current.initH + dy));

                setNodes(prev => prev.map(n => {
                    if (n.id === selectedNodeId) {
                        const extra = parseNodeExtra(n);
                        extra.height = newH;
                        return {
                            ...n,
                            width: newW,
                            content: (n.category === 'image' || n.category === 'drawing' || n.category === 'todo') ? JSON.stringify(extra) : n.content
                        };
                    }
                    return n;
                }));

                saveNodeDimensions(selectedNodeId, newW, newH);
                return;
            }

            // Dragging Cards / Images
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

        const handleMouseUp = () => {
            if (isPanning) setIsPanning(false);
            if (draggingNodeId) setDraggingNodeId(null);
            if (draggingLinkId) setDraggingLinkId(null);
            if (isResizing) setIsResizing(false);

            if (isDrawing && toolMode === 'pencil') {
                setIsDrawing(false);
                if (currentPoints.length >= 2) {
                    handleFinishDrawing(currentPoints);
                }
                setCurrentPoints([]);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingNodeId, draggingLinkId, isPanning, isResizing, isDrawing, toolMode, pencilShape, pencilColor, pencilWidth, currentPoints, selectedNodeId, zoom, pan, links, nodes, getCanvasCoordinates]);

    // Handle Pan Canvas or Start Drawing / Erasing
    const handleBoardMouseDown = (e) => {
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            return;
        }

        if (e.target.closest('.whiteboard-card') || e.target.closest('.whiteboard-controls') || e.target.closest('.whiteboard-hud')) {
            return;
        }

        if (connectingSourceId) {
            setConnectingSourceId(null);
            return;
        }

        const { x, y } = getCanvasCoordinates(e);

        if (toolMode === 'pencil') {
            setIsDrawing(true);
            setCurrentPoints([{ x, y }, { x, y }]);
            return;
        }

        if (toolMode === 'eraser') {
            setIsDrawing(true);
            return;
        }

        setSelectedNodeId(null);
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    // Handle Wheel Zoom (Native non-passive listener)
    const handleWheel = useCallback((e) => {
        if (e.target.closest('.whiteboard-card')) return;
        if (e.preventDefault) e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom(z => Math.min(Math.max(0.3, z * zoomFactor), 2.0));
    }, []);

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

        const newZoom = Math.min(Math.max(Math.min(boardWidth / contentW, boardHeight / contentH), 0.45), 1.2);
        setZoom(newZoom);
        setPan({
            x: (boardWidth - (minX + maxX) * newZoom) / 2,
            y: (boardHeight - (minY + maxY) * newZoom) / 2
        });
    };

    // Toggle Lock Position for Selected Element
    const handleToggleLockNode = async (nodeId) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const extra = parseNodeExtra(node);
        const newLockState = !extra.isLocked;
        extra.isLocked = newLockState;

        const updatedContent = (node.category === 'image' || node.category === 'drawing' || node.category === 'todo')
            ? JSON.stringify(extra)
            : (node.content || '');

        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, content: updatedContent } : n));

        try {
            await supabase.from('case_board_nodes').update({ content: updatedContent }).eq('id', nodeId);
        } catch (err) {
            console.error('Error toggling lock state:', err);
        }
    };

    // Duplicate Selected Node
    const handleDuplicateNode = async (nodeId) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const payload = {
                [isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id']: targetId,
                title: `${node.title} (Copia)`,
                content: node.content,
                category: node.category,
                color: node.color,
                image_url: node.image_url,
                width: node.width,
                pos_x: node.pos_x + 40,
                pos_y: node.pos_y + 40,
                linked_update_ids: node.linked_update_ids,
                created_by: user ? user.id : null
            };

            const { data: newNode, error } = await supabase
                .from('case_board_nodes')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            if (newNode) {
                setNodes(prev => [...prev, newNode]);
                setSelectedNodeId(newNode.id);
            }
        } catch (err) {
            alert('Error duplicating element: ' + err.message);
        }
    };

    // Clear All Freehand Drawings
    const handleClearAllDrawings = async () => {
        const drawingNodes = nodes.filter(n => n.category === 'drawing');
        if (drawingNodes.length === 0) return;
        if (!window.confirm(language === 'es' ? `¿Eliminar todos los ${drawingNodes.length} trazos y dibujos de la pizarra?` : `Delete all ${drawingNodes.length} drawings from whiteboard?`)) return;

        try {
            const drawingIds = drawingNodes.map(d => d.id);
            const { error } = await supabase.from('case_board_nodes').delete().in('id', drawingIds);
            if (error) throw error;
            setNodes(prev => prev.filter(n => n.category !== 'drawing'));
            if (selectedNodeId && drawingIds.includes(selectedNodeId)) setSelectedNodeId(null);
        } catch (err) {
            alert('Error clearing drawings: ' + err.message);
        }
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
    const handleDeleteNode = async (nodeId, title = '', skipConfirm = false) => {
        if (!skipConfirm && !window.confirm(`Delete "${title || 'item'}"?`)) return;
        try {
            const { error } = await supabase.from('case_board_nodes').delete().eq('id', nodeId);
            if (error) throw error;
            setNodes(prev => prev.filter(n => n.id !== nodeId));
            if (selectedNodeId === nodeId) setSelectedNodeId(null);
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

    // Interactive Two-Way To-Do Task Toggle (Synchronizes with DB case_todos/ia_case_todos/gang_todos)
    const handleToggleBoardTodoTask = async (nodeId, taskId, currentStatus) => {
        const newStatus = !currentStatus;

        // 1. Optimistically update local nodes state
        setNodes(prev => prev.map(n => {
            if (n.id === nodeId) {
                const extra = parseNodeExtra(n);
                if (Array.isArray(extra.tasks)) {
                    extra.tasks = extra.tasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t);
                    return {
                        ...n,
                        content: JSON.stringify(extra)
                    };
                }
            }
            return n;
        }));

        // 2. Call Supabase RPC / table update to sync the main To-Do tab
        if (taskId) {
            try {
                if (isIA) {
                    await supabase.rpc('toggle_ia_todo_task', { p_task_id: taskId, p_status: newStatus });
                } else if (isGang) {
                    await supabase.rpc('toggle_gang_todo_task', { p_task_id: taskId, p_status: newStatus });
                } else {
                    await supabase.rpc('toggle_todo_task', { p_task_id: taskId, p_status: newStatus });
                }
            } catch (rpcErr) {
                console.warn('RPC toggle failed, fallback to table update:', rpcErr);
                try {
                    const tbl = isIA ? 'ia_case_todos' : isGang ? 'gang_todos' : 'case_todos';
                    await supabase.from(tbl).update({ is_completed: newStatus }).eq('id', taskId);
                } catch (tblErr) {
                    console.error('Direct table update failed:', tblErr);
                }
            }
        }

        // 3. Persist updated node content in case_board_nodes
        try {
            const targetNode = nodes.find(n => n.id === nodeId);
            if (targetNode) {
                const extra = parseNodeExtra(targetNode);
                if (Array.isArray(extra.tasks)) {
                    extra.tasks = extra.tasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t);
                    await supabase.from('case_board_nodes').update({ content: JSON.stringify(extra) }).eq('id', nodeId);
                }
            }
        } catch (err) {
            console.error('Error saving updated todo node content:', err);
        }
    };

    // Legacy / Single Item Toggle
    const handleToggleLegacyTodoNode = async (e, node) => {
        e.stopPropagation();
        const isDone = node.content?.includes('[✓]') || node.color === 'green';
        const newDone = !isDone;

        let newContent = node.content || '';
        if (newContent.includes('[✓] Completada') || newContent.includes('[✓] Completado')) {
            newContent = newContent.replace(/\[✓\] Completad[ao]/g, '[ ] Pendiente');
        } else if (newContent.includes('[ ] Pendiente')) {
            newContent = newContent.replace(/\[ \]\s*Pendiente/g, '[✓] Completada');
        } else {
            newContent = `Estado: ${newDone ? '[✓] Completada' : '[ ] Pendiente'}\n${newContent}`;
        }

        const newColor = newDone ? 'green' : 'blue';

        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, color: newColor, content: newContent } : n));

        try {
            await supabase
                .from('case_board_nodes')
                .update({ color: newColor, content: newContent })
                .eq('id', node.id);
        } catch (err) {
            console.error('Error toggling legacy todo card on board:', err);
        }
    };

    // Open Import To-Do Modal
    const openImportTodoModal = async () => {
        try {
            setLoadingTodos(true);
            setShowImportTodoModal(true);
            let data = [];
            if (isGang) {
                const { data: gData, error } = await supabase.rpc('get_gang_todos');
                if (!error && gData) data = gData;
            } else if (isIA) {
                const { data: iaData, error } = await supabase.rpc('get_ia_case_todos', { p_case_id: caseId });
                if (!error && iaData) data = iaData;
            } else {
                const { data: cData, error } = await supabase.rpc('get_case_todos', { p_case_id: caseId });
                if (!error && cData) data = cData;
            }
            setTodoCategories(data || []);

            // Preselect all categories and tasks by default
            const catIds = (data || []).map(c => c.id);
            const taskIds = [];
            (data || []).forEach(cat => {
                (cat.tasks || []).forEach(t => taskIds.push(t.id));
            });
            setSelectedTodoCategoryIds(catIds);
            setSelectedTodoTaskIds(taskIds);
        } catch (err) {
            console.error('Error fetching todos for import:', err);
        } finally {
            setLoadingTodos(false);
        }
    };

    // Confirm Import Selected To-Dos to Board
    const handleImportSelectedTodos = async () => {
        if (selectedTodoTaskIds.length === 0) {
            alert(language === 'es' ? 'Selecciona al menos una tarea para importar.' : 'Select at least one task to import.');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const itemsToInsert = [];
        let curX = Math.max(80, (300 - pan.x) / zoom);
        let curY = Math.max(80, (200 - pan.y) / zoom);

        // Group by categories to create cohesive To-Do cards
        todoCategories.forEach(cat => {
            const catSelectedTasks = (cat.tasks || []).filter(task => selectedTodoTaskIds.includes(task.id));
            if (catSelectedTasks.length > 0) {
                itemsToInsert.push({
                    [isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id']: targetId,
                    title: cat.name,
                    content: JSON.stringify({
                        todo_category_id: cat.id,
                        category_name: cat.name,
                        tasks: catSelectedTasks.map(t => ({ id: t.id, content: t.content, is_completed: t.is_completed }))
                    }),
                    category: 'todo',
                    color: 'blue',
                    width: 320,
                    pos_x: curX,
                    pos_y: curY,
                    created_by: user ? user.id : null
                });
                curX += 340;
                if (curX > 1000) {
                    curX = 80;
                    curY += 260;
                }
            }
        });

        try {
            setLoading(true);
            const { error } = await supabase.from('case_board_nodes').insert(itemsToInsert);
            if (error) throw error;
            setShowImportTodoModal(false);
            loadBoardData();
        } catch (err) {
            alert('Error importing tasks: ' + err.message);
            setLoading(false);
        }
    };

    // Open Timeline Modal (Load existing unified timeline card or initialize clean sequence)
    const openTimelineModal = (existingNode = null) => {
        let nodeToEdit = existingNode;
        if (!nodeToEdit) {
            nodeToEdit = nodes.find(n => n.category === 'timeline');
        }

        if (nodeToEdit) {
            setActiveTimelineNodeId(nodeToEdit.id);
            const extra = parseNodeExtra(nodeToEdit);
            if (Array.isArray(extra.events) && extra.events.length > 0) {
                setTimelineItems(extra.events);
            } else {
                setTimelineItems([]);
            }
        } else {
            setActiveTimelineNodeId(null);
            setTimelineItems([
                { id: 'ev_1', date: '03/09', time: '14:15', text: 'Agentes Bradford y Whittaker acuden a la casa tras aviso.' },
                { id: 'ev_2', date: '03/09', time: '14:22', text: 'Encuentran a la víctima inconsciente con marcas en el cuello.' },
                { id: 'ev_3', date: '03/09', time: '14:25', text: 'Llega el facultativo Ryan Cross para atender a la víctima.' },
                { id: 'ev_4', date: '03/09', time: '14:30', text: 'Estabilización y traslado al centro médico más cercano.' },
                { id: 'ev_5', date: '04/09', time: 'Post', text: 'Notificación oficial al departamento de investigación criminal.' }
            ]);
        }

        setEditingTimelineItemIndex(null);
        setTimelineDateInput('');
        setTimelineTimeInput('');
        setTimelineTextInput('');
        setShowTimelineModal(true);
    };

    // Add or Update Single Timeline Event Item in the Modal
    const handleSaveTimelineItem = (e) => {
        if (e) e.preventDefault();
        if (!timelineTextInput.trim()) {
            alert(language === 'es' ? 'La descripción del suceso es obligatoria.' : 'Event description is required.');
            return;
        }

        const dateVal = timelineDateInput.trim();
        const timeVal = timelineTimeInput.trim() || (dateVal ? '' : '--:--');
        const textVal = timelineTextInput.trim();

        if (editingTimelineItemIndex !== null && editingTimelineItemIndex >= 0) {
            setTimelineItems(prev => {
                const next = [...prev];
                next[editingTimelineItemIndex] = {
                    ...next[editingTimelineItemIndex],
                    date: dateVal,
                    time: timeVal,
                    text: textVal
                };
                return next;
            });
            setEditingTimelineItemIndex(null);
        } else {
            const newItem = {
                id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                date: dateVal,
                time: timeVal,
                text: textVal
            };
            setTimelineItems(prev => [...prev, newItem]);
        }

        setTimelineDateInput('');
        setTimelineTimeInput('');
        setTimelineTextInput('');
    };

    const handleStartEditTimelineItem = (index) => {
        const item = timelineItems[index];
        if (!item) return;
        setEditingTimelineItemIndex(index);
        setTimelineDateInput(item.date || '');
        setTimelineTimeInput(item.time || '');
        setTimelineTextInput(item.text || '');
    };

    const handleDeleteTimelineItem = (index) => {
        setTimelineItems(prev => prev.filter((_, idx) => idx !== index));
        if (editingTimelineItemIndex === index) {
            setEditingTimelineItemIndex(null);
            setTimelineDateInput('');
            setTimelineTimeInput('');
            setTimelineTextInput('');
        }
    };

    const handleMoveTimelineItem = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= timelineItems.length) return;
        setTimelineItems(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[targetIndex];
            next[targetIndex] = temp;
            return next;
        });
    };

    // Save Unified Timeline Block to Whiteboard
    const handleSaveTimelineToBoard = async () => {
        if (timelineItems.length === 0) {
            alert(language === 'es' ? 'Añade al menos un suceso a la línea de tiempo.' : 'Add at least one event to the timeline.');
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            const existingTimelineNode = activeTimelineNodeId
                ? nodes.find(n => n.id === activeTimelineNodeId)
                : nodes.find(n => n.category === 'timeline');

            const contentJson = JSON.stringify({
                timeline_title: 'LÍNEA DE TIEMPO',
                events: timelineItems
            });

            if (existingTimelineNode) {
                const { error } = await supabase
                    .from('case_board_nodes')
                    .update({
                        content: contentJson,
                        title: 'LÍNEA DE TIEMPO'
                    })
                    .eq('id', existingTimelineNode.id);

                if (error) throw error;
            } else {
                const payload = {
                    [isGang ? 'gang_id' : isIA ? 'ia_case_id' : 'case_id']: targetId,
                    title: 'LÍNEA DE TIEMPO',
                    content: contentJson,
                    category: 'timeline',
                    color: 'blue',
                    width: 380,
                    pos_x: Math.max(80, (250 - pan.x) / zoom),
                    pos_y: Math.max(80, (180 - pan.y) / zoom),
                    created_by: user ? user.id : null
                };

                const { error } = await supabase.from('case_board_nodes').insert([payload]);
                if (error) throw error;
            }

            setShowTimelineModal(false);
            await loadBoardData();
        } catch (err) {
            alert('Error saving timeline: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Quick Delete Single Item directly from Whiteboard Timeline Card
    const handleQuickDeleteTimelineItem = async (nodeId, itemIndex) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const extra = parseNodeExtra(node);
        const currentEvents = Array.isArray(extra.events) ? extra.events : [];
        const updatedEvents = currentEvents.filter((_, idx) => idx !== itemIndex);
        extra.events = updatedEvents;

        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, content: JSON.stringify(extra) } : n));

        try {
            await supabase.from('case_board_nodes').update({ content: JSON.stringify(extra) }).eq('id', nodeId);
        } catch (err) {
            console.error('Error removing timeline item:', err);
        }
    };

    // Import Evidence & Updates from caseData or Gang Data
    const handleImportCaseEvidence = async () => {
        if (!caseData) return alert("Data not available.");

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

    // Handle Image File Upload in Node Form Modal
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

    const selectedElement = nodes.find(n => n.id === selectedNodeId);

    if (loading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-gold)' }}>🕵️ Cargando Pizarra de Investigación...</div>;
    }

    return (
        <div className="case-whiteboard-wrapper" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px', background: '#090d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', userSelect: 'none' }}>

            {/* Hidden Input for Direct Image Upload */}
            <input
                type="file"
                ref={imageFileInputRef}
                accept="image/*"
                onChange={handleDirectImageUpload}
                style={{ display: 'none' }}
            />

            {/* Top Bar Controls */}
            <div className="whiteboard-controls" style={{
                position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(16px)',
                padding: '0.65rem 1.2rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BoardIcon name="pin" size={16} color="var(--accent-gold)" />
                        <span>{isGang ? `Pizarra: ${caseData?.name || 'Gang Unit'}` : t('whiteboardTab')}</span>
                    </h3>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {savingStatus === 'saving' ? (
                            <>
                                <BoardIcon name="clock" size={11} color="var(--accent-gold)" />
                                <span>{t('savingBoardStatus')}</span>
                            </>
                        ) : savingStatus === 'saved' ? (
                            <>
                                <BoardIcon name="check" size={11} color="#4ade80" />
                                <span>{t('savedBoardStatus')}</span>
                            </>
                        ) : (
                            <>
                                <BoardIcon name="close" size={11} color="#ef4444" />
                                <span>Error</span>
                            </>
                        )}
                    </span>
                </div>

                {/* Primary Tool Mode Switcher & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {/* Tool Modes: Move / Pencil / Eraser */}
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', marginRight: '6px' }}>
                        <button
                            onClick={() => { setToolMode('move'); setSelectedNodeId(null); }}
                            style={{
                                background: toolMode === 'move' ? 'rgba(234, 179, 8, 0.3)' : 'transparent',
                                border: `1px solid ${toolMode === 'move' ? '#eab308' : 'transparent'}`,
                                color: toolMode === 'move' ? '#fef08a' : '#cbd5e1',
                                padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                            title="Modo Mover y Seleccionar Tarjetas"
                        >
                            <BoardIcon name="move" size={13} color={toolMode === 'move' ? '#fef08a' : '#cbd5e1'} />
                            <span>{t('moveModeBtn') || 'Mover'}</span>
                        </button>
                        <button
                            onClick={() => { setToolMode('pencil'); setSelectedNodeId(null); }}
                            style={{
                                background: toolMode === 'pencil' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                                border: `1px solid ${toolMode === 'pencil' ? '#ef4444' : 'transparent'}`,
                                color: toolMode === 'pencil' ? '#fca5a5' : '#cbd5e1',
                                padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                            title="Herramienta de Lápiz y Formas Tácticas"
                        >
                            <BoardIcon name="pencil" size={13} color={toolMode === 'pencil' ? '#fca5a5' : '#cbd5e1'} />
                            <span>{t('pencilToolBtn') || 'Lápiz y Formas'}</span>
                        </button>
                        <button
                            onClick={() => { setToolMode('eraser'); setSelectedNodeId(null); }}
                            style={{
                                background: toolMode === 'eraser' ? 'rgba(236, 72, 153, 0.3)' : 'transparent',
                                border: `1px solid ${toolMode === 'eraser' ? '#ec4899' : 'transparent'}`,
                                color: toolMode === 'eraser' ? '#fbcfe8' : '#cbd5e1',
                                padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                            title="Goma de Borrar: Haz clic en trazos o elementos para eliminarlos"
                        >
                            <BoardIcon name="eraser" size={13} color={toolMode === 'eraser' ? '#fbcfe8' : '#cbd5e1'} />
                            <span>{t('eraserToolBtn') || 'Goma de Borrar'}</span>
                        </button>
                    </div>

                    {/* Direct Image Upload Button */}
                    <button
                        onClick={() => imageFileInputRef.current?.click()}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.82rem', borderColor: '#3b82f6', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Subir imagen directamente al tablero (o presiona Ctrl+V para pegar captura)"
                    >
                        <BoardIcon name="image" size={13} color="#93c5fd" />
                        <span>{t('addImageBtn') || 'Añadir Imagen'}</span>
                    </button>

                    {/* New Card Modal Button */}
                    <button
                        onClick={() => openNodeModal(null)}
                        className="login-button"
                        style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <BoardIcon name="plus" size={13} />
                        <span>{t('newCardBtn')}</span>
                    </button>

                    {/* To-Do Import Button */}
                    <button
                        onClick={openImportTodoModal}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.82rem', borderColor: '#38bdf8', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Importar tareas del To-Do del caso"
                    >
                        <BoardIcon name="todo" size={13} color="#38bdf8" />
                        <span>{t('importTodoBtn') || 'Importar To-Do'}</span>
                    </button>

                    {/* Timeline Tool Button */}
                    <button
                        onClick={() => openTimelineModal()}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.82rem', borderColor: '#38bdf8', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Herramienta de Línea de Tiempo cronológica"
                    >
                        <BoardIcon name="timeline" size={13} color="#38bdf8" />
                        <span>{t('timelineToolBtn') || 'Línea de Tiempo'}</span>
                    </button>

                    {/* Import Case Evidence Button */}
                    <button
                        onClick={handleImportCaseEvidence}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Importar novedades y fotos registradas"
                    >
                        <BoardIcon name="folder" size={13} />
                        <span>{t('importEvidenceBtn')}</span>
                    </button>

                    {connectingSourceId ? (
                        <button
                            onClick={() => setConnectingSourceId(null)}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <BoardIcon name="close" size={12} color="#ffffff" />
                            <span>Cancelar Unión</span>
                        </button>
                    ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <BoardIcon name="link" size={12} color="var(--accent-gold)" />
                            <span>en tarjetas para unir</span>
                        </span>
                    )}

                    {/* Zoom & Fit controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '6px', background: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(2)))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', width: '20px' }}>-</button>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', minWidth: '36px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(1.8, +(z + 0.1).toFixed(2)))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', width: '20px' }}>+</button>
                        <button onClick={handleFitAll} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.72rem', marginLeft: '3px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <BoardIcon name="target" size={11} color="var(--accent-gold)" />
                            <span>Centrar</span>
                        </button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.72rem', marginLeft: '2px' }}>Reset</button>
                    </div>
                </div>
            </div>

            {/* Pencil Sub-Toolbar (Active when toolMode === 'pencil') */}
            {toolMode === 'pencil' && (
                <div style={{
                    position: 'absolute', top: 76, left: 16, right: 16, zIndex: 20,
                    background: 'rgba(15, 23, 42, 0.92)', border: '1px solid #ef4444',
                    borderRadius: '10px', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem',
                    backdropFilter: 'blur(16px)', boxShadow: '0 6px 20px rgba(0,0,0,0.5)'
                }}>
                    {/* Shapes Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: '#fca5a5', fontWeight: 700, marginRight: '0.2rem' }}>Forma:</span>
                        {[
                            { id: 'free', label: 'Libre', iconName: 'free', title: 'Mano Alzada' },
                            { id: 'line', label: 'Línea', iconName: 'line', title: 'Línea Recta' },
                            { id: 'arrow', label: 'Flecha', iconName: 'arrow', title: 'Flecha Táctica' },
                            { id: 'rectangle', label: 'Rectángulo', iconName: 'rectangle', title: 'Rectángulo / Caja' },
                            { id: 'circle', label: 'Círculo', iconName: 'circle', title: 'Círculo / Óvalo' }
                        ].map(s => (
                            <button
                                key={s.id}
                                onClick={() => setPencilShape(s.id)}
                                title={s.title}
                                style={{
                                    background: pencilShape === s.id ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                                    border: `1px solid ${pencilShape === s.id ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                                    color: pencilShape === s.id ? '#ffffff' : '#cbd5e1',
                                    padding: '0.25rem 0.55rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                                }}
                            >
                                <BoardIcon name={s.iconName} size={13} color={pencilShape === s.id ? '#ffffff' : '#cbd5e1'} />
                                <span>{s.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Color Dots & Width & Clear */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Color:</span>
                            {['#ef4444', '#eab308', '#3b82f6', '#22c55e', '#a855f7', '#ffffff'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setPencilColor(c)}
                                    style={{
                                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: c,
                                        border: pencilColor === c ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.3)',
                                        transform: pencilColor === c ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer', boxShadow: pencilColor === c ? `0 0 8px ${c}` : 'none'
                                    }}
                                />
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#cbd5e1', fontSize: '0.78rem' }}>
                            <span>Grosor:</span>
                            {[
                                { label: 'Fino', val: 2 },
                                { label: 'Medio', val: 4 },
                                { label: 'Grueso', val: 8 }
                            ].map(w => (
                                <button
                                    key={w.val}
                                    onClick={() => setPencilWidth(w.val)}
                                    style={{
                                        background: pencilWidth === w.val ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                                        border: `1px solid ${pencilWidth === w.val ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                                        color: pencilWidth === w.val ? '#ffffff' : '#cbd5e1',
                                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    {w.label}
                                </button>
                            ))}
                        </div>

                        {nodes.some(n => n.category === 'drawing') && (
                            <button
                                onClick={handleClearAllDrawings}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444',
                                    color: '#fca5a5', padding: '0.25rem 0.65rem', borderRadius: '5px',
                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <BoardIcon name="trash" size={12} color="#fca5a5" />
                                <span>Borrar Trazos ({nodes.filter(n => n.category === 'drawing').length})</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Eraser Tool Active Notice */}
            {toolMode === 'eraser' && (
                <div style={{
                    position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
                    background: 'rgba(236, 72, 153, 0.95)', color: 'white', padding: '0.35rem 1.2rem',
                    borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold', boxShadow: '0 4px 14px rgba(236, 72, 153, 0.5)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <BoardIcon name="eraser" size={14} color="#ffffff" />
                    <span>Modo Goma de Borrar: Haz clic sobre trazos, imágenes o tarjetas para eliminarlas</span>
                </div>
            )}

            {/* Connecting Active Banner */}
            {connectingSourceId && (
                <div style={{
                    position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 25,
                    background: 'rgba(239, 68, 68, 0.95)', color: 'white', padding: '0.35rem 1.2rem',
                    borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <BoardIcon name="link" size={14} color="#ffffff" />
                    <span>{t('connectingModeActive') || 'Modo conexión de hilos activo'}</span>
                </div>
            )}

            {/* Floating Selected Element Controls Bar (HUD) */}
            {selectedElement && toolMode === 'move' && (
                <div
                    className="whiteboard-hud"
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
                        background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(234, 179, 8, 0.5)',
                        borderRadius: '12px', padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center',
                        gap: '1.2rem', flexWrap: 'wrap', backdropFilter: 'blur(20px)',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.8), 0 0 16px rgba(234, 179, 8, 0.2)'
                    }}
                >
                    <div style={{ color: '#fef08a', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BoardIcon name="pin" size={13} color="#fef08a" />
                        <span>{selectedElement.title || selectedElement.category}</span>
                    </div>

                    {/* Width & Height Resizers */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>Ancho:</span>
                            <input
                                type="range"
                                min="120"
                                max="800"
                                value={selectedElement.width || 320}
                                onChange={e => {
                                    const newW = parseInt(e.target.value);
                                    setNodes(prev => prev.map(n => n.id === selectedElement.id ? { ...n, width: newW } : n));
                                    saveNodeDimensions(selectedElement.id, newW, parseNodeExtra(selectedElement).height || 240);
                                }}
                                style={{ accentColor: '#eab308', cursor: 'pointer', width: '80px' }}
                            />
                            <span>{selectedElement.width || 320}px</span>
                        </div>

                        {selectedElement.category === 'image' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>Alto:</span>
                                <input
                                    type="range"
                                    min="80"
                                    max="600"
                                    value={parseNodeExtra(selectedElement).height || 260}
                                    onChange={e => {
                                        const newH = parseInt(e.target.value);
                                        const extra = parseNodeExtra(selectedElement);
                                        extra.height = newH;
                                        setNodes(prev => prev.map(n => n.id === selectedElement.id ? { ...n, content: JSON.stringify(extra) } : n));
                                        saveNodeDimensions(selectedElement.id, selectedElement.width || 320, newH);
                                    }}
                                    style={{ accentColor: '#eab308', cursor: 'pointer', width: '80px' }}
                                />
                                <span>{parseNodeExtra(selectedElement).height || 260}px</span>
                            </div>
                        )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                            onClick={() => handleToggleLockNode(selectedElement.id)}
                            style={{
                                background: parseNodeExtra(selectedElement).isLocked ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                border: `1px solid ${parseNodeExtra(selectedElement).isLocked ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                color: parseNodeExtra(selectedElement).isLocked ? '#fef08a' : '#ffffff',
                                padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <BoardIcon name={parseNodeExtra(selectedElement).isLocked ? 'lock' : 'unlock'} size={12} />
                            <span>{parseNodeExtra(selectedElement).isLocked ? 'Fijado' : 'Fijar'}</span>
                        </button>

                        <button
                            onClick={() => handleDuplicateNode(selectedElement.id)}
                            style={{
                                background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6',
                                color: '#93c5fd', padding: '0.3rem 0.65rem', borderRadius: '6px',
                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <BoardIcon name="copy" size={12} color="#93c5fd" />
                            <span>Duplicar</span>
                        </button>

                        <button
                            onClick={() => setConnectingSourceId(selectedElement.id)}
                            style={{
                                background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444',
                                color: '#fca5a5', padding: '0.3rem 0.65rem', borderRadius: '6px',
                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <BoardIcon name="link" size={12} color="#fca5a5" />
                            <span>Conectar Hilo</span>
                        </button>

                        <button
                            onClick={() => handleDeleteNode(selectedElement.id, selectedElement.title)}
                            style={{
                                background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444',
                                color: '#fca5a5', padding: '0.3rem 0.65rem', borderRadius: '6px',
                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <BoardIcon name="trash" size={12} color="#fca5a5" />
                            <span>Eliminar</span>
                        </button>

                        <button
                            onClick={() => setSelectedNodeId(null)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '4px' }}
                        >
                            <BoardIcon name="close" size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Main Interactive Canvas Area */}
            <div
                ref={setBoardRef}
                onMouseDown={handleBoardMouseDown}
                style={{
                    width: '100%', height: '100%', minHeight: '750px',
                    cursor: toolMode === 'pencil' ? 'crosshair' : toolMode === 'eraser' ? 'cell' : isPanning ? 'grabbing' : 'grab',
                    position: 'relative',
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

                    {/* SVG Connector Strings & Drawings Layer */}
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

                        {/* Render Saved Links / Threads */}
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
                            const tPos = link.label_pos ?? 0.5;
                            const posX = (1 - tPos) * (1 - tPos) * x1 + 2 * (1 - tPos) * tPos * midX + tPos * tPos * x2;
                            const posY = (1 - tPos) * (1 - tPos) * y1 + 2 * (1 - tPos) * tPos * midY + tPos * tPos * y2;
                            const hasLabelText = link.label && link.label.trim().length > 0;

                            return (
                                <g key={link.id}>
                                    <path
                                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                                        stroke={isHovered ? '#f59e0b' : (link.color || '#ef4444')}
                                        strokeWidth={isHovered ? "3.5" : "2.5"}
                                        fill="none"
                                        strokeDasharray={link.style === 'dashed' ? '6,4' : 'none'}
                                        filter={isHovered ? "url(#string-hover-glow)" : "url(#string-glow)"}
                                    />

                                    <path
                                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                                        stroke="transparent"
                                        strokeWidth="18"
                                        fill="none"
                                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredLinkId(link.id)}
                                        onMouseLeave={() => setHoveredLinkId(null)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (toolMode === 'eraser') {
                                                handleDeleteLink(link.id);
                                            } else {
                                                setEditingLink(link);
                                                setEditLinkLabel(link.label || '');
                                            }
                                        }}
                                    />

                                    <circle cx={x1} cy={y1} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                                    <circle cx={x2} cy={y2} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />

                                    {hasLabelText ? (
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
                                                    title="Editar texto"
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
                                                    <span onClick={(e) => { e.stopPropagation(); setEditingLink(link); setEditLinkLabel(''); }}>
                                                        ✏️ Texto
                                                    </span>
                                                    <span onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }} style={{ color: '#ef4444' }}>
                                                        🗑️
                                                    </span>
                                                </div>
                                            </foreignObject>
                                        )
                                    )}
                                </g>
                            );
                        })}

                        {/* Render Saved Drawings & Shapes */}
                        {nodes.filter(n => n.category === 'drawing').map(drawNode => {
                            const extra = parseNodeExtra(drawNode);
                            const shape = extra.shape || 'free';
                            const pts = extra.points || [];
                            const color = drawNode.color || '#ef4444';
                            const strokeW = extra.strokeWidth || 3;
                            const isSelected = selectedNodeId === drawNode.id;

                            if (!pts || pts.length === 0) return null;

                            let shapeSvg = null;
                            if (shape === 'line' && pts.length >= 2) {
                                shapeSvg = (
                                    <line
                                        x1={pts[0].x} y1={pts[0].y}
                                        x2={pts[pts.length - 1].x} y2={pts[pts.length - 1].y}
                                        stroke={isSelected ? '#eab308' : color}
                                        strokeWidth={strokeW + (isSelected ? 2 : 0)}
                                        strokeLinecap="round"
                                    />
                                );
                            } else if (shape === 'arrow' && pts.length >= 2) {
                                const x1 = pts[0].x;
                                const y1 = pts[0].y;
                                const x2 = pts[pts.length - 1].x;
                                const y2 = pts[pts.length - 1].y;
                                const angle = Math.atan2(y2 - y1, x2 - x1);
                                const headLen = Math.max(14, strokeW * 3.5);
                                const ax1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
                                const ay1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
                                const ax2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
                                const ay2 = y2 - headLen * Math.sin(angle + Math.PI / 6);

                                shapeSvg = (
                                    <g>
                                        <line
                                            x1={x1} y1={y1} x2={x2} y2={y2}
                                            stroke={isSelected ? '#eab308' : color}
                                            strokeWidth={strokeW + (isSelected ? 2 : 0)}
                                            strokeLinecap="round"
                                        />
                                        <polygon
                                            points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
                                            fill={isSelected ? '#eab308' : color}
                                            stroke={isSelected ? '#eab308' : color}
                                            strokeWidth="1"
                                            strokeLinejoin="round"
                                        />
                                    </g>
                                );
                            } else if (shape === 'rectangle' && pts.length >= 2) {
                                const minX = Math.min(pts[0].x, pts[pts.length - 1].x);
                                const minY = Math.min(pts[0].y, pts[pts.length - 1].y);
                                const w = Math.abs(pts[pts.length - 1].x - pts[0].x);
                                const h = Math.abs(pts[pts.length - 1].y - pts[0].y);
                                shapeSvg = (
                                    <rect
                                        x={minX} y={minY} width={w} height={h}
                                        stroke={isSelected ? '#eab308' : color}
                                        strokeWidth={strokeW + (isSelected ? 2 : 0)}
                                        fill="none"
                                        rx="4"
                                    />
                                );
                            } else if (shape === 'circle' && pts.length >= 2) {
                                const cx = (pts[0].x + pts[pts.length - 1].x) / 2;
                                const cy = (pts[0].y + pts[pts.length - 1].y) / 2;
                                const rx = Math.abs(pts[pts.length - 1].x - pts[0].x) / 2;
                                const ry = Math.abs(pts[pts.length - 1].y - pts[0].y) / 2;
                                shapeSvg = (
                                    <ellipse
                                        cx={cx} cy={cy} rx={rx} ry={ry}
                                        stroke={isSelected ? '#eab308' : color}
                                        strokeWidth={strokeW + (isSelected ? 2 : 0)}
                                        fill="none"
                                    />
                                );
                            } else {
                                shapeSvg = (
                                    <path
                                        d={pointsToSvgPath(pts)}
                                        stroke={isSelected ? '#eab308' : color}
                                        strokeWidth={strokeW + (isSelected ? 2 : 0)}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                );
                            }

                            return (
                                <g
                                    key={drawNode.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (toolMode === 'eraser') {
                                            handleDeleteNode(drawNode.id, drawNode.title, true);
                                        } else if (toolMode === 'move') {
                                            setSelectedNodeId(drawNode.id);
                                        }
                                    }}
                                    onMouseEnter={() => {
                                        if (toolMode === 'eraser' && isDrawing) {
                                            handleDeleteNode(drawNode.id, drawNode.title, true);
                                        }
                                    }}
                                    style={{
                                        pointerEvents: 'auto',
                                        cursor: toolMode === 'eraser' ? 'cell' : toolMode === 'pencil' ? 'crosshair' : 'pointer',
                                        filter: isSelected ? 'drop-shadow(0 0 6px #eab308)' : 'none'
                                    }}
                                >
                                    {shapeSvg}
                                </g>
                            );
                        })}

                        {/* Live Active Drawing / Shape being drawn */}
                        {isDrawing && toolMode === 'pencil' && currentPoints.length >= 2 && (
                            <>
                                {pencilShape === 'line' ? (
                                    <line
                                        x1={currentPoints[0].x} y1={currentPoints[0].y}
                                        x2={currentPoints[currentPoints.length - 1].x} y2={currentPoints[currentPoints.length - 1].y}
                                        stroke={pencilColor} strokeWidth={pencilWidth} strokeLinecap="round"
                                    />
                                ) : pencilShape === 'arrow' ? (
                                    (() => {
                                        const x1 = currentPoints[0].x;
                                        const y1 = currentPoints[0].y;
                                        const x2 = currentPoints[currentPoints.length - 1].x;
                                        const y2 = currentPoints[currentPoints.length - 1].y;
                                        const angle = Math.atan2(y2 - y1, x2 - x1);
                                        const headLen = Math.max(14, pencilWidth * 3.5);
                                        const ax1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
                                        const ay1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
                                        const ax2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
                                        const ay2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
                                        return (
                                            <g>
                                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={pencilColor} strokeWidth={pencilWidth} strokeLinecap="round" />
                                                <polygon points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`} fill={pencilColor} stroke={pencilColor} strokeWidth="1" strokeLinejoin="round" />
                                            </g>
                                        );
                                    })()
                                ) : pencilShape === 'rectangle' ? (
                                    <rect
                                        x={Math.min(currentPoints[0].x, currentPoints[currentPoints.length - 1].x)}
                                        y={Math.min(currentPoints[0].y, currentPoints[currentPoints.length - 1].y)}
                                        width={Math.abs(currentPoints[currentPoints.length - 1].x - currentPoints[0].x)}
                                        height={Math.abs(currentPoints[currentPoints.length - 1].y - currentPoints[0].y)}
                                        stroke={pencilColor} strokeWidth={pencilWidth} fill="none" rx="4"
                                    />
                                ) : pencilShape === 'circle' ? (
                                    <ellipse
                                        cx={(currentPoints[0].x + currentPoints[currentPoints.length - 1].x) / 2}
                                        cy={(currentPoints[0].y + currentPoints[currentPoints.length - 1].y) / 2}
                                        rx={Math.abs(currentPoints[currentPoints.length - 1].x - currentPoints[0].x) / 2}
                                        ry={Math.abs(currentPoints[currentPoints.length - 1].y - currentPoints[0].y) / 2}
                                        stroke={pencilColor} strokeWidth={pencilWidth} fill="none"
                                    />
                                ) : (
                                    <path
                                        d={pointsToSvgPath(currentPoints)}
                                        stroke={pencilColor} strokeWidth={pencilWidth} fill="none" strokeLinecap="round" strokeLinejoin="round"
                                    />
                                )}
                            </>
                        )}
                    </svg>

                    {/* Empty State Banner */}
                    {nodes.length === 0 && (
                        <div style={{
                            position: 'absolute', top: '220px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(30, 41, 59, 0.7)', padding: '2rem', borderRadius: '12px',
                            border: '1px border dashed rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '420px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                                <BoardIcon name="search" size={36} color="var(--accent-gold)" />
                            </div>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-gold)' }}>{t('whiteboardTitle')}</h4>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('emptyBoardMessage')}</p>
                            <button
                                onClick={() => openNodeModal(null)}
                                className="login-button"
                                style={{ width: 'auto', marginTop: '1rem', padding: '0.4rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <BoardIcon name="plus" size={13} />
                                <span>{t('newCardBtn')}</span>
                            </button>
                        </div>
                    )}

                    {/* Nodes / Cards / Images / Checklists Render */}
                    {nodes.filter(n => n.category !== 'drawing').map((node) => {
                        const scheme = COLOR_SCHEMES[node.color] || COLOR_SCHEMES.red;
                        const catConfig = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.note;
                        const isSource = connectingSourceId === node.id;
                        const isSelected = selectedNodeId === node.id;
                        const cardWidth = node.width || (node.category === 'todo' ? 320 : 260);
                        const extra = parseNodeExtra(node);
                        const isLocked = !!extra.isLocked;

                        // 1. Standalone Image Element Rendering
                        if (node.category === 'image') {
                            const imgHeight = extra.height || 260;

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
                                        height: `${imgHeight}px`,
                                        borderRadius: '8px',
                                        background: '#020617',
                                        border: `2px solid ${isSource ? '#ef4444' : isSelected ? '#eab308' : 'rgba(255,255,255,0.2)'}`,
                                        boxShadow: isSelected ? '0 0 20px rgba(234, 179, 8, 0.6)' : isSource ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 8px 24px rgba(0,0,0,0.7)',
                                        zIndex: isSource ? 15 : isSelected ? 12 : draggingNodeId === node.id ? 10 : 2,
                                        cursor: isLocked ? 'default' : connectingSourceId ? 'pointer' : toolMode === 'eraser' ? 'cell' : 'move',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <img
                                        src={node.image_url}
                                        alt={node.title}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                                    />

                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0,
                                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
                                        padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {isLocked && <BoardIcon name="lock" size={11} color="#fef08a" />}
                                            <span>{node.title}</span>
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setExpandedImage(node.image_url); }}
                                                style={{ background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Ver imagen completa"
                                            >
                                                <BoardIcon name="search" size={11} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConnectingSourceId(isSource ? null : node.id); }}
                                                style={{ background: isSource ? '#ef4444' : 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Conectar hilo"
                                            >
                                                <BoardIcon name="link" size={11} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id, node.title); }}
                                                style={{ background: 'rgba(239, 68, 68, 0.6)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Eliminar imagen"
                                            >
                                                <BoardIcon name="trash" size={11} />
                                            </button>
                                        </div>
                                    </div>

                                    {!isLocked && (
                                        <div
                                            onMouseDown={(e) => handleResizeMouseDown(e, node.id)}
                                            style={{
                                                position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px',
                                                cursor: 'nwse-resize', background: 'rgba(234, 179, 8, 0.8)',
                                                borderTopLeftRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                zIndex: 5
                                            }}
                                            title="Arrastra para redimensionar"
                                        >
                                            <span style={{ fontSize: '0.65rem', color: '#000', fontWeight: 'bold' }}>⤡</span>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // 2. Interactive To-Do Checklist Card (Matching sleek UI from reference image)
                        if (node.category === 'todo') {
                            const taskList = Array.isArray(extra.tasks) ? extra.tasks : [];

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
                                        background: '#090d16',
                                        border: `1.5px solid ${isSource ? '#ef4444' : isSelected ? '#eab308' : 'rgba(56, 189, 248, 0.4)'}`,
                                        borderRadius: '10px',
                                        boxShadow: isSelected ? '0 0 24px rgba(234, 179, 8, 0.6)' : isSource ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.12)',
                                        zIndex: isSource ? 15 : isSelected ? 12 : draggingNodeId === node.id ? 10 : 2,
                                        cursor: isLocked ? 'default' : connectingSourceId ? 'pointer' : toolMode === 'eraser' ? 'cell' : 'move',
                                        padding: '1.1rem 1.25rem',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Checklist Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                        <span style={{
                                            color: '#38bdf8',
                                            fontSize: '0.82rem',
                                            fontWeight: 900,
                                            letterSpacing: '1.2px',
                                            textTransform: 'uppercase',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <BoardIcon name="todo" size={14} color="#38bdf8" />
                                            {isLocked && <BoardIcon name="lock" size={12} color="#fef08a" />}
                                            <span>{node.title || extra.category_name || 'PRÓXIMOS PASOS'}</span>
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConnectingSourceId(isSource ? null : node.id); }}
                                                style={{ background: isSource ? '#ef4444' : 'rgba(255,255,255,0.08)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Conectar hilo"
                                            >
                                                <BoardIcon name="link" size={11} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id, node.title); }}
                                                style={{ background: 'rgba(239, 68, 68, 0.3)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Eliminar lista To-Do"
                                            >
                                                <BoardIcon name="trash" size={11} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tasks List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                        {taskList.length > 0 ? (
                                            taskList.map((task) => {
                                                const isDone = !!task.is_completed;
                                                return (
                                                    <div
                                                        key={task.id || task.content}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleBoardTodoTask(node.id, task.id, isDone);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '10px',
                                                            cursor: 'pointer',
                                                            padding: '2px 0',
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        {/* Styled Square Checkbox */}
                                                        <div style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            minWidth: '18px',
                                                            borderRadius: '4px',
                                                            marginTop: '2px',
                                                            background: isDone ? '#0284c7' : 'rgba(0, 0, 0, 0.5)',
                                                            border: `1.5px solid ${isDone ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: isDone ? '0 0 8px rgba(56, 189, 248, 0.4)' : 'none',
                                                            transition: 'all 0.15s ease'
                                                        }}>
                                                            {isDone && <BoardIcon name="check" size={11} color="#ffffff" />}
                                                        </div>

                                                        {/* Task Text Content */}
                                                        <span style={{
                                                            fontSize: '0.85rem',
                                                            lineHeight: '1.35',
                                                            color: isDone ? '#94a3b8' : '#f1f5f9',
                                                            textDecoration: isDone ? 'line-through' : 'none',
                                                            wordBreak: 'break-word',
                                                            transition: 'all 0.15s ease'
                                                        }}>
                                                            {task.content}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleLegacyTodoNode(e, node);
                                                }}
                                                style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}
                                            >
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    minWidth: '18px',
                                                    borderRadius: '4px',
                                                    marginTop: '2px',
                                                    background: (node.content?.includes('[✓]') || node.color === 'green') ? '#0284c7' : 'rgba(0, 0, 0, 0.5)',
                                                    border: `1.5px solid ${(node.content?.includes('[✓]') || node.color === 'green') ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {(node.content?.includes('[✓]') || node.color === 'green') && <BoardIcon name="check" size={11} color="#ffffff" />}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    color: (node.content?.includes('[✓]') || node.color === 'green') ? '#94a3b8' : '#f1f5f9',
                                                    textDecoration: (node.content?.includes('[✓]') || node.color === 'green') ? 'line-through' : 'none'
                                                }}>
                                                    {node.title}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // 3. Unified Sequential Timeline Card (Fulfilling user reference image design)
                        if (node.category === 'timeline') {
                            const events = Array.isArray(extra.events) ? extra.events : [];
                            const timelineWidth = node.width || 380;

                            return (
                                <div
                                    key={node.id}
                                    className="whiteboard-card"
                                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                    style={{
                                        position: 'absolute',
                                        left: `${node.pos_x}px`,
                                        top: `${node.pos_y}px`,
                                        width: `${timelineWidth}px`,
                                        background: '#090d16',
                                        border: `1.5px solid ${isSource ? '#ef4444' : isSelected ? '#eab308' : 'rgba(56, 189, 248, 0.4)'}`,
                                        borderRadius: '10px',
                                        boxShadow: isSelected ? '0 0 24px rgba(234, 179, 8, 0.6)' : isSource ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 10px 30px rgba(0, 0, 0, 0.85), 0 0 16px rgba(56, 189, 248, 0.12)',
                                        zIndex: isSource ? 15 : isSelected ? 12 : draggingNodeId === node.id ? 10 : 2,
                                        cursor: isLocked ? 'default' : connectingSourceId ? 'pointer' : toolMode === 'eraser' ? 'cell' : 'move',
                                        padding: '1.1rem 1.25rem',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Header: Clock Icon + LÍNEA DE TIEMPO in cyan uppercase */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <BoardIcon name="timeline" size={16} color="#38bdf8" />
                                            <span style={{
                                                color: '#38bdf8',
                                                fontSize: '0.82rem',
                                                fontWeight: 900,
                                                letterSpacing: '1.2px',
                                                textTransform: 'uppercase',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}>
                                                {isLocked && <BoardIcon name="lock" size={12} color="#fef08a" />}
                                                <span>{node.title || extra.timeline_title || 'LÍNEA DE TIEMPO'}</span>
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openTimelineModal(node); }}
                                                style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 7px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title="Editar sucesos de la línea de tiempo"
                                            >
                                                <BoardIcon name="edit" size={11} color="#38bdf8" />
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConnectingSourceId(isSource ? null : node.id); }}
                                                style={{ background: isSource ? '#ef4444' : 'rgba(255,255,255,0.08)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Conectar hilo"
                                            >
                                                <BoardIcon name="link" size={11} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id, node.title); }}
                                                style={{ background: 'rgba(239, 68, 68, 0.3)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                                title="Eliminar línea de tiempo"
                                            >
                                                <BoardIcon name="trash" size={11} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Events Sequence (Clean vertical sequence, matching reference image) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {events.length > 0 ? (
                                            events.map((ev, idx) => (
                                                <div
                                                    key={ev.id || idx}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '12px',
                                                        padding: '2px 0',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    {/* Left Date / Time Badge */}
                                                    <div style={{
                                                        background: 'rgba(14, 165, 233, 0.15)',
                                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                                        color: '#38bdf8',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        minWidth: '50px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        lineHeight: '1.25',
                                                        whiteSpace: 'nowrap',
                                                        flexShrink: 0
                                                    }}>
                                                        {ev.date && (
                                                            <span style={{ fontSize: '0.67rem', color: '#93c5fd', fontWeight: 700, letterSpacing: '0.4px' }}>
                                                                {ev.date}
                                                            </span>
                                                        )}
                                                        {ev.time && (
                                                            <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 800 }}>
                                                                {ev.time}
                                                            </span>
                                                        )}
                                                        {!ev.date && !ev.time && (
                                                            <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 800 }}>
                                                                --:--
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Right Event Text Description */}
                                                    <span style={{
                                                        color: '#cbd5e1',
                                                        fontSize: '0.85rem',
                                                        lineHeight: '1.4',
                                                        flex: 1,
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {ev.text || ev.description || ev.content || ''}
                                                    </span>

                                                    {/* Quick Delete */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickDeleteTimelineItem(node.id, idx);
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#94a3b8',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            opacity: 0.4,
                                                            padding: '0 2px',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
                                                        title="Eliminar este suceso"
                                                    >
                                                        <BoardIcon name="close" size={11} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{
                                                padding: '1rem',
                                                textAlign: 'center',
                                                color: '#94a3b8',
                                                fontSize: '0.82rem',
                                                border: '1px dashed rgba(56, 189, 248, 0.25)',
                                                borderRadius: '6px'
                                            }}>
                                                <span>No hay sucesos en la línea de tiempo. Haz clic en <b>Editar</b> para añadir el primer hito.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom action to add milestone */}
                                    <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openTimelineModal(node);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#38bdf8',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <BoardIcon name="plus" size={12} color="#38bdf8" />
                                            <span>Añadir Hito / Editar</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        // 4. Standard Investigation Cards
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
                                    border: `2px solid ${isSource ? '#ef4444' : isSelected ? '#eab308' : node.is_inactive ? '#991b1b' : scheme.border}`,
                                    borderRadius: '8px',
                                    boxShadow: isSelected ? '0 0 20px rgba(234, 179, 8, 0.6)' : isSource ? '0 0 16px rgba(239, 68, 68, 0.8)' : '0 8px 24px rgba(0, 0, 0, 0.6)',
                                    zIndex: isSource ? 15 : isSelected ? 12 : draggingNodeId === node.id ? 10 : 2,
                                    transition: draggingNodeId === node.id ? 'none' : 'box-shadow 0.2s',
                                    cursor: isLocked ? 'default' : connectingSourceId ? 'pointer' : toolMode === 'eraser' ? 'cell' : 'move',
                                    opacity: node.is_inactive ? 0.88 : 1,
                                    filter: node.is_inactive ? 'grayscale(25%)' : 'none'
                                }}
                            >
                                {/* Inactive Visual Overlay */}
                                {node.is_inactive && (
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        pointerEvents: 'none', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: '8px', overflow: 'hidden'
                                    }}>
                                        <svg style={{ position: 'absolute', width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <line x1="0" y1="0" x2="100" y2="100" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
                                            <line x1="100" y1="0" x2="0" y2="100" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
                                        </svg>
                                        <div style={{
                                            background: 'rgba(185, 28, 28, 0.95)', color: 'white', fontWeight: '900', fontSize: '0.8rem',
                                            letterSpacing: '1.5px', padding: '4px 14px', borderRadius: '4px', border: '2px solid #ffffff',
                                            boxShadow: '0 4px 14px rgba(0,0,0,0.85)', transform: 'rotate(-12deg)', textTransform: 'uppercase', zIndex: 11,
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}>
                                            <BoardIcon name="close" size={12} color="#ffffff" />
                                            <span>{t('inactiveBadge') || 'INACTIVO'}</span>
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
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <BoardIcon name={catConfig.iconName || 'note'} size={13} color="white" />
                                        <span>{t(catConfig.label) || node.category}</span>
                                        {isLocked && <BoardIcon name="lock" size={11} color="#fef08a" />}
                                        {node.is_inactive && (
                                            <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                <BoardIcon name="close" size={10} color="#ffffff" />
                                                <span>INACTIVO</span>
                                            </span>
                                        )}
                                    </span>

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConnectingSourceId(isSource ? null : node.id); }}
                                            style={{
                                                background: isSource ? '#ef4444' : 'rgba(255,255,255,0.15)',
                                                border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer',
                                                padding: '3px 5px', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Conectar hilo rojo a otra tarjeta"
                                        >
                                            <BoardIcon name="link" size={11} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openNodeModal(node); }}
                                            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                            title="Editar tarjeta"
                                        >
                                            <BoardIcon name="edit" size={11} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id, node.title); }}
                                            style={{ background: 'rgba(239, 68, 68, 0.4)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                                            title="Eliminar tarjeta"
                                        >
                                            <BoardIcon name="trash" size={11} />
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
                                                        <BoardIcon name="link" size={10} color="var(--accent-gold)" />
                                                        <span>Novedad #{numStr}</span>
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
                                        {Object.keys(CATEGORY_CONFIG).filter(k => k !== 'drawing').map(catKey => (
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
                                        <option value="red">Rojo (Sospechoso)</option>
                                        <option value="yellow">Amarillo (Nota)</option>
                                        <option value="blue">Azul (Policial / Tarea)</option>
                                        <option value="green">Verde (Testigo / Hecho)</option>
                                        <option value="purple">Púrpura (Vehículo)</option>
                                        <option value="pink">Rosa (Cronología)</option>
                                        <option value="dark">Oscuro (Slate)</option>
                                    </select>
                                </div>
                            </div>

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
                                    <BoardIcon name="close" size={13} color={nodeIsInactive ? '#fca5a5' : '#ef4444'} />
                                    <span>{t('inactiveCardLabel') || 'Marcar como Inactivo (Mostrar cruz de archivo)'}</span>
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
                                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <BoardIcon name="close" size={12} color="#ffffff" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="custom-file-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'auto', margin: 0, fontSize: '0.85rem' }}>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                                        <BoardIcon name="image" size={14} />
                                        <span>{t('uploadImageBtn')}</span>
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

            {/* Modal: Import To-Do Checklists */}
            {showImportTodoModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a', border: '1.5px solid #38bdf8', borderRadius: '12px',
                        width: '100%', maxWidth: '600px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(56,189,248,0.2)',
                        maxHeight: '85vh', display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' }}>
                                    <BoardIcon name="todo" size={18} color="#38bdf8" />
                                    <span>{t('importTodoModalTitle') || 'Importar Listas To-Do a la Pizarra'}</span>
                                </h3>
                                <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {language === 'es' ? 'Se importarán como tarjetas To-Do interactivas sincronizadas en tiempo real.' : 'Will be imported as interactive To-Do checklist cards synchronized in real-time.'}
                                </p>
                            </div>
                            <button onClick={() => setShowImportTodoModal(false)} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <BoardIcon name="close" size={16} />
                            </button>
                        </div>

                        {loadingTodos ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#38bdf8' }}>Cargando listas To-Do...</div>
                        ) : todoCategories.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                {t('noTasksFound') || 'No se encontraron listas ni tareas en el To-Do de este caso.'}
                            </div>
                        ) : (
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px', marginBottom: '1rem' }}>
                                {todoCategories.map(cat => {
                                    const catTaskIds = (cat.tasks || []).map(t => t.id);
                                    const allSelected = catTaskIds.length > 0 && catTaskIds.every(id => selectedTodoTaskIds.includes(id));

                                    return (
                                        <div key={cat.id} style={{ background: 'rgba(0,0,0,0.4)', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                                <span style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                    {cat.name} ({cat.tasks?.length || 0})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (allSelected) {
                                                            setSelectedTodoTaskIds(prev => prev.filter(id => !catTaskIds.includes(id)));
                                                        } else {
                                                            setSelectedTodoTaskIds(prev => Array.from(new Set([...prev, ...catTaskIds])));
                                                        }
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    {allSelected ? 'Deseleccionar lista' : 'Seleccionar lista'}
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {(cat.tasks || []).map(task => {
                                                    const isChecked = selectedTodoTaskIds.includes(task.id);
                                                    return (
                                                        <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', padding: '3px 0' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedTodoTaskIds(prev => [...prev, task.id]);
                                                                    } else {
                                                                        setSelectedTodoTaskIds(prev => prev.filter(id => id !== task.id));
                                                                    }
                                                                }}
                                                                style={{ accentColor: '#0284c7', width: '16px', height: '16px' }}
                                                            />
                                                            <span style={{ flex: 1, textDecoration: task.is_completed ? 'line-through' : 'none', opacity: task.is_completed ? 0.65 : 1 }}>
                                                                {task.content}
                                                            </span>
                                                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '3px', background: task.is_completed ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.2)', color: task.is_completed ? '#4ade80' : '#38bdf8' }}>
                                                                {task.is_completed ? 'Hecho' : 'Pendiente'}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setShowImportTodoModal(false)} style={{ width: 'auto' }}>
                                {t('cancelBtn')}
                            </button>
                            <button
                                className="login-button"
                                onClick={handleImportSelectedTodos}
                                disabled={selectedTodoTaskIds.length === 0}
                                style={{ width: 'auto', background: '#0284c7', borderColor: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <BoardIcon name="todo" size={13} />
                                <span>{t('importSelectedTasksBtn') || 'Importar a la Pizarra'} ({selectedTodoTaskIds.length})</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Timeline / Chronology Tool (Dedicated Sequential Editor) */}
            {showTimelineModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '12px',
                        width: '100%', maxWidth: '680px', padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 25px rgba(56, 189, 248, 0.15)',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.65rem' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                                    <BoardIcon name="timeline" size={18} color="#38bdf8" />
                                    <span>{t('timelineModalTitle') || 'Línea de Tiempo del Caso'}</span>
                                </h3>
                                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    {language === 'es' ? 'Gestiona los hitos cronológicos directamente. Se mostrarán secuenciales en una única tarjeta táctica en la pizarra.' : 'Manage chronological events directly. They will be displayed sequentially in a single tactical card on the board.'}
                                </p>
                            </div>
                            <button onClick={() => setShowTimelineModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <BoardIcon name="close" size={16} />
                            </button>
                        </div>

                        {/* Events List & Form Area */}
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '6px', marginBottom: '1rem' }}>
                            
                            {/* Sequence of Events */}
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <BoardIcon name="timeline" size={14} color="#38bdf8" />
                                        <span>Sucesos Registrados ({timelineItems.length})</span>
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{timelineItems.length > 0 ? 'En orden secuencial' : ''}</span>
                                </div>

                                {timelineItems.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {timelineItems.map((item, idx) => (
                                            <div
                                                key={item.id || idx}
                                                style={{
                                                    background: editingTimelineItemIndex === idx ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0, 0, 0, 0.4)',
                                                    border: `1px solid ${editingTimelineItemIndex === idx ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                                                    borderRadius: '8px', padding: '0.65rem 0.85rem', display: 'flex', gap: '10px', alignItems: 'center'
                                                }}
                                            >
                                                {/* Move Controls */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveTimelineItem(idx, -1)}
                                                        disabled={idx === 0}
                                                        style={{ background: 'none', border: 'none', color: idx === 0 ? '#475569' : '#94a3b8', cursor: idx === 0 ? 'default' : 'pointer', padding: '1px 2px', display: 'flex', alignItems: 'center' }}
                                                        title="Mover arriba"
                                                    >
                                                        <BoardIcon name="chevronUp" size={11} color={idx === 0 ? '#475569' : '#94a3b8'} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveTimelineItem(idx, 1)}
                                                        disabled={idx === timelineItems.length - 1}
                                                        style={{ background: 'none', border: 'none', color: idx === timelineItems.length - 1 ? '#475569' : '#94a3b8', cursor: idx === timelineItems.length - 1 ? 'default' : 'pointer', padding: '1px 2px', display: 'flex', alignItems: 'center' }}
                                                        title="Mover abajo"
                                                    >
                                                        <BoardIcon name="chevronDown" size={11} color={idx === timelineItems.length - 1 ? '#475569' : '#94a3b8'} />
                                                    </button>
                                                </div>

                                                {/* Date & Time Badge */}
                                                <div style={{
                                                    background: 'rgba(14, 165, 233, 0.18)',
                                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                                    color: '#38bdf8',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    minWidth: '54px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    lineHeight: '1.25',
                                                    textAlign: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {item.date && (
                                                        <span style={{ fontSize: '0.67rem', color: '#93c5fd', fontWeight: 700, letterSpacing: '0.4px' }}>
                                                            {item.date}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                                                        {item.time || (!item.date ? '--:--' : '')}
                                                    </span>
                                                </div>

                                                {/* Text Content */}
                                                <div style={{ flex: 1, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                                                    {item.text}
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEditTimelineItem(idx)}
                                                        style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center' }}
                                                        title="Editar suceso"
                                                    >
                                                        <BoardIcon name="edit" size={12} color="#38bdf8" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteTimelineItem(idx)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: '4px', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center' }}
                                                        title="Eliminar suceso"
                                                    >
                                                        <BoardIcon name="trash" size={12} color="#fca5a5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                                        No hay sucesos en la línea de tiempo todavía. Usa el formulario inferior para añadir el primero.
                                    </div>
                                )}
                            </div>

                            {/* Add / Edit Item Form */}
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: `1px solid ${editingTimelineItemIndex !== null ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}`,
                                borderRadius: '10px',
                                padding: '1.1rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                    <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <BoardIcon name={editingTimelineItemIndex !== null ? 'edit' : 'plus'} size={13} color="#38bdf8" />
                                        <span>{editingTimelineItemIndex !== null ? 'Modificar Suceso de la Línea' : 'Añadir Hito / Suceso a la Línea'}</span>
                                    </h4>
                                    {editingTimelineItemIndex !== null && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingTimelineItemIndex(null);
                                                setTimelineDateInput('');
                                                setTimelineTimeInput('');
                                                setTimelineTextInput('');
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Cancelar edición
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={handleSaveTimelineItem}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '130px 110px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                                                Día / Fecha
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="ej. 03/09, Día 1..."
                                                value={timelineDateInput}
                                                onChange={e => setTimelineDateInput(e.target.value)}
                                                style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                                                Hora / Etiqueta
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="ej. 14:15 o Post"
                                                value={timelineTimeInput}
                                                onChange={e => setTimelineTimeInput(e.target.value)}
                                                style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                                                Descripción del Suceso *
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="ej. Agentes Bradford y Whittaker acuden a la casa tras aviso."
                                                value={timelineTextInput}
                                                onChange={e => setTimelineTextInput(e.target.value)}
                                                style={{ padding: '0.5rem', fontSize: '0.85rem', width: '100%' }}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                        <button
                                            type="submit"
                                            className="login-button"
                                            style={{
                                                width: 'auto',
                                                padding: '0.45rem 1rem',
                                                fontSize: '0.82rem',
                                                background: editingTimelineItemIndex !== null ? '#0284c7' : 'rgba(56, 189, 248, 0.2)',
                                                borderColor: '#38bdf8',
                                                color: '#ffffff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <BoardIcon name={editingTimelineItemIndex !== null ? 'check' : 'plus'} size={12} color="#ffffff" />
                                            <span>{editingTimelineItemIndex !== null ? 'Guardar Cambios' : 'Añadir a la Línea'}</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                            <button className="login-button btn-secondary" onClick={() => setShowTimelineModal(false)} style={{ width: 'auto' }}>
                                {t('cancelBtn') || 'Cancelar'}
                            </button>
                            <button
                                className="login-button"
                                onClick={handleSaveTimelineToBoard}
                                disabled={timelineItems.length === 0}
                                style={{
                                    width: 'auto',
                                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                    borderColor: '#38bdf8',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <BoardIcon name="check" size={14} color="#ffffff" />
                                <span>{language === 'es' ? 'Guardar Línea de Tiempo en Pizarra' : 'Save Timeline to Whiteboard'} ({timelineItems.length})</span>
                            </button>
                        </div>
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
                            <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BoardIcon name="note" size={16} color="var(--accent-gold)" />
                                <span>{t('linkedEntryPreview')}</span>
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

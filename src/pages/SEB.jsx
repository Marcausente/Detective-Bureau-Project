import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { getProfileImage, uploadImageToStorage } from '../utils/imageStorage';
import '../index.css';

function SEB() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Main Tabs: 'ops' (Tablón de Operaciones) | 'roster' (Cuadrilla SEB)
    const [activeTab, setActiveTab] = useState('ops');
    
    // Operations & Board State
    const [operations, setOperations] = useState([]);
    const [selectedOp, setSelectedOp] = useState(null);
    const [personnelList, setPersonnelList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Operations Sub-Tabs: 'active' (Operaciones Activas) | 'archived' (Archivo de Operativos Finalizados)
    const [opsSubTab, setOpsSubTab] = useState('active');

    // Create Operation Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newOp, setNewOp] = useState({
        title: '',
        location: '',
        type: 'Asalto Táctico & Rescate',
        details: ''
    });

    // Edit Operation Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOp, setEditingOp] = useState(null);

    // Tactical Note Modal State
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteForm, setNoteForm] = useState({
        id: null,
        title: '',
        content: '',
        category: 'Nota Táctica'
    });

    // Tactical Board Canvas State
    const [boardElements, setBoardElements] = useState([]);
    const [history, setHistory] = useState([]); // Undo History Stack for Ctrl+Z
    const [copiedElement, setCopiedElement] = useState(null); // Clipboard for Ctrl+C / Ctrl+V
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [connectingSourceId, setConnectingSourceId] = useState(null); // Thread connection source
    const [zoom, setZoom] = useState(1); // Zoom scale factor (1 = 100%)
    const [pan, setPan] = useState({ x: 0, y: 0 }); // Pan offset (x, y)
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    // Tactical Pencil, Quick Shapes & Eraser State
    const [isPencilActive, setIsPencilActive] = useState(false);
    const [pencilShape, setPencilShape] = useState('free'); // 'free' | 'line' | 'rectangle' | 'circle'
    const [isEraserActive, setIsEraserActive] = useState(false);
    const [pencilColor, setPencilColor] = useState('#ef4444'); // Default tactical red
    const [pencilWidth, setPencilWidth] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);

    // Element Resizing State (Corners & Edges Handles)
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDir, setResizeDir] = useState(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, initX: 0, initY: 0, initW: 0, initH: 0 });

    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [savingBoard, setSavingBoard] = useState(false);
    
    // Image Preview Modal
    const [expandedImage, setExpandedImage] = useState(null);

    // Drag element state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragDrawingStart, setDragDrawingStart] = useState({ startX: 0, startY: 0, initialPoints: [] });
    const boardRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if (profile && hasAccess()) {
            fetchOperations();
            fetchSEBPersonnel();
        }
    }, [profile]);

    // Mouse wheel zoom event handler for canvas
    const handleWheelCanvas = useCallback((e) => {
        if (e) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
        }
        const delta = e ? e.deltaY : 0;
        if (delta < 0) {
            setZoom(z => Math.min(3.0, +(z + 0.08).toFixed(2)));
        } else if (delta > 0) {
            setZoom(z => Math.max(0.3, +(z - 0.08).toFixed(2)));
        }
    }, []);

    // Callback ref to attach non-passive wheel listener directly when canvas DOM node mounts
    const setBoardRef = useCallback((node) => {
        if (boardRef.current) {
            boardRef.current.removeEventListener('wheel', handleWheelCanvas);
        }
        boardRef.current = node;
        if (node) {
            node.addEventListener('wheel', handleWheelCanvas, { passive: false });
        }
    }, [handleWheelCanvas]);

    // Close tactical board modal on ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && selectedOp) {
                setSelectedOp(null);
                setConnectingSourceId(null);
                setIsPencilActive(false);
                setIsEraserActive(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedOp]);

    // Push state snapshot to Undo History Stack before mutating elements
    const pushHistory = (newElements) => {
        setHistory(prev => [...prev.slice(-25), boardElements]);
        setBoardElements(newElements);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        setBoardElements(previousState);
    };

    // Copy, Paste & Duplicate Element Handlers
    const handleCopyElement = (el = null) => {
        const target = el || boardElements.find(item => item.id === selectedElementId);
        if (target && target.type !== 'thread') {
            setCopiedElement(JSON.parse(JSON.stringify(target)));
        }
    };

    const handlePasteElement = () => {
        if (!copiedElement) return;
        const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
        const newId = (copiedElement.type || 'elem') + '-' + Date.now();
        
        const pastedElement = JSON.parse(JSON.stringify(copiedElement));
        pastedElement.id = newId;
        pastedElement.zIndex = maxZ + 1;
        pastedElement.isLocked = false;

        if (typeof pastedElement.x === 'number') {
            pastedElement.x += 30;
        }
        if (typeof pastedElement.y === 'number') {
            pastedElement.y += 30;
        }
        if (pastedElement.points && Array.isArray(pastedElement.points)) {
            pastedElement.points = pastedElement.points.map(p => ({
                x: p.x + 30,
                y: p.y + 30
            }));
        }

        pushHistory([...boardElements, pastedElement]);
        setSelectedElementId(newId);
        setCopiedElement(pastedElement);
    };

    const handleDuplicateElement = (el = null) => {
        const target = el || boardElements.find(item => item.id === selectedElementId);
        if (!target || target.type === 'thread') return;

        const maxZ = boardElements.reduce((max, item) => Math.max(max, item.zIndex || 1), 1);
        const newId = (target.type || 'elem') + '-' + Date.now();
        
        const clone = JSON.parse(JSON.stringify(target));
        clone.id = newId;
        clone.zIndex = maxZ + 1;
        clone.isLocked = false;

        if (typeof clone.x === 'number') {
            clone.x += 30;
        }
        if (typeof clone.y === 'number') {
            clone.y += 30;
        }
        if (clone.points && Array.isArray(clone.points)) {
            clone.points = clone.points.map(p => ({
                x: p.x + 30,
                y: p.y + 30
            }));
        }

        pushHistory([...boardElements, clone]);
        setSelectedElementId(newId);
        setCopiedElement(clone);
    };

    // Keyboard shortcuts listener for Ctrl+Z (Undo), Delete/Backspace, and Ctrl+C / Ctrl+V (Copy & Paste)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const activeTag = document.activeElement?.tagName;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || document.activeElement?.isContentEditable) {
                return;
            }

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const keyLower = e.key ? e.key.toLowerCase() : '';

            // Ctrl + Z or Cmd + Z (Undo)
            if (isCtrlOrCmd && keyLower === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Ctrl + C or Cmd + C (Copy)
            if (isCtrlOrCmd && keyLower === 'c') {
                if (selectedElementId) {
                    const el = boardElements.find(item => item.id === selectedElementId);
                    if (el && el.type !== 'thread') {
                        e.preventDefault();
                        handleCopyElement(el);
                    }
                }
                return;
            }

            // Ctrl + V or Cmd + V (Paste)
            if (isCtrlOrCmd && keyLower === 'v') {
                if (copiedElement) {
                    e.preventDefault();
                    handlePasteElement();
                }
                return;
            }

            // Delete or Backspace key deletes selected element
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
                e.preventDefault();
                handleDeleteElement(selectedElementId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, selectedElementId, boardElements, copiedElement]);

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setProfile(data);
            }
        } catch (err) {
            console.error('Error loading profile in SEB:', err);
        } finally {
            setLoading(false);
        }
    };

    const hasAccess = () => {
        if (!profile) return false;
        const role = profile.rol ? profile.rol.toLowerCase().trim() : '';
        const isSEBRank = profile.rango === 'SEB Agent';
        const isSEBDivision = profile.divisions && profile.divisions.includes('SEB');
        const allowedRoles = ['coordinador', 'comisionado', 'administrador', 'superadmin', 'admin'];

        return isSEBRank || isSEBDivision || allowedRoles.includes(role);
    };

    const fetchOperations = async () => {
        try {
            const { data, error } = await supabase
                .from('seb_operations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !data) {
                const localOps = localStorage.getItem('seb_operations');
                if (localOps) {
                    setOperations(JSON.parse(localOps));
                } else {
                    const defaultOps = [
                        {
                            id: 'demo-op-1',
                            title: 'Operación Cerbero',
                            location: 'Almacén Industrial El Burro Heights',
                            type: 'Asalto Táctico & Rescate',
                            details: 'Asegurar el perímetro del edificio B, neutralizar la resistencia enemiga y rescatar a los rehenes retenidos en el segundo nivel.',
                            status: 'En Progreso',
                            created_at: new Date().toISOString(),
                            board_data: [
                                {
                                    id: 'elem-1',
                                    type: 'note',
                                    content: 'Punto de Entrada Principal (Puerta Norte)',
                                    category: 'Perímetro',
                                    x: 80,
                                    y: 80,
                                    width: 260,
                                    height: 120,
                                    zIndex: 2
                                },
                                {
                                    id: 'elem-2',
                                    type: 'note',
                                    content: 'Tirador de Cobertura Alpha (Azotea Sur)',
                                    category: 'Tirador',
                                    x: 420,
                                    y: 80,
                                    width: 260,
                                    height: 120,
                                    zIndex: 3
                                },
                                {
                                    id: 'thread-demo-1',
                                    type: 'thread',
                                    sourceId: 'elem-1',
                                    targetId: 'elem-2',
                                    label: 'Línea de Visión & Cobertura'
                                }
                            ]
                        }
                    ];
                    setOperations(defaultOps);
                    localStorage.setItem('seb_operations', JSON.stringify(defaultOps));
                }
            } else {
                setOperations(data);
            }
        } catch (err) {
            console.error('Error fetching SEB operations:', err);
        }
    };

    const fetchSEBPersonnel = async () => {
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .order('rango');
            if (data) {
                const filtered = data.filter(u => 
                    u.rango === 'SEB Agent' || 
                    (u.divisions && u.divisions.includes('SEB'))
                );
                setPersonnelList(filtered);
            }
        } catch (err) {
            console.error('Error fetching SEB personnel:', err);
        }
    };

    const handleCreateOperation = async (e) => {
        e.preventDefault();
        if (!newOp.title || !newOp.location || !newOp.type) return;

        const opToInsert = {
            title: newOp.title,
            location: newOp.location,
            type: newOp.type,
            details: newOp.details,
            status: 'En Progreso',
            board_data: [],
            created_by: profile?.id
        };

        try {
            const { data, error } = await supabase
                .from('seb_operations')
                .insert([opToInsert])
                .select()
                .single();

            if (!error && data) {
                setOperations([data, ...operations]);
            } else {
                const localOp = {
                    ...opToInsert,
                    id: 'op-' + Date.now(),
                    created_at: new Date().toISOString()
                };
                const updated = [localOp, ...operations];
                setOperations(updated);
                localStorage.setItem('seb_operations', JSON.stringify(updated));
            }
        } catch (err) {
            console.error('Error saving new operation:', err);
        }

        setIsCreateModalOpen(false);
        setNewOp({
            title: '',
            location: '',
            type: 'Asalto Táctico & Rescate',
            details: ''
        });
    };

    // Handle Delete Operation
    const handleDeleteOperation = async (opId, opTitle) => {
        if (!confirm(language === 'es' ? `¿Estás seguro de que deseas eliminar la operación "${opTitle}"? Esta acción no se puede deshacer.` : `Are you sure you want to delete operation "${opTitle}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('seb_operations')
                .delete()
                .eq('id', opId);

            const updated = operations.filter(o => o.id !== opId);
            setOperations(updated);
            localStorage.setItem('seb_operations', JSON.stringify(updated));

            if (selectedOp?.id === opId) {
                setSelectedOp(null);
            }
        } catch (err) {
            console.error('Error deleting operation:', err);
        }
    };

    // Handle Quick Status / Archive Toggle
    const handleToggleArchiveStatus = async (op) => {
        const newStatus = op.status === 'Finalizado' ? 'En Progreso' : 'Finalizado';
        try {
            const { error } = await supabase
                .from('seb_operations')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', op.id);

            const updated = operations.map(o => o.id === op.id ? { ...o, status: newStatus } : o);
            setOperations(updated);
            localStorage.setItem('seb_operations', JSON.stringify(updated));
            if (selectedOp?.id === op.id) {
                setSelectedOp({ ...selectedOp, status: newStatus });
            }
        } catch (err) {
            console.error('Error updating operation status:', err);
        }
    };

    // Open Edit Modal
    const handleOpenEditModal = (op) => {
        setEditingOp({
            id: op.id,
            title: op.title || '',
            location: op.location || '',
            type: op.type || 'Asalto Táctico & Rescate',
            details: op.details || '',
            status: op.status || 'En Progreso'
        });
        setIsEditModalOpen(true);
    };

    // Save Edit Operation
    const handleSaveEditOperation = async (e) => {
        e.preventDefault();
        if (!editingOp || !editingOp.title || !editingOp.location) return;

        try {
            const { error } = await supabase
                .from('seb_operations')
                .update({
                    title: editingOp.title,
                    location: editingOp.location,
                    type: editingOp.type,
                    details: editingOp.details,
                    status: editingOp.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingOp.id);

            const updated = operations.map(o => o.id === editingOp.id ? { ...o, ...editingOp } : o);
            setOperations(updated);
            localStorage.setItem('seb_operations', JSON.stringify(updated));
            if (selectedOp?.id === editingOp.id) {
                setSelectedOp({ ...selectedOp, ...editingOp });
            }
        } catch (err) {
            console.error('Error saving edited operation:', err);
        }

        setIsEditModalOpen(false);
        setEditingOp(null);
    };

    // Auto-save board state whenever boardElements change (Debounced 800ms)
    const isFirstRenderRef = useRef(true);

    useEffect(() => {
        if (!selectedOp) return;

        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }

        const saveTimer = setTimeout(() => {
            handleSaveBoard(boardElements);
        }, 800);

        return () => clearTimeout(saveTimer);
    }, [boardElements]);

    const handleOpenBoard = (op) => {
        isFirstRenderRef.current = true;
        setSelectedOp(op);
        const elements = typeof op.board_data === 'string' ? JSON.parse(op.board_data) : (op.board_data || []);
        setBoardElements(elements);
        setHistory([]);
        setSelectedElementId(null);
        setConnectingSourceId(null);
        setIsPencilActive(false);
        setIsEraserActive(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleSaveBoard = async (elementsToSave = boardElements) => {
        if (!selectedOp) return;
        setSavingBoard(true);

        try {
            const { error } = await supabase
                .from('seb_operations')
                .update({ board_data: elementsToSave, updated_at: new Date().toISOString() })
                .eq('id', selectedOp.id);

            if (error) {
                const updatedOps = operations.map(o => o.id === selectedOp.id ? { ...o, board_data: elementsToSave } : o);
                setOperations(updatedOps);
                localStorage.setItem('seb_operations', JSON.stringify(updatedOps));
            } else {
                setOperations(operations.map(o => o.id === selectedOp.id ? { ...o, board_data: elementsToSave } : o));
            }
        } catch (err) {
            console.error('Error saving board state:', err);
        } finally {
            setSavingBoard(false);
        }
    };

    const handleImageUploadToBoard = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploadingImage(true);
            const publicUrl = await uploadImageToStorage(file, 'seb-boards');
            const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
            
            const newImageElement = {
                id: 'img-' + Date.now(),
                type: 'image',
                url: publicUrl || URL.createObjectURL(file),
                x: 100 - pan.x + (boardElements.length * 20),
                y: 100 - pan.y + (boardElements.length * 20),
                width: 320,
                height: 240,
                zIndex: maxZ + 1
            };

            pushHistory([...boardElements, newImageElement]);
            setSelectedElementId(newImageElement.id);
        } catch (err) {
            console.error('Error uploading image to board:', err);
            alert('Error al subir imagen al tablero: ' + err.message);
        } finally {
            setIsUploadingImage(false);
            e.target.value = '';
        }
    };

    const handleOpenAddNoteModal = () => {
        setNoteForm({
            id: null,
            type: 'note',
            title: '',
            content: '',
            category: ''
        });
        setIsNoteModalOpen(true);
    };

    const handleOpenEditNoteModal = (el) => {
        setNoteForm({
            id: el.id,
            type: el.type || 'note',
            title: el.title || (el.category !== 'Nota Táctica' ? el.category : '') || '',
            content: el.content || '',
            category: el.category || ''
        });
        setIsNoteModalOpen(true);
    };

    const handleEditNoteContent = (el) => {
        handleOpenEditNoteModal(el);
    };

    const handleSaveNoteModal = (e) => {
        if (e) e.preventDefault();
        if (!noteForm.title.trim() && !noteForm.content.trim()) {
            alert(language === 'es' ? 'Ingresa al menos un título o contenido para la nota.' : 'Please enter a title or content for the note.');
            return;
        }

        if (noteForm.id) {
            updateElement(noteForm.id, {
                title: noteForm.title.trim(),
                category: noteForm.title.trim() || 'Nota Táctica',
                content: noteForm.content
            });
        } else {
            const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
            const newNoteElement = {
                id: 'note-' + Date.now(),
                type: 'note',
                title: noteForm.title.trim(),
                category: noteForm.title.trim() || 'Nota Táctica',
                content: noteForm.content,
                x: 140 - pan.x + (boardElements.length * 15),
                y: 140 - pan.y + (boardElements.length * 15),
                width: 280,
                height: 180,
                zIndex: maxZ + 1,
                isLocked: false
            };

            pushHistory([...boardElements, newNoteElement]);
            setSelectedElementId(newNoteElement.id);
        }

        setIsNoteModalOpen(false);
    };

    const handleAddTextToBoard = () => {
        const text = prompt(language === 'es' ? 'Texto libre para el tablero táctico:' : 'Text for tactical board:', 'TEXTO TÁCTICO');
        if (!text) return;

        const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
        const newTextElement = {
            id: 'text-' + Date.now(),
            type: 'text',
            content: text,
            color: '#eab308',
            fontSize: 24,
            fontWeight: 'bold',
            x: 160 - pan.x + (boardElements.length * 15),
            y: 160 - pan.y + (boardElements.length * 15),
            width: 240,
            height: 60,
            zIndex: maxZ + 1,
            isLocked: false
        };

        pushHistory([...boardElements, newTextElement]);
        setSelectedElementId(newTextElement.id);
    };

    const handleEditTextContent = (el) => {
        handleOpenEditNoteModal(el);
    };

    const handleEditThreadLabel = (thread) => {
        const updatedLabel = prompt(language === 'es' ? 'Editar texto / etiqueta del hilo conector:' : 'Edit connector thread label:', thread.label || '');
        if (updatedLabel === null) return;
        updateElement(thread.id, { label: updatedLabel });
    };

    const startConnectingThread = (sourceId) => {
        setConnectingSourceId(sourceId);
        setIsPencilActive(false);
        setIsEraserActive(false);
    };

    const handleConnectToElement = (targetId) => {
        if (!connectingSourceId || connectingSourceId === targetId) {
            setConnectingSourceId(null);
            return;
        }

        const label = prompt(language === 'es' ? 'Nombre o etiqueta de la relación / hilo (Opcional):' : 'Thread relationship label (Optional):', 'Conexión Táctica') || '';

        const newThread = {
            id: 'thread-' + Date.now(),
            type: 'thread',
            sourceId: connectingSourceId,
            targetId: targetId,
            label: label
        };

        pushHistory([...boardElements, newThread]);
        setConnectingSourceId(null);
    };

    const updateElement = (id, newProps) => {
        pushHistory(boardElements.map(el => el.id === id ? { ...el, ...newProps } : el));
    };

    const toggleLockElement = (id) => {
        const el = boardElements.find(item => item.id === id);
        if (!el) return;
        updateElement(id, { isLocked: !el.isLocked });
    };

    const handleDeleteElement = (id) => {
        pushHistory(boardElements.filter(el => el.id !== id && el.sourceId !== id && el.targetId !== id));
        if (selectedElementId === id) setSelectedElementId(null);
        if (connectingSourceId === id) setConnectingSourceId(null);
    };

    const handleClearDrawings = () => {
        if (confirm(language === 'es' ? '¿Borrar todos los trazos de dibujo del tablero?' : 'Clear all freehand drawings on the board?')) {
            pushHistory(boardElements.filter(el => el.type !== 'drawing'));
        }
    };

    const bringToFront = (id) => {
        const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
        updateElement(id, { zIndex: maxZ + 1 });
    };

    const sendToBack = (id) => {
        const minZ = boardElements.reduce((min, el) => Math.min(min, el.zIndex || 1), 1);
        updateElement(id, { zIndex: Math.max(1, minZ - 1) });
    };

    // Helper to calculate exact canvas coordinates accounting for rect offset, pan, and zoom
    const getCanvasCoordinates = (e) => {
        if (!boardRef.current) return { x: 0, y: 0 };
        const rect = boardRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom
        };
    };

    // Helper to start middle-click wheel panning
    const startMiddlePan = (e) => {
        if (e.button === 1 || (e.buttons & 4) !== 0) {
            e.preventDefault();
            e.stopPropagation();
            setIsPanning(true);
            panStartRef.current = {
                x: e.clientX - pan.x,
                y: e.clientY - pan.y
            };
            return true;
        }
        return false;
    };

    // Element Resize Handle Mouse Down
    const handleMouseDownResize = (e, el, dir) => {
        if (startMiddlePan(e)) return;
        e.stopPropagation();
        e.preventDefault();
        if (el.isLocked) return;

        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        // Get actual rendered width & height from parent container if missing on el object
        const targetContainer = e.currentTarget.parentElement;
        const rect = targetContainer ? targetContainer.getBoundingClientRect() : null;
        const currentW = el.width || (rect ? Math.round(rect.width / zoom) : 300);
        const currentH = el.height || (rect ? Math.round(rect.height / zoom) : 220);

        setIsResizing(true);
        setResizeDir(dir);
        setResizeStart({
            x: canvasX,
            y: canvasY,
            initX: typeof el.x === 'number' ? el.x : 0,
            initY: typeof el.y === 'number' ? el.y : 0,
            initW: currentW,
            initH: currentH,
            aspectRatio: currentH > 0 ? currentW / currentH : 1.33
        });
        setSelectedElementId(el.id);
    };

    // Canvas Mouse Down: Start Pencil/Shape Drawing OR Eraser OR Pan
    const handleMouseDownBoard = (e) => {
        if (startMiddlePan(e)) return;

        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isPencilActive) {
            setIsDrawing(true);
            setCurrentPoints([{ x: canvasX, y: canvasY }, { x: canvasX, y: canvasY }]);
            return;
        }

        if (isEraserActive) {
            setIsDrawing(true); // Active erasing drag mode
            return;
        }

        setSelectedElementId(null);
        setConnectingSourceId(null);
        setIsPanning(true);
        panStartRef.current = {
            x: e.clientX - pan.x,
            y: e.clientY - pan.y
        };
    };

    // Element Drag Start
    const handleMouseDownElement = (e, el) => {
        if (startMiddlePan(e)) return;
        e.stopPropagation();

        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isPencilActive) {
            setIsDrawing(true);
            setCurrentPoints([{ x: canvasX, y: canvasY }, { x: canvasX, y: canvasY }]);
            return;
        }

        if (isEraserActive) {
            if (el.type === 'drawing') {
                handleDeleteElement(el.id);
            }
            return;
        }

        if (connectingSourceId) {
            handleConnectToElement(el.id);
            return;
        }

        setSelectedElementId(el.id);
        if (!el.isLocked) {
            setIsDragging(true);
            setDragOffset({
                x: canvasX - (typeof el.x === 'number' ? el.x : 0),
                y: canvasY - (typeof el.y === 'number' ? el.y : 0)
            });
        }
    };

    // Drawing Element Drag Start (for quick shapes like line, arrow, rectangle, circle)
    const handleMouseDownDrawing = (e, draw) => {
        if (startMiddlePan(e)) return;
        e.stopPropagation();

        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isPencilActive) {
            setIsDrawing(true);
            setCurrentPoints([{ x: canvasX, y: canvasY }, { x: canvasX, y: canvasY }]);
            return;
        }

        if (isEraserActive) {
            handleDeleteElement(draw.id);
            return;
        }

        if (connectingSourceId) {
            handleConnectToElement(draw.id);
            return;
        }

        setSelectedElementId(draw.id);

        // Movable shapes (all shapes EXCEPT 'free' hand pencil)
        if (draw.shape && draw.shape !== 'free' && !draw.isLocked) {
            setIsDragging(true);
            setDragDrawingStart({
                startX: canvasX,
                startY: canvasY,
                initialPoints: (draw.points || []).map(p => ({ ...p }))
            });
        }
    };

    // Canvas Mouse Move: Draw Freehand/Shape OR Resizing Element OR Pan Canvas OR Drag Element
    const handleMouseMoveBoard = (e) => {
        // Priority 1: Middle Mouse Wheel Panning (Overrides Pencil, Eraser, Dragging & Resizing)
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

        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isResizing && selectedElementId && resizeDir) {
            const dx = canvasX - resizeStart.x;
            const dy = canvasY - resizeStart.y;
            let { initX, initY, initW, initH, aspectRatio } = resizeStart;

            let newW = initW;
            let newH = initH;
            let newX = initX;
            let newY = initY;

            const el = boardElements.find(item => item.id === selectedElementId);
            const isImage = el && el.type === 'image';

            if (resizeDir === 'e') {
                // Estirar solo ancho (derecha)
                newW = Math.max(60, initW + dx);
                newH = initH;
            } else if (resizeDir === 'w') {
                // Estirar solo ancho (izquierda)
                newW = Math.max(60, initW - dx);
                newX = initX + (initW - newW);
                newH = initH;
            } else if (resizeDir === 's') {
                // Estirar solo alto (abajo)
                newH = Math.max(40, initH + dy);
                newW = initW;
            } else if (resizeDir === 'n') {
                // Estirar solo alto (arriba)
                newH = Math.max(40, initH - dy);
                newY = initY + (initH - newH);
                newW = initW;
            } else if (resizeDir === 'se') {
                // Esquina inferior derecha: ambos
                newW = Math.max(60, initW + dx);
                newH = isImage && aspectRatio ? Math.round(newW / aspectRatio) : Math.max(40, initH + dy);
            } else if (resizeDir === 'sw') {
                // Esquina inferior izquierda: ambos
                newW = Math.max(60, initW - dx);
                newX = initX + (initW - newW);
                newH = isImage && aspectRatio ? Math.round(newW / aspectRatio) : Math.max(40, initH + dy);
            } else if (resizeDir === 'ne') {
                // Esquina superior derecha: ambos
                newW = Math.max(60, initW + dx);
                newH = isImage && aspectRatio ? Math.round(newW / aspectRatio) : Math.max(40, initH - dy);
                if (!isImage || !aspectRatio) newY = initY + (initH - newH);
            } else if (resizeDir === 'nw') {
                // Esquina superior izquierda: ambos
                newW = Math.max(60, initW - dx);
                newX = initX + (initW - newW);
                newH = isImage && aspectRatio ? Math.round(newW / aspectRatio) : Math.max(40, initH - dy);
                if (!isImage || !aspectRatio) newY = initY + (initH - newH);
            }

            updateElement(selectedElementId, { x: newX, y: newY, width: newW, height: newH });
            return;
        }

        if (isPencilActive && isDrawing) {
            if (pencilShape === 'free') {
                setCurrentPoints(prev => [...prev, { x: canvasX, y: canvasY }]);
            } else {
                setCurrentPoints(prev => [prev[0], { x: canvasX, y: canvasY }]);
            }
            return;
        }

        if (isDragging && selectedElementId) {
            const el = boardElements.find(item => item.id === selectedElementId);
            if (el && el.isLocked) return;

            if (el.type === 'drawing' && el.shape && el.shape !== 'free') {
                if (dragDrawingStart.initialPoints && dragDrawingStart.initialPoints.length > 0) {
                    const dx = canvasX - dragDrawingStart.startX;
                    const dy = canvasY - dragDrawingStart.startY;
                    const newPoints = dragDrawingStart.initialPoints.map(p => ({
                        x: p.x + dx,
                        y: p.y + dy
                    }));
                    updateElement(selectedElementId, { points: newPoints });
                }
            } else {
                let newX = canvasX - dragOffset.x;
                let newY = canvasY - dragOffset.y;
                updateElement(selectedElementId, { x: newX, y: newY });
            }
        }
    };

    // Canvas Mouse Up: Save Freehand/Shape Stroke OR Finish Resize/Drag/Pan
    const handleMouseUpBoard = () => {
        if (isResizing) {
            setIsResizing(false);
            setResizeDir(null);
            return;
        }

        if (isPencilActive && isDrawing) {
            setIsDrawing(false);
            if (currentPoints.length >= 2) {
                const newDrawing = {
                    id: 'draw-' + Date.now(),
                    type: 'drawing',
                    points: currentPoints,
                    shape: pencilShape,
                    color: pencilColor,
                    strokeWidth: pencilWidth
                };
                pushHistory([...boardElements, newDrawing]);
            }
            setCurrentPoints([]);
            return;
        }

        if (isEraserActive) {
            setIsDrawing(false);
            return;
        }

        setIsDragging(false);
        setIsPanning(false);
    };

    // Global Mouse Move & Mouse Up Listener to ensure smooth panning, dragging, and resizing anywhere
    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
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
            }
        };

        const handleGlobalMouseUp = (e) => {
            if (e.button === 1 || (e.buttons & 4) === 0) {
                if (isPanning) {
                    setIsPanning(false);
                }
            }
            if (isResizing) {
                setIsResizing(false);
                setResizeDir(null);
            }
            if (isDragging) {
                setIsDragging(false);
            }
        };

        if (isResizing || isDragging || isPanning) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleGlobalMouseMove);
                window.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [isResizing, isDragging, isPanning, pan]);

    // Convert Points Array to SVG Path String
    const pointsToSvgPath = (pts) => {
        if (!pts || pts.length === 0) return '';
        return pts.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
    };

    const selectedElement = boardElements.find(el => el.id === selectedElementId);
    const threadsList = boardElements.filter(el => el.type === 'thread');
    const drawingsList = boardElements.filter(el => el.type === 'drawing');

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#cbd5e1' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem', width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{language === 'es' ? 'Cargando credenciales de SEB...' : 'Loading SEB credentials...'}</p>
                </div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div style={{ padding: '3rem 1.5rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '20px',
                    padding: '3rem 2rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)'
                }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>

                    <h2 style={{ fontSize: '1.6rem', color: '#ffffff', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
                        {language === 'es' ? 'Acceso Restringido' : 'Restricted Access'}
                    </h2>
                    <h3 style={{ fontSize: '0.85rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem', fontWeight: 600 }}>
                        Special Enforcement Bureau (SEB)
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                        {language === 'es' 
                            ? 'Este apartado está reservado exclusivamente para agentes asignados al rango/división SEB o personal con rango de Coordinador, Comisionado o Administrador.'
                            : 'This section is strictly reserved for SEB Agent rank/division personnel or Coordination/Commissioner/Admin roles.'}
                    </p>

                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            padding: '0.7rem 1.8rem',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        {language === 'es' ? 'Volver al Inicio' : 'Return to Dashboard'}
                    </button>
                </div>
            </div>
        );
    }

    const activeOpsCount = operations.filter(op => op.status !== 'Finalizado').length;
    const archivedOpsCount = operations.filter(op => op.status === 'Finalizado').length;

    const filteredOperations = operations.filter(op => {
        const matchesSearch = 
            (op.title && op.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (op.location && op.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (op.type && op.type.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (opsSubTab === 'archived') {
            return op.status === 'Finalizado';
        } else {
            return op.status !== 'Finalizado';
        }
    });

    return (
        <div className="mac-dashboard-container" style={{ maxWidth: '1350px', margin: '0 auto', paddingBottom: '3rem' }}>
            
            {/* Apple-Style Command Header */}
            <div style={{ 
                marginBottom: '2rem', 
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '1.75rem 2.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(234, 179, 8, 0.1)'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <path d="m9 12 2 2 4-4"/>
                        </svg>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                            <span style={{ 
                                display: 'inline-block', 
                                width: '7px', 
                                height: '7px', 
                                borderRadius: '50%', 
                                backgroundColor: '#eab308', 
                                boxShadow: '0 0 6px #eab308' 
                            }}></span>
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Special Enforcement Bureau
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'División Operativa de Alto Riesgo' : 'High Risk Tactical Division'}
                        </h1>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                            {language === 'es' ? 'Tablón de operaciones y planificación táctica interactiva.' : 'Operations board and interactive tactical planning.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TABLÓN DE OPERACIONES */}
            {!selectedOp && (
                <div>
                    {/* Search & New Operation Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
                            <input
                                type="text"
                                placeholder={language === 'es' ? 'Buscar operaciones por nombre, zona o tipo...' : 'Search operations by name, location or type...'}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '12px',
                                    padding: '0.65rem 1rem 0.65rem 2.5rem',
                                    color: '#ffffff',
                                    fontSize: '0.88rem'
                                }}
                            />
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }}>
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </div>

                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            style={{
                                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(202, 138, 4, 0.15) 100%)',
                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                color: '#fef08a',
                                padding: '0.65rem 1.3rem',
                                borderRadius: '12px',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 14px rgba(234, 179, 8, 0.15)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.35)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(202, 138, 4, 0.15) 100%)'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            {language === 'es' ? 'Registrar Nueva Operación' : 'Register New Operation'}
                        </button>
                    </div>

                    {/* Sub-Tabs: Activas vs Archivo de Operativos */}
                    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
                        <button
                            onClick={() => setOpsSubTab('active')}
                            style={{
                                padding: '0.5rem 1.25rem',
                                fontSize: '0.82rem',
                                borderRadius: '9999px',
                                background: opsSubTab === 'active' ? 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' : 'rgba(255, 255, 255, 0.06)',
                                color: opsSubTab === 'active' ? '#0f172a' : '#cbd5e1',
                                border: `1px solid ${opsSubTab === 'active' ? '#eab308' : 'rgba(255, 255, 255, 0.12)'}`,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                boxShadow: opsSubTab === 'active' ? '0 4px 14px rgba(234, 179, 8, 0.3)' : 'none'
                            }}
                        >
                            <span>⚡</span>
                            <span>{language === 'es' ? 'Operaciones Activas' : 'Active Operations'}</span>
                            <span style={{
                                background: opsSubTab === 'active' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.1)',
                                padding: '0.1rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem'
                            }}>{activeOpsCount}</span>
                        </button>

                        <button
                            onClick={() => setOpsSubTab('archived')}
                            style={{
                                padding: '0.5rem 1.25rem',
                                fontSize: '0.82rem',
                                borderRadius: '9999px',
                                background: opsSubTab === 'archived' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                                color: opsSubTab === 'archived' ? '#ffffff' : '#cbd5e1',
                                border: `1px solid ${opsSubTab === 'archived' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)'}`,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem'
                            }}
                        >
                            <span>📁</span>
                            <span>{language === 'es' ? 'Archivo de Operativos' : 'Operations Archive'}</span>
                            <span style={{
                                background: opsSubTab === 'archived' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                                padding: '0.1rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem'
                            }}>{archivedOpsCount}</span>
                        </button>
                    </div>

                    {/* Operations Cards */}
                    {filteredOperations.length === 0 ? (
                        <div style={{ padding: '3.5rem 2rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{opsSubTab === 'archived' ? '📁' : '⚡'}</div>
                            <p style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#f1f5f9' }}>
                                {opsSubTab === 'archived' 
                                    ? (language === 'es' ? 'No hay operaciones en el archivo de finalizados.' : 'No operations in the finished archive.') 
                                    : (language === 'es' ? 'No hay operaciones tácticas activas.' : 'No active tactical operations.')}
                            </p>
                            <p style={{ fontSize: '0.82rem', marginTop: '0.4rem', color: '#64748b' }}>
                                {opsSubTab === 'archived'
                                    ? (language === 'es' ? 'Las operaciones finalizadas aparecerán aquí.' : 'Finished operations will appear here.')
                                    : (language === 'es' ? 'Haz clic en "Registrar Nueva Operación" para iniciar un despliegue.' : 'Click "Register New Operation" to launch a deployment.')}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                            {filteredOperations.map(op => (
                                <div 
                                    key={op.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.65)',
                                        border: op.status === 'Finalizado' ? '1px solid rgba(100, 116, 139, 0.25)' : '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '16px',
                                        padding: '1.35rem',
                                        position: 'relative',
                                        backdropFilter: 'blur(10px)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                        opacity: op.status === 'Finalizado' ? 0.88 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#eab308', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                {op.type}
                                            </span>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                padding: '0.2rem 0.65rem',
                                                borderRadius: '12px',
                                                background: op.status === 'Finalizado' 
                                                    ? 'rgba(100, 116, 139, 0.2)' 
                                                    : op.status === 'Planificado' 
                                                    ? 'rgba(59, 130, 246, 0.15)' 
                                                    : 'rgba(234, 179, 8, 0.12)',
                                                color: op.status === 'Finalizado' 
                                                    ? '#cbd5e1' 
                                                    : op.status === 'Planificado' 
                                                    ? '#60a5fa' 
                                                    : '#facc15',
                                                border: `1px solid ${op.status === 'Finalizado' 
                                                    ? 'rgba(100, 116, 139, 0.3)' 
                                                    : op.status === 'Planificado' 
                                                    ? 'rgba(59, 130, 246, 0.3)' 
                                                    : 'rgba(234, 179, 8, 0.25)'}`
                                            }}>
                                                {op.status === 'Finalizado' ? '📁 Finalizado' : op.status || 'En Progreso'}
                                            </span>
                                        </div>

                                        <h3 style={{ fontSize: '1.15rem', color: '#ffffff', fontWeight: 700, margin: '0 0 0.4rem 0', letterSpacing: '-0.01em' }}>
                                            {op.title}
                                        </h3>

                                        <div style={{ fontSize: '0.84rem', color: '#e2e8f0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                                <circle cx="12" cy="10" r="3"/>
                                            </svg>
                                            <strong style={{ fontWeight: 600 }}>Zona de Despliegue:</strong> {op.location}
                                        </div>

                                        {op.details && (
                                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '0.75rem', background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <strong style={{ color: '#cbd5e1' }}>Detalles:</strong> {op.details}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons Row (Open Board, Edit, Finalize/Reopen, Delete) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                                        <button
                                            onClick={() => handleOpenBoard(op)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(234, 179, 8, 0.14)',
                                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                                color: '#fef08a',
                                                padding: '0.6rem',
                                                borderRadius: '10px',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(234, 179, 8, 0.25)';
                                                e.currentTarget.style.borderColor = '#eab308';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(234, 179, 8, 0.14)';
                                                e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.35)';
                                            }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                                <polyline points="21 15 16 10 5 21"/>
                                            </svg>
                                            {language === 'es' ? 'Abrir Pizarra Táctica' : 'Open Tactical Board'}
                                        </button>

                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button
                                                onClick={() => handleOpenEditModal(op)}
                                                title={language === 'es' ? 'Editar Operación' : 'Edit Operation'}
                                                style={{
                                                    flex: 1,
                                                    background: 'rgba(255, 255, 255, 0.07)',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    color: '#e2e8f0',
                                                    padding: '0.45rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.35rem',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                                            >
                                                ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                                            </button>

                                            <button
                                                onClick={() => handleToggleArchiveStatus(op)}
                                                title={op.status === 'Finalizado' ? (language === 'es' ? 'Reactivar Operación' : 'Reactivate Operation') : (language === 'es' ? 'Finalizar y Archivar Operación' : 'Finalize & Archive Operation')}
                                                style={{
                                                    flex: 1,
                                                    background: op.status === 'Finalizado' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                                                    border: `1px solid ${op.status === 'Finalizado' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                                                    color: op.status === 'Finalizado' ? '#86efac' : '#cbd5e1',
                                                    padding: '0.45rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.35rem',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                            >
                                                {op.status === 'Finalizado' ? '⚡ Reactivar' : '📁 Finalizar'}
                                            </button>

                                            <button
                                                onClick={() => handleDeleteOperation(op.id, op.title)}
                                                title={language === 'es' ? 'Eliminar Operación' : 'Delete Operation'}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171',
                                                    padding: '0.45rem 0.75rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* SELECTED OPERATION: FULLSCREEN APPLE MACOS TACTICAL BOARD MODAL */}
            {activeTab === 'ops' && selectedOp && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    background: '#090d16',
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
                        userSelect: 'none',
                        flexShrink: 0
                    }}>
                        {/* Traffic light buttons with macOS hover animation */}
                        <div className="mac-window-dots">
                            <div
                                className="mac-window-dot close"
                                onClick={() => { setSelectedOp(null); setConnectingSourceId(null); setIsPencilActive(false); setIsEraserActive(false); }}
                                title="Cerrar Pizarra (Esc)"
                            />
                            <div
                                className="mac-window-dot min"
                                onClick={() => { setSelectedOp(null); setConnectingSourceId(null); setIsPencilActive(false); setIsEraserActive(false); }}
                                title="Minimizar (Esc)"
                            />
                            <div
                                className="mac-window-dot max"
                                title="Pantalla Completa"
                            />
                        </div>

                        {/* Title & Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h2 style={{ fontSize: '1.05rem', color: '#ffffff', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
                                {selectedOp.title}
                            </h2>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                📍 {selectedOp.location} • <span style={{ color: '#eab308' }}>{selectedOp.type}</span>
                            </span>
                        </div>

                        {/* Board Controls Toolbar */}
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleImageUploadToBoard}
                                style={{ display: 'none' }}
                            />

                            {/* Undo (Ctrl + Z) Button */}
                            <button
                                onClick={handleUndo}
                                disabled={history.length === 0}
                                title="Deshacer última acción (Ctrl + Z)"
                                style={{
                                    background: history.length > 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                                    border: `1px solid ${history.length > 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                                    color: history.length > 0 ? '#ffffff' : '#64748b',
                                    padding: '0.55rem 0.9rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: history.length > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1 4 1 10 7 10"/>
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                                </svg>
                                Deshacer (Ctrl+Z)
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingImage}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#ffffff',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                {isUploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                            </button>

                            <button
                                onClick={handleOpenAddNoteModal}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#ffffff',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                Añadir Nota
                            </button>

                            <button
                                onClick={handleAddTextToBoard}
                                style={{
                                    background: 'rgba(234, 179, 8, 0.2)',
                                    border: '1px solid #eab308',
                                    color: '#fef08a',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="4 7 4 4 20 4 20 7"/>
                                    <line x1="12" y1="4" x2="12" y2="20"/>
                                    <line x1="9" y1="20" x2="15" y2="20"/>
                                </svg>
                                + Texto Libre
                            </button>

                            {/* Tactical Pencil Tool Button */}
                            <button
                                onClick={() => {
                                    setIsPencilActive(!isPencilActive);
                                    setIsEraserActive(false);
                                    setConnectingSourceId(null);
                                }}
                                style={{
                                    background: isPencilActive ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    border: `1px solid ${isPencilActive ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                    color: isPencilActive ? '#fef08a' : '#ffffff',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                </svg>
                                {isPencilActive ? 'Modo Lápiz Activo' : 'Lápiz'}
                            </button>

                            {/* Eraser Tool Button */}
                            <button
                                onClick={() => {
                                    setIsEraserActive(!isEraserActive);
                                    setIsPencilActive(false);
                                    setConnectingSourceId(null);
                                }}
                                style={{
                                    background: isEraserActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    border: `1px solid ${isEraserActive ? '#ef4444' : 'rgba(255, 255, 255, 0.2)'}`,
                                    color: isEraserActive ? '#fca5a5' : '#ffffff',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="m7 21-4-4 10-10 6 6-10 10z"/>
                                    <path d="m18 11 3 3-4 4h-4"/>
                                </svg>
                                {isEraserActive ? 'Goma Activa' : 'Goma'}
                            </button>

                            {/* Thread Creation Toggle Button */}
                            <button
                                onClick={() => {
                                    if (connectingSourceId) {
                                        setConnectingSourceId(null);
                                    } else if (selectedElementId) {
                                        startConnectingThread(selectedElementId);
                                    } else {
                                        alert(language === 'es' ? 'Selecciona primero un elemento en el tablero para conectarlo con un hilo rojo.' : 'Select an element first to connect it with a red thread.');
                                    }
                                }}
                                style={{
                                    background: connectingSourceId ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    border: `1px solid ${connectingSourceId ? '#ef4444' : 'rgba(255, 255, 255, 0.2)'}`,
                                    color: connectingSourceId ? '#fca5a5' : '#ffffff',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={connectingSourceId ? '#ef4444' : 'currentColor'} strokeWidth="2.5">
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                    <circle cx="5" cy="12" r="2.5" fill="#ef4444"/>
                                    <circle cx="19" cy="12" r="2.5" fill="#ef4444"/>
                                </svg>
                                {connectingSourceId ? 'Haz clic en el 2º elemento...' : 'Unir con Hilo Rojo'}
                            </button>

                            {/* Live Auto-Save Status Indicator */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                color: savingBoard ? '#eab308' : '#22c55e',
                                background: savingBoard ? 'rgba(234, 179, 8, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                                border: `1px solid ${savingBoard ? 'rgba(234, 179, 8, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
                                padding: '0.5rem 0.9rem',
                                borderRadius: '10px',
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                            }}>
                                <span style={{ 
                                    width: '7px', 
                                    height: '7px', 
                                    borderRadius: '50%', 
                                    background: savingBoard ? '#eab308' : '#22c55e', 
                                    boxShadow: `0 0 6px ${savingBoard ? '#eab308' : '#22c55e'}`,
                                    display: 'inline-block' 
                                }}></span>
                                {savingBoard ? 'Guardando cambios en la nube...' : 'Guardado automáticamente'}
                            </div>
                        </div>
                    </div>

                    {/* Pencil Tools Sub-Toolbar (When Pencil is active) */}
                    {isPencilActive && (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid #eab308',
                            borderRadius: '12px',
                            padding: '0.55rem 1.25rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 6px 20px rgba(0,0,0,0.4)'
                        }}>
                            {/* Quick Shape Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8rem', color: '#eab308', fontWeight: 700, marginRight: '0.2rem' }}>Forma Táctica:</span>
                                {[
                                    { id: 'free', label: 'Libre', title: 'Dibujo a Mano Alzada', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
                                    { id: 'line', label: 'Línea', title: 'Línea Recta Táctica', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg> },
                                    { id: 'arrow', label: 'Flecha', title: 'Flecha Táctica de Dirección', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg> },
                                    { id: 'rectangle', label: 'Cuadrado', title: 'Caja / Rectángulo Táctico', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
                                    { id: 'circle', label: 'Círculo', title: 'Círculo / Óvalo Táctico', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/></svg> }
                                ].map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setPencilShape(s.id)}
                                        title={s.title}
                                        style={{
                                            background: pencilShape === s.id ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                                            border: `1px solid ${pencilShape === s.id ? '#eab308' : 'rgba(255,255,255,0.15)'}`,
                                            color: pencilShape === s.id ? '#fef08a' : '#cbd5e1',
                                            padding: '0.3rem 0.65rem',
                                            borderRadius: '6px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {s.icon}
                                        <span>{s.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                                {/* Color Selector Dots */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Color:</span>
                                    {['#ef4444', '#eab308', '#3b82f6', '#22c55e', '#ffffff'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setPencilColor(c)}
                                            style={{
                                                width: '22px',
                                                height: '22px',
                                                borderRadius: '50%',
                                                backgroundColor: c,
                                                border: pencilColor === c ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.3)',
                                                transform: pencilColor === c ? 'scale(1.2)' : 'scale(1)',
                                                cursor: 'pointer',
                                                boxShadow: pencilColor === c ? `0 0 8px ${c}` : 'none',
                                                transition: 'all 0.15s ease'
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Pencil Thickness Selector */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
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
                                                background: pencilWidth === w.val ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                                border: `1px solid ${pencilWidth === w.val ? '#eab308' : 'rgba(255,255,255,0.15)'}`,
                                                color: pencilWidth === w.val ? '#fef08a' : '#cbd5e1',
                                                padding: '0.25rem 0.55rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {w.label}
                                        </button>
                                    ))}
                                </div>

                                {drawingsList.length > 0 && (
                                    <button
                                        onClick={handleClearDrawings}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            color: '#f87171',
                                            padding: '0.3rem 0.75rem',
                                            borderRadius: '6px',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Borrar Dibujos ({drawingsList.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* INTERACTIVE CANVAS WHITEBOARD */}
                    <div 
                        ref={setBoardRef}
                        onMouseDown={handleMouseDownBoard}
                        onMouseMove={handleMouseMoveBoard}
                        onMouseUp={handleMouseUpBoard}
                        onAuxClick={e => { if (e.button === 1) e.preventDefault(); }}
                        onContextMenu={e => { if (e.button === 1) e.preventDefault(); }}
                        style={{
                            flex: 1,
                            width: '100%',
                            height: '100%',
                            background: '#090d16',
                            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 0)',
                            backgroundSize: '24px 24px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '16px',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.4)',
                            userSelect: 'none',
                            cursor: isPencilActive ? 'crosshair' : isEraserActive ? 'cell' : isPanning ? 'grabbing' : 'grab'
                        }}
                    >
                        {/* Floating Selected Element Controls Bar Overlay (HUD - Positioned absolutely so it NEVER affects canvas height) */}
                        {selectedElement && !isPencilActive && !isEraserActive && (
                            <div 
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                style={{
                                    position: 'absolute',
                                    top: '16px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 2500,
                                    background: 'rgba(15, 23, 42, 0.92)',
                                    border: '1px solid rgba(234, 179, 8, 0.45)',
                                    borderRadius: '16px',
                                    padding: '0.55rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(234, 179, 8, 0.2)',
                                    maxWidth: '92%',
                                    pointerEvents: 'auto'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#eab308', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <span>Elemento Seleccionado ({selectedElement.type === 'image' ? 'Imagen Táctica' : selectedElement.type === 'note' ? 'Nota Táctica' : selectedElement.type === 'thread' ? 'Hilo Conector' : 'Dibujo Trazo'})</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                                    {/* Horizontal & Vertical Resizing Sliders (for Notes & Images) */}
                                    {(selectedElement.type === 'image' || selectedElement.type === 'note') && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#cbd5e1', fontSize: '0.82rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span>Ancho (Horiz):</span>
                                                <input
                                                    type="range"
                                                    min="100"
                                                    max="1000"
                                                    value={selectedElement.width || 300}
                                                    onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })}
                                                    style={{ accentColor: '#eab308', cursor: 'pointer', width: '90px' }}
                                                />
                                                <span>{selectedElement.width || 300}px</span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span>Alto (Vert):</span>
                                                <input
                                                    type="range"
                                                    min="80"
                                                    max="800"
                                                    value={selectedElement.height || 200}
                                                    onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })}
                                                    style={{ accentColor: '#eab308', cursor: 'pointer', width: '90px' }}
                                                />
                                                <span>{selectedElement.height || 200}px</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {selectedElement.type === 'note' && (
                                            <button
                                                onClick={() => handleOpenEditNoteModal(selectedElement)}
                                                style={{
                                                    background: 'rgba(234, 179, 8, 0.2)',
                                                    border: '1px solid #eab308',
                                                    color: '#fef08a',
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Editar Texto
                                            </button>
                                        )}

                                        {selectedElement.type === 'thread' && (
                                            <button
                                                onClick={() => handleEditThreadLabel(selectedElement)}
                                                style={{
                                                    background: 'rgba(234, 179, 8, 0.25)',
                                                    border: '1px solid #eab308',
                                                    color: '#fef08a',
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Editar Texto del Hilo
                                            </button>
                                        )}

                                        {selectedElement.type !== 'thread' && (
                                            <>
                                                <button
                                                     onClick={() => handleDuplicateElement(selectedElement)}
                                                     title="Duplicar elemento (Ctrl+C y Ctrl+V)"
                                                     style={{
                                                         background: 'rgba(59, 130, 246, 0.2)',
                                                         border: '1px solid #3b82f6',
                                                         color: '#93c5fd',
                                                         padding: '0.35rem 0.75rem',
                                                         borderRadius: '8px',
                                                         fontSize: '0.78rem',
                                                         fontWeight: 600,
                                                         cursor: 'pointer'
                                                     }}
                                                 >
                                                     📋 Duplicar (Ctrl+C/V)
                                                 </button>

                                                <button
                                                    onClick={() => toggleLockElement(selectedElement.id)}
                                                    style={{
                                                        background: selectedElement.isLocked ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                                                        border: `1px solid ${selectedElement.isLocked ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                                        color: selectedElement.isLocked ? '#fef08a' : '#ffffff',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {selectedElement.isLocked ? '🔒 Desfijar Posición' : '🔓 Fijar Posición'}
                                                </button>

                                                <button
                                                    onClick={() => startConnectingThread(selectedElement.id)}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        border: '1px solid #ef4444',
                                                        color: '#fca5a5',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Conectar Hilo
                                                </button>

                                                <button
                                                    onClick={() => bringToFront(selectedElement.id)}
                                                    title="Mover elemento al frente"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.1)',
                                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                                        color: '#ffffff',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Traer al Frente
                                                </button>

                                                <button
                                                    onClick={() => sendToBack(selectedElement.id)}
                                                    title="Mover elemento al fondo"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.1)',
                                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                                        color: '#ffffff',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Enviar al Fondo
                                                </button>
                                            </>
                                        )}

                                        <button
                                            onClick={() => handleDeleteElement(selectedElement.id)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Eliminar (Supr)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Floating Zoom & Pan Controls Badge (Bottom-Right) */}
                        <div 
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            style={{
                                position: 'absolute',
                                bottom: '16px',
                                right: '16px',
                                background: 'rgba(15, 23, 42, 0.88)',
                                border: '1px solid rgba(255, 255, 255, 0.18)',
                                borderRadius: '12px',
                                padding: '0.3rem 0.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                zIndex: 9999,
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                            }}
                        >
                            <button
                                onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))}
                                title="Reducir Zoom"
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                            >
                                -
                            </button>
                            <span 
                                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} 
                                title="Restablecer Posición y Zoom (100%)"
                                style={{ color: '#eab308', fontSize: '0.82rem', fontWeight: 700, padding: '0 0.2rem', cursor: 'pointer' }}
                            >
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}
                                title="Aumentar Zoom"
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                            >
                                +
                            </button>
                            <button
                                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                                title="Recentar Tablero"
                                style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#fef08a', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                            >
                                Recentar
                            </button>
                        </div>

                        {/* Inner Scaled & Panned Canvas Container */}
                        <div style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: 'top left',
                            width: `${100 / zoom}%`,
                            height: `${100 / zoom}%`,
                            position: 'relative'
                        }}>

                            {/* SVG THREADS & DRAWINGS LAYER (ALWAYS ON TOP OF IMAGES & NOTES, INFINITE BOUNDS) */}
                            <svg 
                                style={{ 
                                    position: 'absolute', 
                                    top: '-5000px', 
                                    left: '-5000px', 
                                    width: '10000px', 
                                    height: '10000px', 
                                    pointerEvents: 'none', 
                                    zIndex: 1000,
                                    overflow: 'visible' 
                                }}
                                viewBox="-5000 -5000 10000 10000"
                            >
                                {/* Render Saved Connecting Threads */}
                                {threadsList.map(thread => {
                                    const source = boardElements.find(e => e.id === thread.sourceId);
                                    const target = boardElements.find(e => e.id === thread.targetId);
                                    if (!source || !target) return null;

                                    const getElementCenter = (el) => {
                                        if (typeof el.x === 'number') {
                                            return {
                                                x: el.x + (el.width || 260) / 2,
                                                y: el.y + (el.height || 140) / 2
                                            };
                                        }
                                        if (el.points && el.points.length > 0) {
                                            const xs = el.points.map(p => p.x);
                                            const ys = el.points.map(p => p.y);
                                            return {
                                                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                                                y: (Math.min(...ys) + Math.max(...ys)) / 2
                                            };
                                        }
                                        return { x: 0, y: 0 };
                                    };

                                    const sCenter = getElementCenter(source);
                                    const tCenter = getElementCenter(target);
                                    const x1 = sCenter.x;
                                    const y1 = sCenter.y;
                                    const x2 = tCenter.x;
                                    const y2 = tCenter.y;

                                    const midX = (x1 + x2) / 2;
                                    const midY = (y1 + y2) / 2;
                                    const isSelectedThread = thread.id === selectedElementId;

                                    return (
                                        <g key={thread.id}>
                                            {/* Red Tactical Thread Line */}
                                            <line
                                                x1={x1}
                                                y1={y1}
                                                x2={x2}
                                                y2={y2}
                                                stroke={isSelectedThread ? "#eab308" : "#ef4444"}
                                                strokeWidth={isSelectedThread ? "5" : "3.5"}
                                                strokeDasharray="6,4"
                                                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isEraserActive) setSelectedElementId(thread.id);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isEraserActive) handleEditThreadLabel(thread);
                                                }}
                                            />

                                            {/* Midpoint Knot & Label Button */}
                                            <g 
                                                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isEraserActive) return;
                                                    setSelectedElementId(thread.id);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isEraserActive) return;
                                                    handleEditThreadLabel(thread);
                                                }}
                                            >
                                                <circle 
                                                    cx={midX} 
                                                    cy={midY} 
                                                    r={isSelectedThread ? "9" : "7"} 
                                                    fill={isSelectedThread ? "#eab308" : "#ef4444"} 
                                                    stroke="#ffffff" 
                                                    strokeWidth="2" 
                                                />
                                                {thread.label && (
                                                    <text
                                                        x={midX}
                                                        y={midY - 12}
                                                        fill={isSelectedThread ? "#fef08a" : "#fca5a5"}
                                                        fontSize="11"
                                                        fontWeight="700"
                                                        textAnchor="middle"
                                                        style={{ 
                                                            background: 'rgba(0,0,0,0.85)', 
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            filter: isSelectedThread ? 'drop-shadow(0 0 6px #eab308)' : 'none' 
                                                        }}
                                                    >
                                                        {thread.label}
                                                    </text>
                                                )}
                                            </g>
                                        </g>
                                    );
                                })}

                                {/* Render Saved Drawings & Quick Shapes */}
                                {drawingsList.map(draw => {
                                    const isSelectedDraw = draw.id === selectedElementId;
                                    const shape = draw.shape || 'free';
                                    const color = isSelectedDraw ? '#eab308' : (draw.color || '#ef4444');
                                    const width = (draw.strokeWidth || 3) + (isSelectedDraw ? 3 : 0);
                                    const pts = draw.points || [];

                                    if (!pts || pts.length === 0) return null;

                                    let elementNode = null;

                                    if (shape === 'line' && pts.length >= 2) {
                                        elementNode = (
                                            <line
                                                x1={pts[0].x}
                                                y1={pts[0].y}
                                                x2={pts[pts.length - 1].x}
                                                y2={pts[pts.length - 1].y}
                                                stroke={color}
                                                strokeWidth={width}
                                                strokeLinecap="round"
                                            />
                                        );
                                    } else if (shape === 'arrow' && pts.length >= 2) {
                                        const x1 = pts[0].x;
                                        const y1 = pts[0].y;
                                        const x2 = pts[pts.length - 1].x;
                                        const y2 = pts[pts.length - 1].y;

                                        const angle = Math.atan2(y2 - y1, x2 - x1);
                                        const headLen = Math.max(14, width * 3.5);
                                        const ax1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
                                        const ay1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
                                        const ax2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
                                        const ay2 = y2 - headLen * Math.sin(angle + Math.PI / 6);

                                        elementNode = (
                                            <g>
                                                <line
                                                    x1={x1}
                                                    y1={y1}
                                                    x2={x2}
                                                    y2={y2}
                                                    stroke={color}
                                                    strokeWidth={width}
                                                    strokeLinecap="round"
                                                />
                                                <polygon
                                                    points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
                                                    fill={color}
                                                    stroke={color}
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
                                        elementNode = (
                                            <rect
                                                x={minX}
                                                y={minY}
                                                width={w}
                                                height={h}
                                                stroke={color}
                                                strokeWidth={width}
                                                fill="none"
                                                rx="4"
                                            />
                                        );
                                    } else if (shape === 'circle' && pts.length >= 2) {
                                        const cx = (pts[0].x + pts[pts.length - 1].x) / 2;
                                        const cy = (pts[0].y + pts[pts.length - 1].y) / 2;
                                        const rx = Math.abs(pts[pts.length - 1].x - pts[0].x) / 2;
                                        const ry = Math.abs(pts[pts.length - 1].y - pts[0].y) / 2;
                                        elementNode = (
                                            <ellipse
                                                cx={cx}
                                                cy={cy}
                                                rx={rx}
                                                ry={ry}
                                                stroke={color}
                                                strokeWidth={width}
                                                fill="none"
                                            />
                                        );
                                    } else {
                                        elementNode = (
                                            <path
                                                d={pointsToSvgPath(pts)}
                                                stroke={color}
                                                strokeWidth={width}
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        );
                                    }

                                    const isMovableShape = shape !== 'free';

                                    return (
                                        <g
                                            key={draw.id}
                                            onMouseDown={(e) => handleMouseDownDrawing(e, draw)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isEraserActive) {
                                                    handleDeleteElement(draw.id);
                                                } else {
                                                    setSelectedElementId(draw.id);
                                                }
                                            }}
                                            onMouseEnter={() => {
                                                if (isEraserActive && isDrawing) {
                                                    handleDeleteElement(draw.id);
                                                }
                                            }}
                                            style={{ 
                                                pointerEvents: 'auto', 
                                                cursor: isEraserActive ? 'cell' : isPencilActive ? 'crosshair' : (isMovableShape ? 'grab' : 'pointer'),
                                                filter: isSelectedDraw ? 'drop-shadow(0 0 6px #eab308)' : 'none'
                                            }}
                                        >
                                            {elementNode}
                                        </g>
                                    );
                                })}

                                {/* Render Active Freehand / Shape Stroke being drawn */}
                                {isDrawing && isPencilActive && currentPoints.length >= 2 && (
                                    <>
                                        {pencilShape === 'line' ? (
                                            <line
                                                x1={currentPoints[0].x}
                                                y1={currentPoints[0].y}
                                                x2={currentPoints[currentPoints.length - 1].x}
                                                y2={currentPoints[currentPoints.length - 1].y}
                                                stroke={pencilColor}
                                                strokeWidth={pencilWidth}
                                                strokeLinecap="round"
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
                                                        <line
                                                            x1={x1}
                                                            y1={y1}
                                                            x2={x2}
                                                            y2={y2}
                                                            stroke={pencilColor}
                                                            strokeWidth={pencilWidth}
                                                            strokeLinecap="round"
                                                        />
                                                        <polygon
                                                            points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
                                                            fill={pencilColor}
                                                            stroke={pencilColor}
                                                            strokeWidth="1"
                                                            strokeLinejoin="round"
                                                        />
                                                    </g>
                                                );
                                            })()
                                        ) : pencilShape === 'rectangle' ? (
                                            <rect
                                                x={Math.min(currentPoints[0].x, currentPoints[currentPoints.length - 1].x)}
                                                y={Math.min(currentPoints[0].y, currentPoints[currentPoints.length - 1].y)}
                                                width={Math.abs(currentPoints[currentPoints.length - 1].x - currentPoints[0].x)}
                                                height={Math.abs(currentPoints[currentPoints.length - 1].y - currentPoints[0].y)}
                                                stroke={pencilColor}
                                                strokeWidth={pencilWidth}
                                                fill="none"
                                                rx="4"
                                            />
                                        ) : pencilShape === 'circle' ? (
                                            <ellipse
                                                cx={(currentPoints[0].x + currentPoints[currentPoints.length - 1].x) / 2}
                                                cy={(currentPoints[0].y + currentPoints[currentPoints.length - 1].y) / 2}
                                                rx={Math.abs(currentPoints[currentPoints.length - 1].x - currentPoints[0].x) / 2}
                                                ry={Math.abs(currentPoints[currentPoints.length - 1].y - currentPoints[0].y) / 2}
                                                stroke={pencilColor}
                                                strokeWidth={pencilWidth}
                                                fill="none"
                                            />
                                        ) : (
                                            <path
                                                d={pointsToSvgPath(currentPoints)}
                                                stroke={pencilColor}
                                                strokeWidth={pencilWidth}
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        )}
                                    </>
                                )}
                            </svg>

                            {boardElements.length === 0 && !isDrawing && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    textAlign: 'center',
                                    color: '#64748b',
                                    pointerEvents: 'none'
                                }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', opacity: 0.4 }}>
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="3" y1="9" x2="21" y2="9"/>
                                        <line x1="9" y1="21" x2="9" y2="9"/>
                                    </svg>
                                    <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.05rem', fontWeight: 600 }}>Tablero Táctico Vacío</h3>
                                    <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>Usa las herramientas superiores para añadir imágenes, notas, hilos o dibujos a mano alzada.</p>
                                </div>
                            )}

                            {/* Render Board Elements (Images & Notes) */}
                            {boardElements.map(el => {
                                if (el.type === 'thread' || el.type === 'drawing') return null;

                                const isSelected = el.id === selectedElementId;
                                const isConnectingSource = el.id === connectingSourceId;

                                if (el.type === 'image') {
                                    return (
                                        <div
                                            key={el.id}
                                            onMouseDown={e => handleMouseDownElement(e, el)}
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (isPencilActive || isEraserActive) return;
                                                if (connectingSourceId) {
                                                    handleConnectToElement(el.id);
                                                } else {
                                                    setSelectedElementId(el.id);
                                                }
                                            }}
                                            style={{
                                                position: 'absolute',
                                                left: `${el.x}px`,
                                                top: `${el.y}px`,
                                                width: `${el.width || 300}px`,
                                                height: el.height ? `${el.height}px` : 'auto',
                                                zIndex: el.zIndex || 2,
                                                cursor: isPencilActive ? 'crosshair' : isEraserActive ? 'cell' : el.isLocked ? 'default' : isDragging && isSelected ? 'grabbing' : 'grab',
                                                border: isConnectingSource 
                                                    ? '2.5px solid #ef4444' 
                                                    : isSelected 
                                                    ? '2px dashed #eab308' 
                                                    : 'none',
                                                boxShadow: isSelected ? '0 0 20px rgba(234, 179, 8, 0.4)' : 'none',
                                                borderRadius: '8px',
                                                background: 'transparent',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'visible',
                                                transition: isDragging ? 'none' : 'border-color 0.2s ease, box-shadow 0.2s ease'
                                            }}
                                        >
                                            <img 
                                                src={getProfileImage(el.url, el.url)}
                                                alt="Tactical Element"
                                                style={{
                                                    width: '100%',
                                                    height: el.height ? '100%' : 'auto',
                                                    objectFit: el.height ? 'fill' : 'contain',
                                                    borderRadius: '8px',
                                                    display: 'block',
                                                    pointerEvents: 'none'
                                                }}
                                            />

                                            {/* Lock Indicator Badge */}
                                            {el.isLocked && (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleLockElement(el.id);
                                                    }}
                                                    title="Imagen fijada. Clic para desfijar."
                                                    style={{
                                                        position: 'absolute',
                                                        top: '8px',
                                                        right: '8px',
                                                        background: 'rgba(15, 23, 42, 0.9)',
                                                        border: '1.5px solid #eab308',
                                                        borderRadius: '6px',
                                                        padding: '2px 6px',
                                                        color: '#fef08a',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                                                        zIndex: (el.zIndex || 2) + 20,
                                                        backdropFilter: 'blur(8px)'
                                                    }}
                                                >
                                                    🔒 Fijada
                                                </div>
                                            )}

                                            {/* 8 Corner & Edge Drag Resizing Handles (Only when NOT locked) */}
                                            {isSelected && !isPencilActive && !isEraserActive && !el.isLocked && (
                                                <>
                                                    {[
                                                        { dir: 'nw', top: '-6px', left: '-6px', cursor: 'nwse-resize' },
                                                        { dir: 'n', top: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize' },
                                                        { dir: 'ne', top: '-6px', right: '-6px', cursor: 'nesw-resize' },
                                                        { dir: 'e', top: 'calc(50% - 6px)', right: '-6px', cursor: 'ew-resize' },
                                                        { dir: 'se', bottom: '-6px', right: '-6px', cursor: 'nwse-resize' },
                                                        { dir: 's', bottom: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize' },
                                                        { dir: 'sw', bottom: '-6px', left: '-6px', cursor: 'nesw-resize' },
                                                        { dir: 'w', top: 'calc(50% - 6px)', left: '-6px', cursor: 'ew-resize' }
                                                    ].map(h => (
                                                        <div
                                                            key={h.dir}
                                                            onMouseDown={e => handleMouseDownResize(e, el, h.dir)}
                                                            style={{
                                                                position: 'absolute',
                                                                top: h.top,
                                                                bottom: h.bottom,
                                                                left: h.left,
                                                                right: h.right,
                                                                width: '12px',
                                                                height: '12px',
                                                                backgroundColor: '#ffffff',
                                                                border: '2px solid #eab308',
                                                                borderRadius: '50%',
                                                                cursor: h.cursor,
                                                                boxShadow: '0 0 8px rgba(234, 179, 8, 0.9)',
                                                                zIndex: (el.zIndex || 2) + 50
                                                            }}
                                                        />
                                                    ))}
                                                </>
                                            )}

                                            {/* Quick On-Card Controls when selected */}
                                            {isSelected && !isPencilActive && !isEraserActive && (
                                                <div 
                                                    onClick={e => e.stopPropagation()}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-42px',
                                                        right: '0',
                                                        background: 'rgba(15, 23, 42, 0.95)',
                                                        border: '1px solid #eab308',
                                                        borderRadius: '10px',
                                                        padding: '0.25rem 0.5rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
                                                        backdropFilter: 'blur(10px)',
                                                        zIndex: 9999
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => toggleLockElement(el.id)}
                                                        title={el.isLocked ? "Desfijar Posición" : "Fijar Posición en el Tablero"}
                                                        style={{
                                                            background: el.isLocked ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                            border: `1px solid ${el.isLocked ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                                            color: el.isLocked ? '#fef08a' : '#ffffff',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {el.isLocked ? '🔒 Fijada' : '🔓 Fijar'}
                                                    </button>

                                                    <button
                                                        onClick={() => setExpandedImage(getProfileImage(el.url, el.url))}
                                                        title="Ver Imagen Completa"
                                                        style={{ background: 'rgba(59, 130, 246, 0.25)', border: 'none', color: '#60a5fa', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        Ampliar
                                                    </button>

                                                    <button
                                                        onClick={() => startConnectingThread(el.id)}
                                                        title="Unir con Hilo Rojo"
                                                        style={{ background: 'rgba(239, 68, 68, 0.25)', border: 'none', color: '#fca5a5', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        Hilo
                                                    </button>

                                                    <button
                                                        onClick={() => bringToFront(el.id)}
                                                        title="Traer Imagen al Frente"
                                                        style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#ffffff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ⬆️ Frente
                                                    </button>

                                                    <button
                                                        onClick={() => sendToBack(el.id)}
                                                        title="Enviar Imagen al Fondo"
                                                        style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#ffffff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ⬇️ Fondo
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteElement(el.id)}
                                                        title="Eliminar (Supr)"
                                                        style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#f87171', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // Standalone Text Element
                                if (el.type === 'text') {
                                    return (
                                        <div
                                            key={el.id}
                                            onMouseDown={e => handleMouseDownElement(e, el)}
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (isPencilActive || isEraserActive) return;
                                                if (connectingSourceId) {
                                                    handleConnectToElement(el.id);
                                                } else {
                                                    setSelectedElementId(el.id);
                                                }
                                            }}
                                            onDoubleClick={() => !isPencilActive && !isEraserActive && handleEditTextContent(el)}
                                            style={{
                                                position: 'absolute',
                                                left: `${el.x}px`,
                                                top: `${el.y}px`,
                                                width: el.width ? `${el.width}px` : 'auto',
                                                height: el.height ? `${el.height}px` : 'auto',
                                                zIndex: isSelected ? (el.zIndex || 2) + 100 : (el.zIndex || 2),
                                                cursor: el.isLocked ? 'pointer' : 'move',
                                                border: isSelected ? '2px dashed #eab308' : '1px transparent solid',
                                                borderRadius: '8px',
                                                padding: '0.4rem 0.6rem',
                                                userSelect: 'none',
                                                backdropFilter: isSelected ? 'blur(4px)' : 'none',
                                                background: isSelected ? 'rgba(15, 23, 42, 0.4)' : 'transparent',
                                                transition: 'border 0.2s ease, background 0.2s ease'
                                            }}
                                        >
                                            {/* Lock Badge */}
                                            {el.isLocked && (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleLockElement(el.id);
                                                    }}
                                                    title="Texto fijado. Clic para desfijar."
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-10px',
                                                        right: '-10px',
                                                        background: 'rgba(15, 23, 42, 0.9)',
                                                        border: '1.5px solid #eab308',
                                                        borderRadius: '6px',
                                                        padding: '2px 6px',
                                                        color: '#fef08a',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                                                        zIndex: (el.zIndex || 2) + 20
                                                    }}
                                                >
                                                    🔒 Fijado
                                                </div>
                                            )}

                                            <div style={{
                                                color: el.color || '#ffffff',
                                                fontSize: `${el.fontSize || 24}px`,
                                                fontWeight: el.fontWeight || 'bold',
                                                lineHeight: 1.2,
                                                whiteSpace: 'pre-wrap',
                                                textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)'
                                            }}>
                                                {el.content}
                                            </div>

                                            {/* 8 Drag Resizing Handles */}
                                            {isSelected && !isPencilActive && !isEraserActive && !el.isLocked && (
                                                <>
                                                    {[
                                                        { dir: 'nw', top: '-6px', left: '-6px', cursor: 'nwse-resize' },
                                                        { dir: 'n', top: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize' },
                                                        { dir: 'ne', top: '-6px', right: '-6px', cursor: 'nesw-resize' },
                                                        { dir: 'e', top: 'calc(50% - 6px)', right: '-6px', cursor: 'ew-resize' },
                                                        { dir: 'se', bottom: '-6px', right: '-6px', cursor: 'nwse-resize' },
                                                        { dir: 's', bottom: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize' },
                                                        { dir: 'sw', bottom: '-6px', left: '-6px', cursor: 'nesw-resize' },
                                                        { dir: 'w', top: 'calc(50% - 6px)', left: '-6px', cursor: 'ew-resize' }
                                                    ].map(h => (
                                                        <div
                                                            key={h.dir}
                                                            onMouseDown={e => handleMouseDownResize(e, el, h.dir)}
                                                            style={{
                                                                position: 'absolute',
                                                                top: h.top,
                                                                bottom: h.bottom,
                                                                left: h.left,
                                                                right: h.right,
                                                                width: '12px',
                                                                height: '12px',
                                                                backgroundColor: '#ffffff',
                                                                border: '2px solid #eab308',
                                                                borderRadius: '50%',
                                                                cursor: h.cursor,
                                                                boxShadow: '0 0 8px rgba(234, 179, 8, 0.9)',
                                                                zIndex: (el.zIndex || 2) + 50
                                                            }}
                                                        />
                                                    ))}
                                                </>
                                            )}

                                            {/* Floating Toolbar Controls for Text */}
                                            {isSelected && !isPencilActive && !isEraserActive && (
                                                <div 
                                                    onClick={e => e.stopPropagation()}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-42px',
                                                        left: '0',
                                                        background: 'rgba(15, 23, 42, 0.95)',
                                                        border: '1px solid #eab308',
                                                        borderRadius: '10px',
                                                        padding: '0.25rem 0.5rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
                                                        backdropFilter: 'blur(10px)',
                                                        zIndex: 9999
                                                    }}
                                                >
                                                    {/* Lock Button */}
                                                    <button
                                                        onClick={() => toggleLockElement(el.id)}
                                                        title={el.isLocked ? "Desfijar Posición" : "Fijar Posición en el Tablero"}
                                                        style={{
                                                            background: el.isLocked ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                            border: `1px solid ${el.isLocked ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                                            color: el.isLocked ? '#fef08a' : '#ffffff',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {el.isLocked ? '🔒 Fijado' : '🔓 Fijar'}
                                                    </button>

                                                    {/* Edit Text Content */}
                                                    <button
                                                        onClick={() => handleEditTextContent(el)}
                                                        title="Editar Texto"
                                                        style={{ background: 'rgba(234, 179, 8, 0.25)', border: 'none', color: '#fef08a', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ✏️ Editar
                                                    </button>

                                                    {/* Bold Toggle */}
                                                    <button
                                                        onClick={() => updateElement(el.id, { fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                                        title="Alternar Negrita"
                                                        style={{
                                                            background: el.fontWeight === 'bold' ? 'rgba(234, 179, 8, 0.35)' : 'rgba(255, 255, 255, 0.1)',
                                                            border: `1px solid ${el.fontWeight === 'bold' ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                                            color: '#ffffff',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '900'
                                                        }}
                                                    >
                                                        B
                                                    </button>

                                                    {/* Size - */}
                                                    <button
                                                        onClick={() => updateElement(el.id, { fontSize: Math.max(12, (el.fontSize || 24) - 3) })}
                                                        title="Reducir Tamaño de Texto"
                                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                    >
                                                        A-
                                                    </button>

                                                    {/* Size + */}
                                                    <button
                                                        onClick={() => updateElement(el.id, { fontSize: Math.min(72, (el.fontSize || 24) + 4) })}
                                                        title="Aumentar Tamaño de Texto"
                                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                    >
                                                        A+
                                                    </button>

                                                    {/* Color Selector Dots */}
                                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', margin: '0 2px' }}>
                                                        {['#ffffff', '#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'].map(c => (
                                                            <div
                                                                key={c}
                                                                onClick={() => updateElement(el.id, { color: c })}
                                                                title="Cambiar Color de Texto"
                                                                style={{
                                                                    width: '14px',
                                                                    height: '14px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: c,
                                                                    border: el.color === c ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                                                                    cursor: 'pointer',
                                                                    boxShadow: el.color === c ? `0 0 6px ${c}` : 'none'
                                                                }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Order */}
                                                    <button
                                                        onClick={() => bringToFront(el.id)}
                                                        title="Traer Texto al Frente"
                                                        style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#ffffff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ⬆️ Frente
                                                    </button>
                                                    <button
                                                        onClick={() => sendToBack(el.id)}
                                                        title="Enviar Texto al Fondo"
                                                        style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#ffffff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ⬇️ Fondo
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDeleteElement(el.id)}
                                                        title="Eliminar Texto (Supr)"
                                                        style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#f87171', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // Note Element
                                return (
                                    <div
                                        key={el.id}
                                        onMouseDown={e => handleMouseDownElement(e, el)}
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (isPencilActive || isEraserActive) return;
                                            if (connectingSourceId) {
                                                handleConnectToElement(el.id);
                                            } else {
                                                setSelectedElementId(el.id);
                                            }
                                        }}
                                        onDoubleClick={() => !isPencilActive && !isEraserActive && handleOpenEditNoteModal(el)}
                                        style={{
                                            position: 'absolute',
                                            left: `${el.x}px`,
                                            top: `${el.y}px`,
                                            width: `${el.width || 260}px`,
                                            height: el.height ? `${el.height}px` : 'auto',
                                            zIndex: el.zIndex || 2,
                                            cursor: isPencilActive ? 'crosshair' : isEraserActive ? 'cell' : el.isLocked ? 'default' : isDragging && isSelected ? 'grabbing' : 'grab',
                                            background: 'rgba(15, 23, 42, 0.92)',
                                            border: isConnectingSource 
                                                ? '2.5px solid #ef4444' 
                                                : isSelected 
                                                ? '2px solid #eab308' 
                                                : '1px solid rgba(234, 179, 8, 0.35)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            boxShadow: isSelected ? '0 0 20px rgba(234, 179, 8, 0.35)' : '0 6px 16px rgba(0,0,0,0.5)',
                                            color: '#ffffff',
                                            fontSize: '0.88rem',
                                            lineHeight: '1.4',
                                            backdropFilter: 'blur(10px)',
                                            overflow: 'auto'
                                        }}
                                    >
                                        {/* Lock Indicator Badge for Notes */}
                                        {el.isLocked && (
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleLockElement(el.id);
                                                }}
                                                title="Nota fijada. Clic para desfijar."
                                                style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    background: 'rgba(15, 23, 42, 0.9)',
                                                    border: '1.5px solid #eab308',
                                                    borderRadius: '6px',
                                                    padding: '2px 6px',
                                                    color: '#fef08a',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                                                    zIndex: (el.zIndex || 2) + 20,
                                                    backdropFilter: 'blur(8px)'
                                                }}
                                            >
                                                🔒 Fijada
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', paddingRight: el.isLocked ? '60px' : '0' }}>
                                            <span style={{ color: '#eab308', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {el.title || el.category || 'Nota Táctica'}
                                            </span>
                                        </div>
                                        <div style={{ whiteSpace: 'pre-wrap', color: '#e2e8f0', fontSize: '0.88rem', lineHeight: '1.45' }}>
                                            {el.content}
                                        </div>

                                        {/* 8 Corner & Edge Drag Resizing Handles (Only when NOT locked) */}
                                        {isSelected && !isPencilActive && !isEraserActive && !el.isLocked && (
                                            <>
                                                {[
                                                    { dir: 'nw', top: '-6px', left: '-6px', cursor: 'nwse-resize' },
                                                    { dir: 'n', top: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize' },
                                                    { dir: 'ne', top: '-6px', right: '-6px', cursor: 'nesw-resize' },
                                                    { dir: 'e', top: 'calc(50% - 6px)', right: '-6px', cursor: 'ew-resize' },
                                                    { dir: 'se', bottom: '-6px', right: '-6px', cursor: 'nwse-resize' },
                                                    { dir: 's', bottom: '-6px', left: 'calc(50% - 6px)', cursor: 'ns-resize' },
                                                    { dir: 'sw', bottom: '-6px', left: '-6px', cursor: 'nesw-resize' },
                                                    { dir: 'w', top: 'calc(50% - 6px)', left: '-6px', cursor: 'ew-resize' }
                                                ].map(h => (
                                                    <div
                                                        key={h.dir}
                                                        onMouseDown={e => handleMouseDownResize(e, el, h.dir)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: h.top,
                                                            bottom: h.bottom,
                                                            left: h.left,
                                                            right: h.right,
                                                            width: '12px',
                                                            height: '12px',
                                                            backgroundColor: '#ffffff',
                                                            border: '2px solid #eab308',
                                                            borderRadius: '50%',
                                                            cursor: h.cursor,
                                                            boxShadow: '0 0 8px rgba(234, 179, 8, 0.9)',
                                                            zIndex: (el.zIndex || 2) + 50
                                                        }}
                                                    />
                                                ))}
                                            </>
                                        )}

                                        {/* Quick On-Card Controls when selected */}
                                        {isSelected && !isPencilActive && !isEraserActive && (
                                            <div 
                                                onClick={e => e.stopPropagation()}
                                                onMouseDown={e => e.stopPropagation()}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-38px',
                                                    right: '0',
                                                    background: 'rgba(15, 23, 42, 0.95)',
                                                    border: '1px solid #eab308',
                                                    borderRadius: '10px',
                                                    padding: '0.25rem 0.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
                                                    backdropFilter: 'blur(10px)',
                                                    zIndex: 9999
                                                }}
                                            >
                                                <button
                                                    onClick={() => toggleLockElement(el.id)}
                                                    title={el.isLocked ? "Desfijar Posición" : "Fijar Posición en el Tablero"}
                                                    style={{
                                                        background: el.isLocked ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                        border: `1px solid ${el.isLocked ? '#eab308' : 'rgba(255, 255, 255, 0.2)'}`,
                                                        color: el.isLocked ? '#fef08a' : '#ffffff',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {el.isLocked ? '🔒 Fijada' : '🔓 Fijar'}
                                                </button>

                                                <button
                                                    onClick={() => handleOpenEditNoteModal(el)}
                                                    title="Editar Nota"
                                                    style={{ background: 'rgba(234, 179, 8, 0.25)', border: 'none', color: '#fef08a', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                >
                                                    Editar
                                                </button>

                                                <button
                                                    onClick={() => updateElement(el.id, { width: (el.width || 260) + 40 })}
                                                    title="Aumentar Ancho (Horizontal)"
                                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                >
                                                    Ancho +
                                                </button>

                                                <button
                                                    onClick={() => updateElement(el.id, { height: ((el.height || 130) + 40) })}
                                                    title="Aumentar Alto (Vertical)"
                                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                >
                                                    Alto +
                                                </button>

                                                <button
                                                    onClick={() => startConnectingThread(el.id)}
                                                    title="Unir con Hilo Rojo"
                                                    style={{ background: 'rgba(239, 68, 68, 0.25)', border: 'none', color: '#fca5a5', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                >
                                                    Hilo
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteElement(el.id)}
                                                    title="Eliminar (Supr)"
                                                    style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#f87171', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE OPERATION MODAL */}
            {isCreateModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '540px',
                        width: '90%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <h3 style={{ color: '#ffffff', margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: 700 }}>
                            {language === 'es' ? 'Registrar Nueva Operación Táctica SEB' : 'Register New SEB Tactical Operation'}
                        </h3>

                        <form onSubmit={handleCreateOperation} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Nombre Operación *
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Operación Tormenta Táctica"
                                    value={newOp.title}
                                    onChange={e => setNewOp({ ...newOp, title: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Zona de Despliegue *
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Almacén 4, Cypress Flats Industrial"
                                    value={newOp.location}
                                    onChange={e => setNewOp({ ...newOp, location: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Tipo de Intervención *
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Asalto Táctico, Bloqueo & Escolta, Rescate de Rehenes"
                                    value={newOp.type}
                                    onChange={e => setNewOp({ ...newOp, type: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Detalles
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Descripción general de la intervención y briefing táctico..."
                                    value={newOp.details}
                                    onChange={e => setNewOp({ ...newOp, details: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem', resize: 'vertical' }}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: '#0f172a', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Guardar Operación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT OPERATION MODAL */}
            {isEditModalOpen && editingOp && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: '540px',
                        width: '90%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <h3 style={{ color: '#ffffff', margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: 700 }}>
                            {language === 'es' ? 'Editar Operación Táctica SEB' : 'Edit SEB Tactical Operation'}
                        </h3>

                        <form onSubmit={handleSaveEditOperation} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Nombre Operación *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={editingOp.title}
                                    onChange={e => setEditingOp({ ...editingOp, title: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Zona de Despliegue *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={editingOp.location}
                                    onChange={e => setEditingOp({ ...editingOp, location: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Tipo de Intervención *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={editingOp.type}
                                    onChange={e => setEditingOp({ ...editingOp, type: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Estado de la Operación
                                </label>
                                <select
                                    value={editingOp.status}
                                    onChange={e => setEditingOp({ ...editingOp, status: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem' }}
                                >
                                    <option value="En Progreso">⚡ En Progreso (Activa)</option>
                                    <option value="Planificado">📌 Planificado (Activa)</option>
                                    <option value="Finalizado">📁 Finalizado (Archivada)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Detalles / Briefing
                                </label>
                                <textarea
                                    rows="3"
                                    value={editingOp.details}
                                    onChange={e => setEditingOp({ ...editingOp, details: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#fff', fontSize: '0.88rem', resize: 'vertical' }}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => { setIsEditModalOpen(false); setEditingOp(null); }}
                                    style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: '#0f172a', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EXPANDED IMAGE LIGHTBOX MODAL */}
            {expandedImage && (
                <div 
                    onClick={() => setExpandedImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: '2rem',
                        cursor: 'zoom-out',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <img 
                        src={expandedImage} 
                        alt="Tactical Plan Full view" 
                        style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
                    />
                </div>
            )}

            {/* CREATE / EDIT TACTICAL NOTE MODAL */}
            {isNoteModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.82)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '1rem',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid #eab308',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '520px',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 25px rgba(234, 179, 8, 0.2)',
                        color: '#ffffff'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fef08a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📝 {noteForm.id ? 'Editar Nota Táctica' : 'Añadir Nueva Nota Táctica'}
                            </h3>
                            <button
                                onClick={() => setIsNoteModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveNoteModal}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#eab308', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Título de la Nota
                                </label>
                                <input
                                    type="text"
                                    value={noteForm.title}
                                    onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                                    placeholder="Título de la nota (Opcional)..."
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        background: 'rgba(30, 41, 59, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.4rem' }}>
                                    Contenido / Detalles
                                </label>
                                <textarea
                                    rows={6}
                                    value={noteForm.content}
                                    onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                                    placeholder="Escribe aquí el contenido..."
                                    style={{
                                        width: '100%',
                                        background: 'rgba(30, 41, 59, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.9rem',
                                        lineHeight: 1.4,
                                        outline: 'none',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsNoteModalOpen(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: '#e2e8f0',
                                        padding: '0.55rem 1.1rem',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    style={{
                                        background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                                        border: 'none',
                                        color: '#0f172a',
                                        padding: '0.55rem 1.35rem',
                                        borderRadius: '10px',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 14px rgba(234, 179, 8, 0.4)'
                                    }}
                                >
                                    {noteForm.id ? 'Guardar Cambios' : 'Crear Nota'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SEB;

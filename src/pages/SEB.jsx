import { useState, useEffect, useRef } from 'react';
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
    
    // Create Operation Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newOp, setNewOp] = useState({
        title: '',
        location: '',
        type: 'Asalto Táctico & Rescate',
        details: ''
    });

    // Tactical Board Canvas State
    const [boardElements, setBoardElements] = useState([]);
    const [history, setHistory] = useState([]); // Undo History Stack for Ctrl+Z
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [connectingSourceId, setConnectingSourceId] = useState(null); // Thread connection source
    const [zoom, setZoom] = useState(1); // Zoom scale factor (1 = 100%)
    const [pan, setPan] = useState({ x: 0, y: 0 }); // Pan offset (x, y)
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    // Tactical Pencil & Eraser Freehand Drawing State
    const [isPencilActive, setIsPencilActive] = useState(false);
    const [isEraserActive, setIsEraserActive] = useState(false);
    const [pencilColor, setPencilColor] = useState('#ef4444'); // Default tactical red
    const [pencilWidth, setPencilWidth] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);

    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [savingBoard, setSavingBoard] = useState(false);
    
    // Image Preview Modal
    const [expandedImage, setExpandedImage] = useState(null);

    // Drag element state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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

    // Prevent page scroll when wheel zooming inside tactical board
    useEffect(() => {
        const boardEl = boardRef.current;
        if (!boardEl) return;

        const handleWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.deltaY < 0) {
                setZoom(z => Math.min(2.5, +(z + 0.05).toFixed(2)));
            } else {
                setZoom(z => Math.max(0.4, +(z - 0.05).toFixed(2)));
            }
        };

        boardEl.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            boardEl.removeEventListener('wheel', handleWheel);
        };
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

    // Keyboard shortcuts listener for Ctrl+Z (Undo) and Delete/Backspace
    useEffect(() => {
        const handleKeyDown = (e) => {
            const activeTag = document.activeElement?.tagName;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || document.activeElement?.isContentEditable) {
                return;
            }

            // Ctrl + Z or Cmd + Z (Undo)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            }

            // Delete or Backspace key deletes selected element
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
                e.preventDefault();
                handleDeleteElement(selectedElementId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, selectedElementId, boardElements]);

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

    const handleAddNoteToBoard = () => {
        const text = prompt(language === 'es' ? 'Texto de la nota táctica:' : 'Tactical note text:', 'Punto Táctico Clave');
        if (!text) return;

        const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
        const newNoteElement = {
            id: 'note-' + Date.now(),
            type: 'note',
            content: text,
            category: 'Nota Táctica',
            x: 120 - pan.x + (boardElements.length * 15),
            y: 120 - pan.y + (boardElements.length * 15),
            width: 260,
            height: 130,
            zIndex: maxZ + 1
        };

        pushHistory([...boardElements, newNoteElement]);
        setSelectedElementId(newNoteElement.id);
    };

    const handleEditNoteContent = (el) => {
        const updatedText = prompt(language === 'es' ? 'Editar texto de la nota:' : 'Edit note text:', el.content || '');
        if (updatedText === null) return;
        updateElement(el.id, { content: updatedText });
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

    // Canvas Mouse Down: Start Pencil Drawing OR Eraser OR Pan
    const handleMouseDownBoard = (e) => {
        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isPencilActive) {
            setIsDrawing(true);
            setCurrentPoints([{ x: canvasX, y: canvasY }]);
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
        e.stopPropagation();
        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isPencilActive) {
            setIsDrawing(true);
            setCurrentPoints([{ x: canvasX, y: canvasY }]);
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
        setIsDragging(true);
        setDragOffset({
            x: canvasX - el.x,
            y: canvasY - el.y
        });
    };

    // Canvas Mouse Move: Draw Freehand Stroke OR Pan Canvas OR Drag Element
    const handleMouseMoveBoard = (e) => {
        const { x: canvasX, y: canvasY } = getCanvasCoordinates(e);

        if (isPencilActive && isDrawing) {
            setCurrentPoints(prev => [...prev, { x: canvasX, y: canvasY }]);
            return;
        }

        if (isPanning) {
            setPan({
                x: e.clientX - panStartRef.current.x,
                y: e.clientY - panStartRef.current.y
            });
            return;
        }

        if (isDragging && selectedElementId) {
            let newX = canvasX - dragOffset.x;
            let newY = canvasY - dragOffset.y;
            updateElement(selectedElementId, { x: newX, y: newY });
        }
    };

    // Canvas Mouse Up: Save Freehand Stroke OR Finish Drag/Pan
    const handleMouseUpBoard = () => {
        if (isPencilActive && isDrawing) {
            setIsDrawing(false);
            if (currentPoints.length > 1) {
                const newDrawing = {
                    id: 'draw-' + Date.now(),
                    type: 'drawing',
                    points: currentPoints,
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

    const filteredOperations = operations.filter(op => 
        (op.title && op.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (op.location && op.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (op.type && op.type.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
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
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: '#ffffff',
                                padding: '0.65rem 1.3rem',
                                borderRadius: '12px',
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            {language === 'es' ? 'Registrar Nueva Operación' : 'Register New Operation'}
                        </button>
                    </div>

                    {/* Operations Cards */}
                    {filteredOperations.length === 0 ? (
                        <div style={{ padding: '3rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#94a3b8' }}>
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>{language === 'es' ? 'No se encontraron operaciones registradas.' : 'No registered operations found.'}</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '0.4rem', color: '#64748b' }}>Haz clic en "Registrar Nueva Operación" para añadir una.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
                            {filteredOperations.map(op => (
                                <div 
                                    key={op.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '16px',
                                        padding: '1.35rem',
                                        position: 'relative',
                                        backdropFilter: 'blur(10px)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#eab308', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                {op.type}
                                            </span>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                padding: '0.2rem 0.65rem',
                                                borderRadius: '12px',
                                                background: op.status === 'En Progreso' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                                                color: op.status === 'En Progreso' ? '#facc15' : '#4ade80',
                                                border: `1px solid ${op.status === 'En Progreso' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`
                                            }}>
                                                {op.status || 'En Progreso'}
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

                                    {/* Action Button: Open Interactive Tactical Board */}
                                    <button
                                        onClick={() => handleOpenBoard(op)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: '#ffffff',
                                            padding: '0.65rem',
                                            borderRadius: '10px',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s ease',
                                            marginTop: '0.5rem'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(234, 179, 8, 0.2)';
                                            e.currentTarget.style.borderColor = '#eab308';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                        }}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                        {language === 'es' ? 'Abrir Pizarra Táctica de Planificación' : 'Open Tactical Planning Board'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* SELECTED OPERATION: INTERACTIVE TACTICAL BOARD (PIZARRA TÁCTICA) */}
            {activeTab === 'ops' && selectedOp && (
                <div>
                    {/* Header Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button
                                onClick={() => { setSelectedOp(null); setConnectingSourceId(null); setIsPencilActive(false); setIsEraserActive(false); }}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.7)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                {language === 'es' ? 'Volver a Operaciones' : 'Back to Operations'}
                            </button>

                            <div>
                                <h2 style={{ fontSize: '1.35rem', color: '#ffffff', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
                                    {selectedOp.title} — Tablero de Planificación Táctica
                                </h2>
                                <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    <span>{selectedOp.location}</span> • <span style={{ color: '#eab308' }}>{selectedOp.type}</span>
                                </div>
                            </div>
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
                                onClick={handleAddNoteToBoard}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#eab308', fontSize: '0.85rem', fontWeight: 600 }}>
                                <span>Herramienta de Dibujo Libre (Lápiz Táctico)</span>
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
                                        Borrar Todos los Dibujos ({drawingsList.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Selected Element Controls Bar */}
                    {selectedElement && !isPencilActive && !isEraserActive && (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(234, 179, 8, 0.4)',
                            borderRadius: '12px',
                            padding: '0.65rem 1.25rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 6px 20px rgba(0,0,0,0.4)'
                        }}>
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
                                            onClick={() => handleEditNoteContent(selectedElement)}
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

                                    {selectedElement.type !== 'drawing' && selectedElement.type !== 'thread' && (
                                        <>
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

                    {/* INTERACTIVE CANVAS WHITEBOARD */}
                    <div 
                        ref={boardRef}
                        onMouseDown={handleMouseDownBoard}
                        onMouseMove={handleMouseMoveBoard}
                        onMouseUp={handleMouseUpBoard}
                        style={{
                            width: '100%',
                            height: '700px',
                            background: '#090d16',
                            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 0)',
                            backgroundSize: '24px 24px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '20px',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.4)',
                            userSelect: 'none',
                            cursor: isPencilActive ? 'crosshair' : isEraserActive ? 'cell' : isPanning ? 'grabbing' : 'grab'
                        }}
                    >
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

                            {/* SVG THREADS & DRAWINGS LAYER */}
                            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                                {/* Render Saved Connecting Threads */}
                                {threadsList.map(thread => {
                                    const source = boardElements.find(e => e.id === thread.sourceId);
                                    const target = boardElements.find(e => e.id === thread.targetId);
                                    if (!source || !target) return null;

                                    const x1 = source.x + (source.width || 260) / 2;
                                    const y1 = source.y + (source.height || 140) / 2;
                                    const x2 = target.x + (target.width || 260) / 2;
                                    const y2 = target.y + (target.height || 140) / 2;

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

                                {/* Render Saved Freehand Drawings */}
                                {drawingsList.map(draw => {
                                    const isSelectedDraw = draw.id === selectedElementId;
                                    return (
                                        <path
                                            key={draw.id}
                                            d={pointsToSvgPath(draw.points)}
                                            stroke={isSelectedDraw ? '#eab308' : (draw.color || '#ef4444')}
                                            strokeWidth={(draw.strokeWidth || 3) + (isSelectedDraw ? 3 : 0)}
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ 
                                                pointerEvents: 'auto', 
                                                cursor: isEraserActive ? 'cell' : 'pointer',
                                                filter: isSelectedDraw ? 'drop-shadow(0 0 6px #eab308)' : 'none'
                                            }}
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
                                        />
                                    );
                                })}

                                {/* Render Active Freehand Stroke being drawn */}
                                {isDrawing && isPencilActive && currentPoints.length > 1 && (
                                    <path
                                        d={pointsToSvgPath(currentPoints)}
                                        stroke={pencilColor}
                                        strokeWidth={pencilWidth}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
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
                                                cursor: isPencilActive ? 'crosshair' : isEraserActive ? 'cell' : isDragging && isSelected ? 'grabbing' : 'grab',
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
                                                    objectFit: 'contain',
                                                    borderRadius: '8px',
                                                    display: 'block',
                                                    pointerEvents: 'none'
                                                }}
                                            />

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
                                                        onClick={() => updateElement(el.id, { width: (el.width || 300) + 40 })}
                                                        title="Aumentar Ancho (Horizontal)"
                                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                    >
                                                        Ancho +
                                                    </button>
                                                    <button
                                                        onClick={() => updateElement(el.id, { width: Math.max(100, (el.width || 300) - 40) })}
                                                        title="Reducir Ancho (Horizontal)"
                                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                    >
                                                        Ancho -
                                                    </button>

                                                    <button
                                                        onClick={() => updateElement(el.id, { height: ((el.height || 200) + 40) })}
                                                        title="Aumentar Alto (Vertical)"
                                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                    >
                                                        Alto +
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
                                        onDoubleClick={() => !isPencilActive && !isEraserActive && handleEditNoteContent(el)}
                                        style={{
                                            position: 'absolute',
                                            left: `${el.x}px`,
                                            top: `${el.y}px`,
                                            width: `${el.width || 260}px`,
                                            height: el.height ? `${el.height}px` : 'auto',
                                            zIndex: el.zIndex || 2,
                                            cursor: isPencilActive ? 'crosshair' : isEraserActive ? 'cell' : isDragging && isSelected ? 'grabbing' : 'grab',
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                            <span style={{ color: '#eab308', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                {el.category || 'Nota Táctica'}
                                            </span>
                                        </div>
                                        <div style={{ whiteSpace: 'pre-wrap' }}>
                                            {el.content}
                                        </div>

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
                                                    onClick={() => handleEditNoteContent(el)}
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
        </div>
    );
}

export default SEB;

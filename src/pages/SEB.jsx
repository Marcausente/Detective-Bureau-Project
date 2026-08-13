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
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [savingBoard, setSavingBoard] = useState(false);
    
    // Drag state
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
                            operatives: 'SEB Agent Martinez, SEB Agent Vance, SEB Agent Kowalski',
                            status: 'En Progreso',
                            created_at: new Date().toISOString(),
                            board_data: [
                                {
                                    id: 'elem-1',
                                    type: 'note',
                                    content: 'Punto de Entrada Principal (Puerta Norte)',
                                    x: 80,
                                    y: 60,
                                    width: 260,
                                    height: 120,
                                    zIndex: 2
                                },
                                {
                                    id: 'elem-2',
                                    type: 'note',
                                    content: 'Tirador de Cobertura Alpha (Azotea Sur)',
                                    x: 380,
                                    y: 60,
                                    width: 260,
                                    height: 120,
                                    zIndex: 3
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

    const handleOpenBoard = (op) => {
        setSelectedOp(op);
        const elements = typeof op.board_data === 'string' ? JSON.parse(op.board_data) : (op.board_data || []);
        setBoardElements(elements);
        setSelectedElementId(null);
    };

    const handleSaveBoard = async () => {
        if (!selectedOp) return;
        setSavingBoard(true);

        try {
            const { error } = await supabase
                .from('seb_operations')
                .update({ board_data: boardElements, updated_at: new Date().toISOString() })
                .eq('id', selectedOp.id);

            if (error) {
                const updatedOps = operations.map(o => o.id === selectedOp.id ? { ...o, board_data: boardElements } : o);
                setOperations(updatedOps);
                localStorage.setItem('seb_operations', JSON.stringify(updatedOps));
            } else {
                setOperations(operations.map(o => o.id === selectedOp.id ? { ...o, board_data: boardElements } : o));
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
                x: 100 + (boardElements.length * 20),
                y: 100 + (boardElements.length * 20),
                width: 320,
                height: 240,
                zIndex: maxZ + 1,
                rotation: 0
            };

            setBoardElements([...boardElements, newImageElement]);
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
            x: 120 + (boardElements.length * 15),
            y: 120 + (boardElements.length * 15),
            width: 250,
            height: 120,
            zIndex: maxZ + 1
        };

        setBoardElements([...boardElements, newNoteElement]);
        setSelectedElementId(newNoteElement.id);
    };

    const updateElement = (id, newProps) => {
        setBoardElements(boardElements.map(el => el.id === id ? { ...el, ...newProps } : el));
    };

    const handleDeleteElement = (id) => {
        setBoardElements(boardElements.filter(el => el.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
    };

    const bringToFront = (id) => {
        const maxZ = boardElements.reduce((max, el) => Math.max(max, el.zIndex || 1), 1);
        updateElement(id, { zIndex: maxZ + 1 });
    };

    const sendToBack = (id) => {
        const minZ = boardElements.reduce((min, el) => Math.min(min, el.zIndex || 1), 1);
        updateElement(id, { zIndex: Math.max(1, minZ - 1) });
    };

    const handleMouseDownElement = (e, el) => {
        e.stopPropagation();
        setSelectedElementId(el.id);
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - el.x,
            y: e.clientY - el.y
        });
    };

    const handleMouseMoveBoard = (e) => {
        if (!isDragging || !selectedElementId || !boardRef.current) return;
        const boardRect = boardRef.current.getBoundingClientRect();
        
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;

        newX = Math.max(10, Math.min(newX, boardRect.width - 50));
        newY = Math.max(10, Math.min(newY, boardRect.height - 50));

        updateElement(selectedElementId, { x: newX, y: newY });
    };

    const handleMouseUpBoard = () => {
        setIsDragging(false);
    };

    const selectedElement = boardElements.find(el => el.id === selectedElementId);

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
                            {language === 'es' ? 'Tablón de operaciones, planificación táctica interactiva y cuadrilla SEB.' : 'Operations board, interactive tactical planning, and SEB roster.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Apple-Style Segmented Navigation Tabs */}
            <div style={{ 
                display: 'inline-flex', 
                gap: '0.4rem', 
                marginBottom: '1.75rem', 
                background: 'rgba(15, 23, 42, 0.6)', 
                padding: '0.35rem',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)'
            }}>
                <button
                    onClick={() => { setActiveTab('ops'); setSelectedOp(null); }}
                    style={{
                        background: activeTab === 'ops' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: 'none',
                        color: activeTab === 'ops' ? '#ffffff' : '#94a3b8',
                        padding: '0.55rem 1.4rem',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    {language === 'es' ? 'Tablón de Operaciones' : 'Operations Board'} ({operations.length})
                </button>

                <button
                    onClick={() => { setActiveTab('roster'); setSelectedOp(null); }}
                    style={{
                        background: activeTab === 'roster' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: 'none',
                        color: activeTab === 'roster' ? '#ffffff' : '#94a3b8',
                        padding: '0.55rem 1.4rem',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {language === 'es' ? 'Cuadrilla SEB' : 'SEB Squad Roster'} ({personnelList.length})
                </button>
            </div>

            {/* TAB 1: TABLÓN DE OPERACIONES */}
            {activeTab === 'ops' && !selectedOp && (
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
                                onClick={() => setSelectedOp(null)}
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
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleImageUploadToBoard}
                                style={{ display: 'none' }}
                            />

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
                                Añadir Nota Táctica
                            </button>

                            <button
                                onClick={handleSaveBoard}
                                disabled={savingBoard}
                                style={{
                                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                                    color: '#0f172a',
                                    border: 'none',
                                    padding: '0.55rem 1.2rem',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                    <polyline points="17 21 17 13 7 13 7 21"/>
                                    <polyline points="7 3 7 8 15 8"/>
                                </svg>
                                {savingBoard ? 'Guardando...' : 'Guardar Tablero'}
                            </button>
                        </div>
                    </div>

                    {/* Selected Element Controls Bar */}
                    {selectedElement && (
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
                                <span>Elemento Seleccionado ({selectedElement.type === 'image' ? 'Imagen' : 'Nota'})</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                                {/* Resize Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#cbd5e1', fontSize: '0.82rem' }}>
                                    <span>Tamaño:</span>
                                    <input
                                        type="range"
                                        min="120"
                                        max="800"
                                        value={selectedElement.width}
                                        onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })}
                                        style={{ accentColor: '#eab308', cursor: 'pointer' }}
                                    />
                                    <span>{selectedElement.width}px</span>
                                </div>

                                {/* Layering Controls */}
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                        onClick={() => bringToFront(selectedElement.id)}
                                        style={{
                                            background: 'rgba(234, 179, 8, 0.15)',
                                            border: '1px solid rgba(234, 179, 8, 0.3)',
                                            color: '#fef08a',
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem'
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="18 15 12 9 6 15"/>
                                        </svg>
                                        Traer al Frente
                                    </button>

                                    <button
                                        onClick={() => sendToBack(selectedElement.id)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: '#cbd5e1',
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem'
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="6 9 12 15 18 9"/>
                                        </svg>
                                        Enviar al Fondo
                                    </button>
                                </div>

                                {/* Delete Button */}
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
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem'
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* INTERACTIVE CANVAS WHITEBOARD */}
                    <div 
                        ref={boardRef}
                        onMouseMove={handleMouseMoveBoard}
                        onMouseUp={handleMouseUpBoard}
                        onClick={() => setSelectedElementId(null)}
                        style={{
                            width: '100%',
                            height: '680px',
                            background: '#090d16',
                            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 0)',
                            backgroundSize: '24px 24px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '20px',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.4)',
                            userSelect: 'none'
                        }}
                    >
                        {boardElements.length === 0 && (
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
                                <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>Usa las herramientas superiores para añadir imágenes o notas de planificación.</p>
                            </div>
                        )}

                        {/* Render Board Elements */}
                        {boardElements.map(el => {
                            const isSelected = el.id === selectedElementId;

                            if (el.type === 'image') {
                                return (
                                    <div
                                        key={el.id}
                                        onMouseDown={e => handleMouseDownElement(e, el)}
                                        onClick={e => {
                                            e.stopPropagation();
                                            setSelectedElementId(el.id);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: `${el.x}px`,
                                            top: `${el.y}px`,
                                            width: `${el.width || 300}px`,
                                            zIndex: el.zIndex || 1,
                                            cursor: isDragging && isSelected ? 'grabbing' : 'grab',
                                            border: isSelected ? '2px solid #eab308' : '1px solid rgba(255,255,255,0.15)',
                                            boxShadow: isSelected ? '0 0 25px rgba(234, 179, 8, 0.45)' : '0 6px 16px rgba(0,0,0,0.5)',
                                            borderRadius: '12px',
                                            background: '#0f172a',
                                            padding: '4px',
                                            backdropFilter: 'blur(10px)',
                                            transition: isDragging ? 'none' : 'border-color 0.2s ease, box-shadow 0.2s ease'
                                        }}
                                    >
                                        <img 
                                            src={getProfileImage(el.url, el.url)}
                                            alt="Tactical Element"
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                                borderRadius: '8px',
                                                display: 'block',
                                                pointerEvents: 'none'
                                            }}
                                        />

                                        {/* Quick On-Card Controls when selected */}
                                        {isSelected && (
                                            <div 
                                                onClick={e => e.stopPropagation()}
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
                                                    title="Aumentar Tamaño"
                                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => updateElement(el.id, { width: Math.max(120, (el.width || 300) - 40) })}
                                                    title="Disminuir Tamaño"
                                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                                >
                                                    -
                                                </button>
                                                <button
                                                    onClick={() => bringToFront(el.id)}
                                                    title="Traer al Frente"
                                                    style={{ background: 'rgba(234, 179, 8, 0.2)', border: 'none', color: '#fef08a', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                >
                                                    Frente
                                                </button>
                                                <button
                                                    onClick={() => sendToBack(el.id)}
                                                    title="Enviar al Fondo"
                                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                >
                                                    Fondo
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteElement(el.id)}
                                                    title="Eliminar"
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
                                        setSelectedElementId(el.id);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        left: `${el.x}px`,
                                        top: `${el.y}px`,
                                        width: `${el.width || 250}px`,
                                        zIndex: el.zIndex || 1,
                                        cursor: isDragging && isSelected ? 'grabbing' : 'grab',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: isSelected ? '2px solid #eab308' : '1px solid rgba(234, 179, 8, 0.3)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        boxShadow: isSelected ? '0 0 20px rgba(234, 179, 8, 0.35)' : '0 6px 16px rgba(0,0,0,0.5)',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        lineHeight: '1.4',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                >
                                    <div style={{ color: '#eab308', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Nota Táctica
                                    </div>
                                    {el.content}

                                    {/* Quick On-Card Controls when selected */}
                                    {isSelected && (
                                        <div 
                                            onClick={e => e.stopPropagation()}
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
                                                onClick={() => updateElement(el.id, { width: (el.width || 250) + 40 })}
                                                title="Aumentar Tamaño"
                                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={() => updateElement(el.id, { width: Math.max(120, (el.width || 250) - 40) })}
                                                title="Disminuir Tamaño"
                                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                -
                                            </button>
                                            <button
                                                onClick={() => bringToFront(el.id)}
                                                title="Traer al Frente"
                                                style={{ background: 'rgba(234, 179, 8, 0.2)', border: 'none', color: '#fef08a', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                            >
                                                Frente
                                            </button>
                                            <button
                                                onClick={() => sendToBack(el.id)}
                                                title="Enviar al Fondo"
                                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1', padding: '0.2rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                            >
                                                Fondo
                                            </button>
                                            <button
                                                onClick={() => handleDeleteElement(el.id)}
                                                title="Eliminar"
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
            )}

            {/* TAB 2: CUADRILLA SEB */}
            {activeTab === 'roster' && (
                <div>
                    <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '1.25rem', fontWeight: 700 }}>
                        {language === 'es' ? 'Personal Registrado en la Cuadrilla SEB' : 'Registered SEB Squad Personnel'}
                    </h3>

                    {personnelList.length === 0 ? (
                        <div style={{ padding: '3rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#94a3b8' }}>
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>{language === 'es' ? 'No se encontraron agentes registrados formalmente con el rango o división SEB aún.' : 'No agents currently registered with SEB rank or division yet.'}</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '0.4rem', color: '#64748b' }}>Puedes asignar la división "SEB" o el rango "SEB Agent" desde la sección de Personal.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                            {personnelList.map(member => (
                                <div 
                                    key={member.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '16px',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1.2rem',
                                        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                >
                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '50%',
                                        background: '#1e293b',
                                        border: '2px solid rgba(234, 179, 8, 0.5)',
                                        overflow: 'hidden',
                                        flexShrink: 0
                                    }}>
                                        <img 
                                            src={getProfileImage(member.profile_image, '/logowebp/anon.webp')} 
                                            alt={member.nombre}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>

                                    <div>
                                        <h4 style={{ margin: '0 0 0.2rem 0', color: '#ffffff', fontSize: '1rem', fontWeight: 700 }}>
                                            {member.nombre} {member.apellido}
                                        </h4>
                                        <div style={{ fontSize: '0.82rem', color: '#eab308', fontWeight: 600 }}>
                                            {member.rango || 'SEB Agent'} • Placa #{member.no_placa || 'N/A'}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                            Rol: {member.rol || 'Agente'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
        </div>
    );
}

export default SEB;

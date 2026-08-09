import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, getProfileImage } from '../utils/imageStorage';
import { usePresence } from '../contexts/PresenceContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

const getSubdivisionAbbrev = (sub) => {
    switch (sub) {
        case 'Gang Unit': return 'GU';
        case 'Undercover Division': return 'UD';
        case 'General Crimes': return 'GC';
        case 'Detective Training Program': return 'DTP';
        default: return sub;
    }
};

const getSubdivisionClass = (sub) => {
    switch (sub) {
        case 'Gang Unit': return 'gu';
        case 'Undercover Division': return 'ud';
        case 'General Crimes': return 'gc';
        case 'Detective Training Program': return 'dtp';
        default: return '';
    }
};

function Personnel() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Active Tab State ('directory' | 'rankings')
    const [activeTab, setActiveTab] = useState('directory');

    // Rankings State
    const [rankingsData, setRankingsData] = useState({
        closed_cases: [],
        doc_reports: [],
        incidents: [],
        outings: [],
        matrix: []
    });
    const [rankingsLoading, setRankingsLoading] = useState(false);

    // Auth State
    const [currentUserRole, setCurrentUserRole] = useState(null);

    // Global Presence
    const { onlineUsers } = usePresence();

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [editingUserId, setEditingUserId] = useState(null);

    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState(null);

    // Cropper State
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);
    const editorRef = useRef(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        nombre: '',
        apellido: '',
        no_placa: '',
        rango: 'Oficial II',
        rol: 'Ayudante',
        fecha_ingreso: '',
        profile_image: '',
        divisions: ['Detective Bureau']
    });

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Get Current User and Role
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('rol')
                    .eq('id', user.id)
                    .single();
                if (profile) setCurrentUserRole(profile.rol);
            }

            // 2. Fetch All Personnel
            const { data, error } = await supabase
                .from('users')
                .select('*');

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRankingsData = async () => {
        try {
            setRankingsLoading(true);
            const { data, error } = await supabase.rpc('get_personnel_rankings');
            if (!error && data) {
                setRankingsData({
                    closed_cases: data.closed_cases || [],
                    doc_reports: data.doc_reports || [],
                    incidents: data.incidents || [],
                    outings: data.outings || [],
                    matrix: data.matrix || []
                });
                return;
            }
        } catch (e) {
            console.warn("RPC get_personnel_rankings failed, computing fallback:", e);
        }

        try {
            const [usersRes, closedCasesRes, docRes, incRes, outRes, matrixRes] = await Promise.all([
                supabase.from('users').select('id, nombre, apellido, rango, no_placa, profile_image'),
                supabase.from('cases').select('id, created_by, case_assignments(user_id)').eq('status', 'Closed'),
                supabase.from('documentation_posts').select('author_id'),
                supabase.from('incidents').select('author_id'),
                supabase.from('outings').select('created_by'),
                supabase.from('gang_patrol_logs').select('created_by')
            ]);

            const allUsers = usersRes.data || [];
            const userMap = new Map(allUsers.map(u => [u.id, u]));

            const buildLeaderboard = (items, getUserId) => {
                const counts = {};
                (items || []).forEach(item => {
                    const uid = getUserId(item);
                    if (uid) counts[uid] = (counts[uid] || 0) + 1;
                });
                return Object.entries(counts)
                    .map(([uid, count]) => {
                        const u = userMap.get(uid);
                        if (!u) return null;
                        return { ...u, count };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
            };

            const closedCasesCounts = {};
            (closedCasesRes.data || []).forEach(c => {
                const uniqueUsers = new Set();
                if (c.created_by) uniqueUsers.add(c.created_by);
                if (c.case_assignments && Array.isArray(c.case_assignments)) {
                    c.case_assignments.forEach(ca => { if (ca.user_id) uniqueUsers.add(ca.user_id); });
                }
                uniqueUsers.forEach(uid => {
                    closedCasesCounts[uid] = (closedCasesCounts[uid] || 0) + 1;
                });
            });

            const closedCasesList = Object.entries(closedCasesCounts)
                .map(([uid, count]) => {
                    const u = userMap.get(uid);
                    if (!u) return null;
                    return { ...u, count };
                })
                .filter(Boolean)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            setRankingsData({
                closed_cases: closedCasesList,
                doc_reports: buildLeaderboard(docRes.data, i => i.author_id),
                incidents: buildLeaderboard(incRes.data, i => i.author_id),
                outings: buildLeaderboard(outRes.data, i => i.created_by),
                matrix: buildLeaderboard(matrixRes.data, i => i.created_by)
            });
        } catch (err) {
            console.error("Error computing rankings fallback:", err);
        } finally {
            setRankingsLoading(false);
        }
    };

    // Rank Priorities
    const rankPriority = {
        'Sheriff': 150,
        'Undersheriff': 140,
        'Assistant Sheriff': 130,
        'Division Chief': 120,
        'Comandante': 110,
        'Capitan': 100,
        'Teniente': 90,
        'Internal Affairs Agent': 85,
        'Department of Justice Agent': 85,
        'Agente Externo': 85,
        'Detective III': 80,
        'Detective II': 70,
        'Detective I': 60,
        'Oficial III+': 50,
        'Oficial III': 40,
        'Deputy Sheriff Bonus II': 35,
        'Oficial II': 30,
        'Deputy Sheriff Bonus I': 20,
        'Oficial I': 15,
        'Deputy Sheriff': 10
    };

    const getRankPriority = (rank) => rankPriority[rank] || 0;
    const sortUsers = (a, b) => getRankPriority(b.rango) - getRankPriority(a.rango);

    const detectives = users.filter(u => ['Detective I', 'Detective II', 'Detective III'].includes(u.rango)).sort(sortUsers);
    const helpers = users.filter(u => ['Deputy Sheriff', 'Oficial I', 'Deputy Sheriff Bonus I', 'Oficial II', 'Deputy Sheriff Bonus II', 'Oficial III', 'Oficial III+'].includes(u.rango)).sort(sortUsers);
    const commandAndExternal = users.filter(u => ['Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief', 'Comandante', 'Capitan', 'Teniente', 'Internal Affairs Agent', 'Department of Justice Agent', 'Agente Externo'].includes(u.rango)).sort(sortUsers);

    // --- Actions ---

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageSrc(file);
            setEditorOpen(true);
            e.target.value = '';
        }
    };

    const handleSaveCroppedImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Compressed to 0.6 for BBDD space
            setFormData({ ...formData, profile_image: dataUrl });
            setEditorOpen(false);
            setImageSrc(null);
            setScale(1.2);
        }
    };

    const handleCancelCrop = () => {
        setEditorOpen(false);
        setImageSrc(null);
        setScale(1.2);
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingUserId(null);
        setFormData({
            email: '', password: '', nombre: '', apellido: '', no_placa: '',
            rango: 'Oficial II', rol: 'Ayudante', fecha_ingreso: '', profile_image: '',
            divisions: ['Detective Bureau']
        });
        setMessage(null);
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setModalMode('edit');
        setEditingUserId(user.id);
        setFormData({
            email: user.email,
            password: '', // Don't prefill password
            nombre: user.nombre,
            apellido: user.apellido,
            no_placa: user.no_placa || '',
            rango: user.rango || 'Oficial II',
            rol: user.rol || 'Ayudante',
            fecha_ingreso: user.fecha_ingreso ? user.fecha_ingreso.split('T')[0] : '',
            profile_image: user.profile_image || '',
            divisions: user.divisions || ['Detective Bureau']
        });
        setMessage(null);
        setShowModal(true);
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;

        try {
            const { error } = await supabase.rpc('delete_personnel', { target_user_id: userId });
            if (error) throw error;

            // Optimistic UI update or Refetch
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) {
            alert('Error deleting user: ' + err.message);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        setMessage(null);

        try {
            let imageUrl = formData.profile_image;
            if (imageUrl && imageUrl.startsWith('data:')) {
                imageUrl = await uploadImageToStorage(imageUrl, 'avatars');
                setFormData(prev => ({ ...prev, profile_image: imageUrl }));
            }

            if (modalMode === 'create') {
                console.log("Creating User Payload:", {
                    email: formData.email,
                    password: formData.password,
                    nombre: formData.nombre,
                    apellido: formData.apellido,
                    rango: formData.rango,
                    rol: formData.rol
                });
                const { error } = await supabase.rpc('create_new_personnel', {
                    p_email: formData.email,
                    p_password: formData.password, // Required for create
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa,
                    p_rango: formData.rango,
                    p_rol: formData.rol,
                    p_fecha_ingreso: formData.fecha_ingreso || null,
                    p_fecha_ultimo_ascenso: null,
                    p_profile_image: imageUrl || null,
                    p_divisions: formData.divisions
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Personnel added successfully!' });
            } else {
                // Update
                const { error } = await supabase.rpc('update_personnel_admin', {
                    p_user_id: editingUserId,
                    p_email: formData.email,
                    p_password: formData.password || null, // Optional for update
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa,
                    p_rango: formData.rango,
                    p_rol: formData.rol,
                    p_fecha_ingreso: formData.fecha_ingreso || null,
                    p_fecha_ultimo_ascenso: null,
                    p_profile_image: imageUrl || null,
                    p_divisions: formData.divisions
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Personnel updated successfully!' });
            }

            setTimeout(() => {
                setShowModal(false);
                fetchData();
            }, 1000);

        } catch (err) {
            console.error('Error saving user:', err);
            setMessage({ type: 'error', text: err.message });
        } finally {
            setProcessing(false);
        }
    };

    const canManagePersonnel = ['Comisionado', 'Coordinador', 'Administrador'].includes(currentUserRole);

    const UserCard = ({ user }) => {
        const isOnline = onlineUsers.includes(user.id);

        return (
            <div className="personnel-card" onClick={() => navigate(`/personnel/${user.id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
                {/* Admin Controls */}
                {canManagePersonnel && (
                    <div className="personnel-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="card-action-btn edit-btn"
                            title="Edit"
                            onClick={() => openEditModal(user)}
                        >
                            ✏️
                        </button>
                        <button
                            className="card-action-btn delete-btn"
                            title="Delete"
                            onClick={() => handleDeleteUser(user.id)}
                        >
                            🗑️
                        </button>
                    </div>
                )}

                <div className="personnel-image-container">
                    {getProfileImage(user.profile_image) ? (
                        <img src={getProfileImage(user.profile_image)} alt={`${user.nombre} ${user.apellido} `} className="personnel-image" />
                    ) : (
                        <img src="/logowebp/anon.webp" alt="Anon" className="personnel-image" />
                    )}
                </div>
                <div className="personnel-info">
                    <div className="personnel-rank">{user.rango}</div>
                    <div className="personnel-name">{user.nombre} {user.apellido}</div>
                    <div className="personnel-badge">#{user.no_placa || '---'}</div>
                    {user.subdivisions && user.subdivisions.length > 0 && (
                        <div className="personnel-subdivisions" onClick={(e) => e.stopPropagation()}>
                            {user.subdivisions.map(sub => {
                                const isSpecialty = user.specialty_subdivision === sub;
                                return (
                                    <span 
                                        key={sub} 
                                        className={`subdivision-tag subdivision-${getSubdivisionClass(sub)} ${isSpecialty ? 'specialty' : ''}`} 
                                        title={isSpecialty ? `${sub} (Especialidad)` : sub}
                                    >
                                        {isSpecialty ? '⭐ ' : ''}{getSubdivisionAbbrev(sub)}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                {isOnline && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#4ade80',
                        borderRadius: '50%',
                        border: '2px solid rgba(15, 23, 42, 1)',
                        boxShadow: '0 0 8px #4ade80',
                        zIndex: 5
                    }} title="Online" />
                )}
            </div>
        );
    };

    if (loading && users.length === 0) return <div className="loading-container">Loading Personnel...</div>;

    return (
        <div className="personnel-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Bureau Personnel</h2>
                {canManagePersonnel && (
                    <button
                        className="login-button"
                        style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
                        onClick={openCreateModal}
                    >
                        + Add Personnel
                    </button>
                )}
            </div>

            {error && <div className="error-message">Error: {error}</div>}

            {/* Personnel Tabs Header */}
            <div className="personnel-tabs-bar">
                <button 
                    className={`personnel-tab-btn ${activeTab === 'directory' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('directory')}
                >
                    👥 {t('personnelDirectory') || 'Directorio de Personal'}
                </button>
                <button 
                    className={`personnel-tab-btn ${activeTab === 'rankings' ? 'active' : ''}`} 
                    onClick={() => {
                        setActiveTab('rankings');
                        fetchRankingsData();
                    }}
                >
                    {t('rankingsTab') || '🏆 Rankings y Líderes'}
                </button>
            </div>

            {activeTab === 'directory' ? (
                <div className="personnel-grid">
                    {/* Detectives Column */}
                    <div className="personnel-column">
                        <h3 className="column-title">Detectives</h3>
                        <div className="personnel-list">
                            {detectives.length > 0 ? detectives.map(u => <UserCard key={u.id} user={u} />) : <div className="empty-list">No detectives found</div>}
                        </div>
                    </div>

                    {/* Helpers Column */}
                    <div className="personnel-column">
                        <h3 className="column-title">{isLSSD ? "Ayudantes SCUB" : "Ayudantes DB"}</h3>
                        <div className="personnel-list">
                            {helpers.length > 0 ? helpers.map(u => <UserCard key={u.id} user={u} />) : <div className="empty-list">No oficiales found</div>}
                        </div>
                    </div>

                    {/* Command Column */}
                    <div className="personnel-column">
                        <h3 className="column-title">Comisionado y Externos</h3>
                        <div className="personnel-list">
                            {commandAndExternal.length > 0 ? commandAndExternal.map(u => <UserCard key={u.id} user={u} />) : <div className="empty-list">No command staff found</div>}
                        </div>
                    </div>
                </div>
            ) : (
                /* Rankings Tab Content */
                rankingsLoading ? (
                    <div className="loading-container" style={{ padding: '3rem 0' }}>
                        Cargando clasificaciones y rankings...
                    </div>
                ) : (
                    <div className="rankings-grid">
                        {/* 1. Closed Cases */}
                        <div className="ranking-card">
                            <div className="ranking-card-header">
                                <span className="ranking-card-icon">📁</span>
                                <h3 className="ranking-card-title">{t('rankClosedCasesTitle') || 'Casos en Closed'}</h3>
                            </div>
                            <div className="ranking-card-desc">{t('rankClosedCasesDesc') || 'Personas con más casos criminales cerrados y resueltos'}</div>
                            <div className="ranking-list">
                                {(!rankingsData.closed_cases || rankingsData.closed_cases.length === 0) ? (
                                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
                                        {t('noRankingsFound') || 'Sin registros aún en este ranking'}
                                    </div>
                                ) : (
                                    rankingsData.closed_cases.map((item, idx) => {
                                        const rankClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''));
                                        const badgeSymbol = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
                                        return (
                                            <div key={item.id} className="ranking-item" onClick={() => navigate(`/personnel/${item.id}`)}>
                                                <div className={`rank-badge ${rankClass}`}>{badgeSymbol}</div>
                                                {getProfileImage(item.profile_image) ? (
                                                    <img src={getProfileImage(item.profile_image)} alt={item.nombre} className="ranking-avatar" />
                                                ) : (
                                                    <img src="/logowebp/anon.webp" alt="Anon" className="ranking-avatar" />
                                                )}
                                                <div className="ranking-user-info">
                                                    <div className="ranking-user-name">{item.nombre} {item.apellido}</div>
                                                    <div className="ranking-user-rank">{item.rango} #{item.no_placa || '---'}</div>
                                                </div>
                                                <div className="ranking-count-pill">{item.count} {t('unitCases') || 'Casos'}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 2. Documentation Reports */}
                        <div className="ranking-card">
                            <div className="ranking-card-header">
                                <span className="ranking-card-icon">📝</span>
                                <h3 className="ranking-card-title">{t('rankDocReportsTitle') || 'Informes Subidos'}</h3>
                            </div>
                            <div className="ranking-card-desc">{t('rankDocReportsDesc') || 'Personas con más informes y documentos de oficina subidos'}</div>
                            <div className="ranking-list">
                                {(!rankingsData.doc_reports || rankingsData.doc_reports.length === 0) ? (
                                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
                                        {t('noRankingsFound') || 'Sin registros aún en este ranking'}
                                    </div>
                                ) : (
                                    rankingsData.doc_reports.map((item, idx) => {
                                        const rankClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''));
                                        const badgeSymbol = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
                                        return (
                                            <div key={item.id} className="ranking-item" onClick={() => navigate(`/personnel/${item.id}`)}>
                                                <div className={`rank-badge ${rankClass}`}>{badgeSymbol}</div>
                                                {getProfileImage(item.profile_image) ? (
                                                    <img src={getProfileImage(item.profile_image)} alt={item.nombre} className="ranking-avatar" />
                                                ) : (
                                                    <img src="/logowebp/anon.webp" alt="Anon" className="ranking-avatar" />
                                                )}
                                                <div className="ranking-user-info">
                                                    <div className="ranking-user-name">{item.nombre} {item.apellido}</div>
                                                    <div className="ranking-user-rank">{item.rango} #{item.no_placa || '---'}</div>
                                                </div>
                                                <div className="ranking-count-pill">{item.count} {t('unitReports') || 'Informes'}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 3. Incidents */}
                        <div className="ranking-card">
                            <div className="ranking-card-header">
                                <span className="ranking-card-icon">🚨</span>
                                <h3 className="ranking-card-title">{t('rankIncidentsTitle') || 'Incidentes Subidos'}</h3>
                            </div>
                            <div className="ranking-card-desc">{t('rankIncidentsDesc') || 'Personas con más partes de incidentes subidos'}</div>
                            <div className="ranking-list">
                                {(!rankingsData.incidents || rankingsData.incidents.length === 0) ? (
                                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
                                        {t('noRankingsFound') || 'Sin registros aún en este ranking'}
                                    </div>
                                ) : (
                                    rankingsData.incidents.map((item, idx) => {
                                        const rankClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''));
                                        const badgeSymbol = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
                                        return (
                                            <div key={item.id} className="ranking-item" onClick={() => navigate(`/personnel/${item.id}`)}>
                                                <div className={`rank-badge ${rankClass}`}>{badgeSymbol}</div>
                                                {getProfileImage(item.profile_image) ? (
                                                    <img src={getProfileImage(item.profile_image)} alt={item.nombre} className="ranking-avatar" />
                                                ) : (
                                                    <img src="/logowebp/anon.webp" alt="Anon" className="ranking-avatar" />
                                                )}
                                                <div className="ranking-user-info">
                                                    <div className="ranking-user-name">{item.nombre} {item.apellido}</div>
                                                    <div className="ranking-user-rank">{item.rango} #{item.no_placa || '---'}</div>
                                                </div>
                                                <div className="ranking-count-pill">{item.count} {t('unitIncidents') || 'Incidentes'}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 4. Outings (Vigilancias) */}
                        <div className="ranking-card">
                            <div className="ranking-card-header">
                                <span className="ranking-card-icon">🕵️‍♂️</span>
                                <h3 className="ranking-card-title">{t('rankOutingsTitle') || 'Vigilancias Subidas'}</h3>
                            </div>
                            <div className="ranking-card-desc">{t('rankOutingsDesc') || 'Personas con más salidas de vigilancia (Outings) registradas'}</div>
                            <div className="ranking-list">
                                {(!rankingsData.outings || rankingsData.outings.length === 0) ? (
                                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
                                        {t('noRankingsFound') || 'Sin registros aún en este ranking'}
                                    </div>
                                ) : (
                                    rankingsData.outings.map((item, idx) => {
                                        const rankClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''));
                                        const badgeSymbol = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
                                        return (
                                            <div key={item.id} className="ranking-item" onClick={() => navigate(`/personnel/${item.id}`)}>
                                                <div className={`rank-badge ${rankClass}`}>{badgeSymbol}</div>
                                                {getProfileImage(item.profile_image) ? (
                                                    <img src={getProfileImage(item.profile_image)} alt={item.nombre} className="ranking-avatar" />
                                                ) : (
                                                    <img src="/logowebp/anon.webp" alt="Anon" className="ranking-avatar" />
                                                )}
                                                <div className="ranking-user-info">
                                                    <div className="ranking-user-name">{item.nombre} {item.apellido}</div>
                                                    <div className="ranking-user-rank">{item.rango} #{item.no_placa || '---'}</div>
                                                </div>
                                                <div className="ranking-count-pill">{item.count} {t('unitOutings') || 'Vigilancias'}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 5. Matrix GU */}
                        <div className="ranking-card">
                            <div className="ranking-card-header">
                                <span className="ranking-card-icon">📊</span>
                                <h3 className="ranking-card-title">{t('rankMatricesTitle') || 'Matrices Subidas'}</h3>
                            </div>
                            <div className="ranking-card-desc">{t('rankMatricesDesc') || 'Personas con más matrices de control de tiempo subidas en Gang Unit'}</div>
                            <div className="ranking-list">
                                {(!rankingsData.matrix || rankingsData.matrix.length === 0) ? (
                                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
                                        {t('noRankingsFound') || 'Sin registros aún en este ranking'}
                                    </div>
                                ) : (
                                    rankingsData.matrix.map((item, idx) => {
                                        const rankClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''));
                                        const badgeSymbol = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
                                        return (
                                            <div key={item.id} className="ranking-item" onClick={() => navigate(`/personnel/${item.id}`)}>
                                                <div className={`rank-badge ${rankClass}`}>{badgeSymbol}</div>
                                                {getProfileImage(item.profile_image) ? (
                                                    <img src={getProfileImage(item.profile_image)} alt={item.nombre} className="ranking-avatar" />
                                                ) : (
                                                    <img src="/logowebp/anon.webp" alt="Anon" className="ranking-avatar" />
                                                )}
                                                <div className="ranking-user-info">
                                                    <div className="ranking-user-name">{item.nombre} {item.apellido}</div>
                                                    <div className="ranking-user-rank">{item.rango} #{item.no_placa || '---'}</div>
                                                </div>
                                                <div className="ranking-count-pill">{item.count} {t('unitMatrices') || 'Matrices'}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', textAlign: 'left' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>
                            {modalMode === 'create' ? 'Add New Personnel' : 'Edit Personnel'}
                        </h3>

                        {message && (
                            <div style={{
                                padding: '1rem', marginBottom: '1rem', borderRadius: '8px',
                                backgroundColor: message.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: message.type === 'success' ? '#4ade80' : '#ef4444',
                                border: `1px solid ${message.type === 'success' ? '#4ade80' : '#ef4444'} `
                            }}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input required type="email" name="email" className="form-input" value={formData.email} onChange={handleInputChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password {modalMode === 'edit' && '(Optional)'}</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required={modalMode === 'create'}
                                    placeholder={modalMode === 'edit' ? "Leave blank to keep current" : ""}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input required type="text" name="nombre" className="form-input" value={formData.nombre} onChange={handleInputChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input required type="text" name="apellido" className="form-input" value={formData.apellido} onChange={handleInputChange} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Badge Number</label>
                                <input required type="text" name="no_placa" className="form-input" value={formData.no_placa} onChange={handleInputChange} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Profile Image (Optional)</label>
                                <label className="custom-file-upload">
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} />
                                    {formData.profile_image ? "Image Selected (Click to change)" : "Choose Image"}
                                </label>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Rank</label>
                                <select name="rango" className="form-input custom-select" value={formData.rango} onChange={handleInputChange}>
                                    <option value="Deputy Sheriff">Deputy Sheriff</option>
                                    <option value="Oficial I">Oficial I</option>
                                    <option value="Deputy Sheriff Bonus I">Deputy Sheriff Bonus I</option>
                                    <option value="Oficial II">Oficial II</option>
                                    <option value="Deputy Sheriff Bonus II">Deputy Sheriff Bonus II</option>
                                    <option value="Oficial III">Oficial III</option>
                                    <option value="Detective I">Detective I</option>
                                    <option value="Detective II">Detective II</option>
                                    <option value="Detective III">Detective III</option>
                                    <option value="Internal Affairs Agent">Internal Affairs Agent</option>
                                    <option value="Department of Justice Agent">Department of Justice Agent</option>
                                    <option value="Agente Externo">Agente Externo</option>
                                    <option value="Teniente">Teniente</option>
                                    <option value="Capitan">Capitan</option>
                                    <option value="Comandante">Comandante</option>
                                    <option value="Division Chief">Division Chief</option>
                                    <option value="Assistant Sheriff">Assistant Sheriff</option>
                                    <option value="Undersheriff">Undersheriff</option>
                                    <option value="Sheriff">Sheriff</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select name="rol" className="form-input custom-select" value={formData.rol} onChange={handleInputChange}>
                                    <option value="Externo">Invitado</option>
                                    <option value="Ayudante">Ayudante</option>
                                    <option value="Detective">Detective</option>
                                    <option value="Coordinador">Coordinador</option>
                                    <option value="Comisionado">Comisionado</option>
                                    <option value="Administrador">Administrador</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Divisions</label>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.divisions.includes('Detective Bureau')}
                                            onChange={(e) => {
                                                const newDivisions = e.target.checked
                                                    ? [...formData.divisions, 'Detective Bureau']
                                                    : formData.divisions.filter(d => d !== 'Detective Bureau');
                                                setFormData({ ...formData, divisions: newDivisions });
                                            }}
                                        />
                                        Detective Bureau
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.divisions.includes('Internal Affairs')}
                                            onChange={(e) => {
                                                const newDivisions = e.target.checked
                                                    ? [...formData.divisions, 'Internal Affairs']
                                                    : formData.divisions.filter(d => d !== 'Internal Affairs');
                                                setFormData({ ...formData, divisions: newDivisions });
                                            }}
                                        />
                                        Internal Affairs
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.divisions.includes('DOJ')}
                                            onChange={(e) => {
                                                const newDivisions = e.target.checked
                                                    ? [...formData.divisions, 'DOJ']
                                                    : formData.divisions.filter(d => d !== 'DOJ');
                                                setFormData({ ...formData, divisions: newDivisions });
                                            }}
                                        />
                                        Department of Justice
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.divisions.includes('DTP')}
                                            onChange={(e) => {
                                                const newDivisions = e.target.checked
                                                    ? [...formData.divisions, 'DTP']
                                                    : formData.divisions.filter(d => d !== 'DTP');
                                                setFormData({ ...formData, divisions: newDivisions });
                                            }}
                                        />
                                        DTP
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.divisions.includes('Gang Unit')}
                                            onChange={(e) => {
                                                const newDivisions = e.target.checked
                                                    ? [...formData.divisions, 'Gang Unit']
                                                    : formData.divisions.filter(d => d !== 'Gang Unit');
                                                setFormData({ ...formData, divisions: newDivisions });
                                            }}
                                        />
                                        Gang Unit
                                    </label>
                                </div>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Bureau Entry Date</label>
                                <input required type="date" name="fecha_ingreso" className="form-input" value={formData.fecha_ingreso} onChange={handleInputChange} />
                            </div>

                            <div className="cropper-actions" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)} disabled={processing}>Cancel</button>
                                <button type="submit" className="login-button" disabled={processing}>
                                    {processing ? 'Saving...' : (modalMode === 'create' ? 'Create Personnel' : 'Update Personnel')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cropper Modal */}
            {editorOpen && createPortal(
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content">
                        <h3>Adjust Profile Picture</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor
                                ref={editorRef}
                                image={imageSrc}
                                width={250}
                                height={250}
                                border={20}
                                borderRadius={125}
                                color={[0, 0, 0, 0.6]}
                                scale={scale}
                            />
                        </div>
                        <div className="cropper-controls">
                            <div className="zoom-slider-container">
                                <span>-</span>
                                <input
                                    type="range" min="1" max="3" step="0.01" value={scale}
                                    className="zoom-slider"
                                    onChange={(e) => setScale(parseFloat(e.target.value))}
                                />
                                <span>+</span>
                            </div>
                            <div className="cropper-actions">
                                <button type="button" className="login-button btn-secondary" onClick={handleCancelCrop}>Cancel</button>
                                <button type="button" className="login-button" onClick={handleSaveCroppedImage}>Save Image</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default Personnel;

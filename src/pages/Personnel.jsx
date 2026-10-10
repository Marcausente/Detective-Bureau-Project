import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, getProfileImage } from '../utils/imageStorage';
import { getInternalRanks, getUserInternalRank, setUserInternalRank } from '../utils/internalRanks';
import { getSubdivisions, getSubdivisionAbbrev } from '../utils/subdivisions';
import { getLicenses, getLicenseDetails, getUserLicenses, updateUserLicenses } from '../utils/licenses';
import { usePresence } from '../contexts/PresenceContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Personnel() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [availableInternalRanks, setAvailableInternalRanks] = useState([]);
    const [availableSubdivisions, setAvailableSubdivisions] = useState([]);
    const [availableLicenses, setAvailableLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Active Tab State ('directory' | 'rankings')
    const [activeTab, setActiveTab] = useState('directory');

    // Rankings State & Filters
    const [rawRankingsActivity, setRawRankingsActivity] = useState(null);
    const [rankingsTimeframe, setRankingsTimeframe] = useState('monthly'); // 'monthly' | 'all'
    const [rankingsMonth, setRankingsMonth] = useState(new Date().getMonth());
    const [rankingsYear, setRankingsYear] = useState(new Date().getFullYear());
    const [rankingSortMode, setRankingSortMode] = useState('desc'); // 'desc' (Mayor actividad) | 'asc' (Menor actividad)
    const [rankingsViewStyle, setRankingsViewStyle] = useState('cards'); // 'cards' | 'table'
    const [rankingsTableSearch, setRankingsTableSearch] = useState('');
    const [rankingsTableSortCol, setRankingsTableSortCol] = useState('total');
    const [rankingsTableSortAsc, setRankingsTableSortAsc] = useState(false);
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
        rango_interno: 'Auxiliar de Investigación',
        fecha_ingreso: '',
        profile_image: '',
        divisions: ['Detective Bureau'],
        licenses: []
    });

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
        loadInternalRanksList();
    }, []);

    const loadInternalRanksList = async () => {
        try {
            const ranks = await getInternalRanks();
            setAvailableInternalRanks(ranks || []);
            const subs = await getSubdivisions();
            setAvailableSubdivisions(subs || []);
            const lics = await getLicenses();
            setAvailableLicenses(lics || []);
        } catch (e) {
            console.warn('Error loading ranks, subdivisions or licenses:', e);
        }
    };

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
            const mappedUsers = (data || []).map(u => ({
                ...u,
                rango_interno: getUserInternalRank(u),
                licenses: getUserLicenses(u)
            }));
            setUsers(mappedUsers);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const MONTH_NAMES_ES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const handlePrevMonth = () => {
        if (rankingsMonth === 0) {
            setRankingsMonth(11);
            setRankingsYear(prev => prev - 1);
        } else {
            setRankingsMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (rankingsMonth === 11) {
            setRankingsMonth(0);
            setRankingsYear(prev => prev + 1);
        } else {
            setRankingsMonth(prev => prev + 1);
        }
    };

    const fetchRankingsData = async (force = false) => {
        if (!force && rawRankingsActivity) {
            return;
        }

        try {
            setRankingsLoading(true);
            const [usersRes, closedCasesRes, incRes, outRes, interrogationsRes, matrixRes] = await Promise.all([
                supabase.from('users').select('id, nombre, apellido, rango, no_placa, profile_image, rol'),
                supabase.from('cases').select('id, created_by, created_at, updated_at, case_assignments(user_id)').eq('status', 'Closed'),
                supabase.from('incidents').select('id, author_id, occurred_at, created_at'),
                supabase.from('outings').select('id, created_by, occurred_at, created_at'),
                supabase.from('interrogations').select('id, author_id, agents_present, interrogation_date, created_at'),
                supabase.from('gang_patrol_logs').select('id, created_by, patrol_time, created_at')
            ]);

            setRawRankingsActivity({
                users: usersRes.data || [],
                closedCases: closedCasesRes.data || [],
                incidents: incRes.data || [],
                outings: outRes.data || [],
                interrogations: interrogationsRes.data || [],
                matrices: matrixRes.data || []
            });
        } catch (err) {
            console.error("Error fetching rankings activity:", err);
        } finally {
            setRankingsLoading(false);
        }
    };

    const processedRankings = useMemo(() => {
        if (!rawRankingsActivity) {
            return {
                closed_cases: [],
                incidents: [],
                outings: [],
                interrogations: [],
                matrix: [],
                agentMatrix: []
            };
        }

        const { users, closedCases, incidents, outings, interrogations, matrices } = rawRankingsActivity;

        const isWithinTimeframe = (dateString) => {
            if (rankingsTimeframe === 'all') return true;
            if (!dateString) return false;
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return false;
            return d.getFullYear() === rankingsYear && d.getMonth() === rankingsMonth;
        };

        const filteredCases = (closedCases || []).filter(c => isWithinTimeframe(c.updated_at || c.created_at));
        const filteredIncidents = (incidents || []).filter(i => isWithinTimeframe(i.occurred_at || i.created_at));
        const filteredOutings = (outings || []).filter(o => isWithinTimeframe(o.occurred_at || o.created_at));
        const filteredInterrogations = (interrogations || []).filter(i => isWithinTimeframe(i.interrogation_date || i.created_at));
        const filteredMatrices = (matrices || []).filter(m => isWithinTimeframe(m.patrol_time || m.created_at));

        const caseCounts = {};
        filteredCases.forEach(c => {
            const uniqueUsers = new Set();
            if (c.created_by) uniqueUsers.add(c.created_by);
            if (c.case_assignments && Array.isArray(c.case_assignments)) {
                c.case_assignments.forEach(ca => { if (ca.user_id) uniqueUsers.add(ca.user_id); });
            }
            uniqueUsers.forEach(uid => { caseCounts[uid] = (caseCounts[uid] || 0) + 1; });
        });

        const incidentCounts = {};
        filteredIncidents.forEach(i => {
            if (i.author_id) incidentCounts[i.author_id] = (incidentCounts[i.author_id] || 0) + 1;
        });

        const outingCounts = {};
        filteredOutings.forEach(o => {
            if (o.created_by) outingCounts[o.created_by] = (outingCounts[o.created_by] || 0) + 1;
        });

        const matrixCounts = {};
        filteredMatrices.forEach(m => {
            if (m.created_by) matrixCounts[m.created_by] = (matrixCounts[m.created_by] || 0) + 1;
        });

        const interrogationCounts = {};
        (users || []).forEach(u => {
            const cnt = filteredInterrogations.filter(i => {
                if (i.author_id === u.id) return true;
                if (i.agents_present && u.apellido && i.agents_present.toLowerCase().includes(u.apellido.toLowerCase())) return true;
                if (i.agents_present && u.nombre && i.agents_present.toLowerCase().includes(u.nombre.toLowerCase())) return true;
                return false;
            }).length;
            if (cnt > 0) interrogationCounts[u.id] = cnt;
        });

        const buildCategoryList = (countMap) => {
            const list = (users || []).map(u => ({
                ...u,
                count: countMap[u.id] || 0
            }));

            if (rankingSortMode === 'desc') {
                return list
                    .sort((a, b) => b.count - a.count || (a.nombre || '').localeCompare(b.nombre || ''))
                    .slice(0, 10);
            } else {
                return list
                    .sort((a, b) => a.count - b.count || (a.nombre || '').localeCompare(b.nombre || ''))
                    .slice(0, 10);
            }
        };

        const agentMatrix = (users || []).map(u => {
            const cCount = caseCounts[u.id] || 0;
            const incCount = incidentCounts[u.id] || 0;
            const outCount = outingCounts[u.id] || 0;
            const matCount = matrixCounts[u.id] || 0;
            const intCount = interrogationCounts[u.id] || 0;
            const total = cCount + incCount + outCount + matCount + intCount;

            return {
                ...u,
                closed_cases: cCount,
                incidents: incCount,
                outings: outCount,
                matrix: matCount,
                interrogations: intCount,
                total
            };
        });

        return {
            closed_cases: buildCategoryList(caseCounts),
            incidents: buildCategoryList(incidentCounts),
            outings: buildCategoryList(outingCounts),
            interrogations: buildCategoryList(interrogationCounts),
            matrix: buildCategoryList(matrixCounts),
            agentMatrix
        };
    }, [rawRankingsActivity, rankingsTimeframe, rankingsMonth, rankingsYear, rankingSortMode]);

    const filteredAndSortedAgentMatrix = useMemo(() => {
        let list = [...(processedRankings.agentMatrix || [])];

        if (rankingsTableSearch.trim()) {
            const q = rankingsTableSearch.toLowerCase().trim();
            list = list.filter(u =>
                (u.nombre && u.nombre.toLowerCase().includes(q)) ||
                (u.apellido && u.apellido.toLowerCase().includes(q)) ||
                (u.no_placa && u.no_placa.toLowerCase().includes(q)) ||
                (u.rango && u.rango.toLowerCase().includes(q))
            );
        }

        list.sort((a, b) => {
            let valA = a[rankingsTableSortCol];
            let valB = b[rankingsTableSortCol];

            if (typeof valA === 'string') {
                return rankingsTableSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            valA = Number(valA || 0);
            valB = Number(valB || 0);
            return rankingsTableSortAsc ? valA - valB : valB - valA;
        });

        return list;
    }, [processedRankings.agentMatrix, rankingsTableSearch, rankingsTableSortCol, rankingsTableSortAsc]);

    // Rank Priorities
    const rankPriority = {
        'Sheriff': 150,
        'Undersheriff': 140,
        'Assistant Sheriff': 130,
        'Division Chief': 120,
        'Comandante': 110,
        'Capitan': 100,
        'Teniente': 90,
        'Internal Affairs Agent': 87,
        'SEB Agent': 86,
        'ASD Agent': 86,
        'Department of Justice Agent': 85,
        'Agente Externo': 84,
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

    // Search Filtering
    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;
        const term = searchTerm.toLowerCase();
        return users.filter(u =>
            (u.nombre && u.nombre.toLowerCase().includes(term)) ||
            (u.apellido && u.apellido.toLowerCase().includes(term)) ||
            (u.rango && u.rango.toLowerCase().includes(term)) ||
            (u.no_placa && u.no_placa.toLowerCase().includes(term)) ||
            (u.licenses && u.licenses.some(l => l.toLowerCase().includes(term))) ||
            (availableLicenses.some(al => u.licenses?.includes(al.name) && (al.code?.toLowerCase().includes(term) || al.name.toLowerCase().includes(term))))
        );
    }, [users, searchTerm, availableLicenses]);

    const detectives = useMemo(() => filteredUsers.filter(u => ['Detective I', 'Detective II', 'Detective III'].includes(u.rango)).sort(sortUsers), [filteredUsers]);
    const helpers = useMemo(() => filteredUsers.filter(u => ['Deputy Sheriff', 'Oficial I', 'Deputy Sheriff Bonus I', 'Oficial II', 'Deputy Sheriff Bonus II', 'Oficial III', 'Oficial III+'].includes(u.rango)).sort(sortUsers), [filteredUsers]);
    const commandAndExternal = useMemo(() => filteredUsers.filter(u => ['Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief', 'Comandante', 'Capitan', 'Teniente', 'Internal Affairs Agent', 'SEB Agent', 'ASD Agent', 'Department of Justice Agent', 'Agente Externo'].includes(u.rango)).sort(sortUsers), [filteredUsers]);

    // Actions
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
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
            rango: 'Oficial II', rol: 'Ayudante', rango_interno: 'Auxiliar de Investigación', fecha_ingreso: '', profile_image: '',
            divisions: ['Detective Bureau'],
            licenses: []
        });
        setMessage(null);
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setModalMode('edit');
        setEditingUserId(user.id);
        const currentRank = getUserInternalRank(user);
        setFormData({
            email: user.email,
            password: '',
            nombre: user.nombre,
            apellido: user.apellido,
            no_placa: user.no_placa || '',
            rango: user.rango || 'Oficial II',
            rol: user.rol || 'Ayudante',
            rango_interno: currentRank,
            fecha_ingreso: user.fecha_ingreso ? user.fecha_ingreso.split('T')[0] : '',
            profile_image: user.profile_image || '',
            divisions: user.divisions || ['Detective Bureau'],
            licenses: getUserLicenses(user) || []
        });
        setMessage(null);
        setShowModal(true);
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar este agente? Esta acción no se puede deshacer.")) return;

        try {
            const { error } = await supabase.rpc('delete_personnel', { target_user_id: userId });
            if (error) throw error;

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

            const selectedRank = formData.rango_interno || 'Auxiliar de Investigación';
            const selectedLicenses = formData.licenses || [];

            if (modalMode === 'create') {
                const { error } = await supabase.rpc('create_new_personnel', {
                    p_email: formData.email,
                    p_password: formData.password,
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa,
                    p_rango: formData.rango,
                    p_rol: formData.rol,
                    p_fecha_ingreso: formData.fecha_ingreso || null,
                    p_fecha_ultimo_ascenso: null,
                    p_profile_image: imageUrl || null,
                    p_divisions: formData.divisions,
                    p_rango_interno: selectedRank,
                    p_licenses: selectedLicenses
                });
                if (error) {
                    const { error: fallbackErr } = await supabase.rpc('create_new_personnel', {
                        p_email: formData.email,
                        p_password: formData.password,
                        p_nombre: formData.nombre,
                        p_apellido: formData.apellido,
                        p_no_placa: formData.no_placa,
                        p_rango: formData.rango,
                        p_rol: formData.rol,
                        p_fecha_ingreso: formData.fecha_ingreso || null,
                        p_fecha_ultimo_ascenso: null,
                        p_profile_image: imageUrl || null,
                        p_divisions: formData.divisions,
                        p_rango_interno: selectedRank
                    });
                    if (fallbackErr) throw fallbackErr;
                }

                // Sync rango_interno & licenses
                const { data: newUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', formData.email)
                    .single();
                if (newUser) {
                    await setUserInternalRank(newUser.id, selectedRank);
                    await updateUserLicenses(newUser.id, selectedLicenses);
                }

                setMessage({ type: 'success', text: '¡Personal añadido correctamente!' });
            } else {
                const { error } = await supabase.rpc('update_personnel_admin', {
                    p_user_id: editingUserId,
                    p_email: formData.email,
                    p_password: formData.password || null,
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa,
                    p_rango: formData.rango,
                    p_rol: formData.rol,
                    p_fecha_ingreso: formData.fecha_ingreso || null,
                    p_fecha_ultimo_ascenso: null,
                    p_profile_image: imageUrl || null,
                    p_divisions: formData.divisions,
                    p_rango_interno: selectedRank,
                    p_licenses: selectedLicenses
                });
                if (error) {
                    const { error: fallbackErr } = await supabase.rpc('update_personnel_admin', {
                        p_user_id: editingUserId,
                        p_email: formData.email,
                        p_password: formData.password || null,
                        p_nombre: formData.nombre,
                        p_apellido: formData.apellido,
                        p_no_placa: formData.no_placa,
                        p_rango: formData.rango,
                        p_rol: formData.rol,
                        p_fecha_ingreso: formData.fecha_ingreso || null,
                        p_fecha_ultimo_ascenso: null,
                        p_profile_image: imageUrl || null,
                        p_divisions: formData.divisions,
                        p_rango_interno: selectedRank
                    });
                    if (fallbackErr) throw fallbackErr;
                }

                // Sync rango_interno & licenses via helpers
                await setUserInternalRank(editingUserId, selectedRank);
                await updateUserLicenses(editingUserId, selectedLicenses);

                // Update local state immediately
                setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, rango_interno: selectedRank, licenses: selectedLicenses } : u));

                setMessage({ type: 'success', text: '¡Personal actualizado correctamente!' });
            }

            setTimeout(() => {
                setShowModal(false);
                fetchData();
            }, 800);

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
        const internalRank = getUserInternalRank(user);
        const userLicenses = getUserLicenses(user);

        return (
            <div
                className="personnel-card"
                onClick={() => navigate(`/personnel/${user.id}`)}
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    backdropFilter: 'blur(16px)',
                    borderRadius: '14px',
                    padding: '1rem 1.1rem',
                    gap: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >
                {/* Admin Quick Actions */}
                {canManagePersonnel && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px', zIndex: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#fbbf24',
                                borderRadius: '6px',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title="Editar Agente"
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id)}
                            style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                borderRadius: '6px',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title="Eliminar Agente"
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Avatar Image & Online LED */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                        src={getProfileImage(user.profile_image, '/logowebp/anon.webp')}
                        alt={`${user.nombre} ${user.apellido}`}
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid rgba(255, 255, 255, 0.16)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
                        }}
                    />
                    {isOnline && (
                        <span
                            style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                width: '11px',
                                height: '11px',
                                backgroundColor: '#22c55e',
                                borderRadius: '50%',
                                border: '2px solid #0f172a',
                                boxShadow: '0 0 8px #22c55e'
                            }}
                            title="En línea"
                        />
                    )}
                </div>

                {/* Agent Information */}
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {user.rango}
                    </div>
                    <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.nombre} {user.apellido}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '-1px' }}>
                        <span style={{ color: '#fbbf24', fontSize: '0.65rem' }}>❖</span>
                        <span>{internalRank}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', padding: '1px 6px', borderRadius: '5px' }}>
                            #{user.no_placa || '---'}
                        </span>
                        {user.subdivisions && user.subdivisions.length > 0 && (
                            user.subdivisions.map(sub => {
                                const isSpecialty = user.specialty_subdivision === sub;
                                return (
                                    <span
                                        key={sub}
                                        style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            padding: '2px 7px',
                                            borderRadius: '10px',
                                            background: isSpecialty ? 'rgba(251, 191, 36, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                                            color: isSpecialty ? '#fde047' : '#93c5fd',
                                            border: isSpecialty ? '1px solid rgba(251, 191, 36, 0.4)' : '1px solid rgba(59, 130, 246, 0.3)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                        title={isSpecialty ? `${sub} (Especialidad)` : sub}
                                    >
                                        {isSpecialty && '★ '}{getSubdivisionAbbrev(sub, availableSubdivisions)}
                                    </span>
                                );
                            })
                        )}
                    </div>

                    {/* Agent Licenses Badges */}
                    {userLicenses && userLicenses.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                            {userLicenses.map(licName => {
                                const lic = getLicenseDetails(licName, availableLicenses);
                                const licColor = lic?.color || '#10b981';
                                return (
                                    <span
                                        key={licName}
                                        style={{
                                            fontSize: '0.66rem',
                                            fontWeight: 700,
                                            padding: '1px 6px',
                                            borderRadius: '6px',
                                            background: `${licColor}22`,
                                            color: licColor,
                                            border: `1px solid ${licColor}55`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                        title={lic?.description ? `${lic.name}: ${lic.description}` : lic?.name || licName}
                                    >
                                        <span>{lic?.icon || '🪪'}</span>
                                        <span>{lic?.code || licName}</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="personnel-container" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '1.5rem', boxSizing: 'border-box' }}>
            {/* Header Title Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 12px #22c55e',
                        display: 'inline-block'
                    }}></span>
                    <div>
                        <h2 className="page-title" style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                            {t('personnelDirectory') || 'Directorio de Personal'}
                        </h2>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                            Agentes: <strong style={{ color: '#f8fafc' }}>{users.length}</strong> • Detectives: <strong style={{ color: '#fbbf24' }}>{detectives.length}</strong> • {isLSSD ? "Ayudantes SCUB" : "Ayudantes DB"}: <strong style={{ color: '#60a5fa' }}>{helpers.length}</strong> • Mandos: <strong style={{ color: '#f87171' }}>{commandAndExternal.length}</strong>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    {/* Search Input Pill */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.07)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        borderRadius: '10px',
                        padding: '0.45rem 0.95rem',
                        gap: '8px',
                        minWidth: '240px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar agente, rango, placa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#ffffff',
                                fontSize: '0.85rem',
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

                    {/* Admin Create Personnel Button (Apple macOS Style) */}
                    {canManagePersonnel && (
                        <button
                            type="button"
                            className="personnel-add-btn"
                            onClick={openCreateModal}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Añadir Personal
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div style={{
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '12px',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem'
                }}>
                    Error: {error}
                </div>
            )}

            {/* Apple macOS Glass Segmented Controls (NO EMOJIS) */}
            <div className="personnel-segmented-bar">
                <button
                    type="button"
                    onClick={() => setActiveTab('directory')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '0.45rem 1.15rem',
                        borderRadius: '9px',
                        background: activeTab === 'directory' ? `rgba(var(--color-blue-rgb), 0.25)` : 'transparent',
                        color: activeTab === 'directory' ? 'var(--color-blue-light)' : '#94a3b8',
                        border: activeTab === 'directory' ? `1px solid rgba(var(--color-blue-rgb), 0.4)` : '1px solid transparent',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: activeTab === 'directory' ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none'
                    }}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {t('personnelDirectory') || 'Directorio de Personal'} ({filteredUsers.length})
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setActiveTab('rankings');
                        fetchRankingsData();
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '0.45rem 1.15rem',
                        borderRadius: '9px',
                        background: activeTab === 'rankings' ? 'rgba(234, 179, 8, 0.25)' : 'transparent',
                        color: activeTab === 'rankings' ? '#fde047' : '#94a3b8',
                        border: activeTab === 'rankings' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: activeTab === 'rankings' ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none'
                    }}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="7" />
                        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                    </svg>
                    {t('rankingsTab') || 'Rankings y Líderes'}
                </button>
            </div>

            {/* Main Content Area */}
            {loading && users.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        Cargando directorio de personal...
                    </div>
                </div>
            ) : activeTab === 'directory' ? (
                /* Directory Layout: 3 Columns Grid */
                <div className="personnel-grid">
                    {/* Column 1: Detectives */}
                    <div className="personnel-column">
                        <h3 className="column-title" style={{ color: '#fbbf24' }}>
                            Detectives ({detectives.length})
                        </h3>
                        <div className="personnel-list">
                            {detectives.length > 0 ? (
                                detectives.map(u => <UserCard key={u.id} user={u} />)
                            ) : (
                                <div className="empty-list">No se encontraron detectives</div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Helpers / Officers */}
                    <div className="personnel-column">
                        <h3 className="column-title" style={{ color: '#60a5fa' }}>
                            {isLSSD ? "Ayudantes SCUB" : "Ayudantes DB"} ({helpers.length})
                        </h3>
                        <div className="personnel-list">
                            {helpers.length > 0 ? (
                                helpers.map(u => <UserCard key={u.id} user={u} />)
                            ) : (
                                <div className="empty-list">No se encontraron oficiales</div>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Command & External Staff */}
                    <div className="personnel-column">
                        <h3 className="column-title" style={{ color: '#f87171' }}>
                            Comisionado y Mandos ({commandAndExternal.length})
                        </h3>
                        <div className="personnel-list">
                            {commandAndExternal.length > 0 ? (
                                commandAndExternal.map(u => <UserCard key={u.id} user={u} />)
                            ) : (
                                <div className="empty-list">No se encontró personal de mando</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Rankings & Monthly Statistics Section */
                <div className="rankings-tab-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Control Panel Toolbar */}
                    <div style={{
                        background: 'rgba(var(--secondary-rgb), 0.45)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '14px',
                        padding: '1.15rem 1.4rem',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        {/* Top row: Title, Status Pill, View Style Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: 'rgba(234, 179, 8, 0.15)',
                                        border: '1px solid rgba(234, 179, 8, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1rem'
                                    }}>
                                        📊
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                        {rankingsTimeframe === 'monthly'
                                            ? `Estadísticas Mensuales: ${MONTH_NAMES_ES[rankingsMonth]} ${rankingsYear}`
                                            : (t('timeframeAll') || 'Histórico Global Acumulado')}
                                    </h3>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        padding: '0.2rem 0.65rem',
                                        borderRadius: '6px',
                                        fontWeight: 800,
                                        letterSpacing: '0.03em',
                                        background: rankingSortMode === 'desc' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: rankingSortMode === 'desc' ? '#4ade80' : '#f87171',
                                        border: `1px solid ${rankingSortMode === 'desc' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                                    }}>
                                        {rankingSortMode === 'desc' ? '▲ MAYOR ACTIVIDAD' : '▼ MENOR ACTIVIDAD'}
                                    </span>
                                </div>
                                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {rankingsTimeframe === 'monthly'
                                        ? `Analizando aportes e intervenciones registradas en ${MONTH_NAMES_ES[rankingsMonth]} de ${rankingsYear}.`
                                        : 'Consolidado histórico de todas las intervenciones y actividad del personal policial.'}
                                </p>
                            </div>

                            {/* View Switcher: Cards vs Table */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: 'rgba(0, 0, 0, 0.35)',
                                padding: '3px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setRankingsViewStyle('cards')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0.42rem 0.95rem',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: rankingsViewStyle === 'cards' ? 'rgba(234, 179, 8, 0.25)' : 'transparent',
                                        color: rankingsViewStyle === 'cards' ? '#fde047' : '#94a3b8',
                                        fontWeight: rankingsViewStyle === 'cards' ? 700 : 500,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                                        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                    </svg>
                                    Tarjetas por Campo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRankingsViewStyle('table')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0.42rem 0.95rem',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: rankingsViewStyle === 'table' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                                        color: rankingsViewStyle === 'table' ? '#60a5fa' : '#94a3b8',
                                        fontWeight: rankingsViewStyle === 'table' ? 700 : 500,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                                        <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                                        <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                    </svg>
                                    Matriz de Rendimiento
                                </button>
                            </div>
                        </div>

                        {/* Bottom row: Timeframe, Month Navigation, Sort Mode */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.85rem',
                            paddingTop: '0.85rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.07)'
                        }}>
                            {/* Timeframe Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{
                                    display: 'inline-flex',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    padding: '3px',
                                    borderRadius: '9px',
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setRankingsTimeframe('monthly')}
                                        style={{
                                            padding: '0.38rem 0.85rem',
                                            borderRadius: '7px',
                                            border: 'none',
                                            background: rankingsTimeframe === 'monthly' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                                            color: rankingsTimeframe === 'monthly' ? '#93c5fd' : '#94a3b8',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📅 {t('timeframeMonthly') || 'Estadísticas Mensuales'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRankingsTimeframe('all')}
                                        style={{
                                            padding: '0.38rem 0.85rem',
                                            borderRadius: '7px',
                                            border: 'none',
                                            background: rankingsTimeframe === 'all' ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
                                            color: rankingsTimeframe === 'all' ? '#d8b4fe' : '#94a3b8',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🌐 {t('timeframeAll') || 'Histórico Global'}
                                    </button>
                                </div>

                                {/* Month & Year Selector (only when monthly is active) */}
                                {rankingsTimeframe === 'monthly' && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        padding: '3px 8px',
                                        borderRadius: '9px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={handlePrevMonth}
                                            title="Mes anterior"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: '#e2e8f0',
                                                width: '24px',
                                                height: '24px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            ◀
                                        </button>

                                        <select
                                            value={rankingsMonth}
                                            onChange={(e) => setRankingsMonth(Number(e.target.value))}
                                            style={{
                                                background: 'transparent',
                                                color: '#f8fafc',
                                                border: 'none',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                padding: '2px 4px',
                                                outline: 'none'
                                            }}
                                        >
                                            {MONTH_NAMES_ES.map((m, idx) => (
                                                <option key={m} value={idx} style={{ background: '#1e293b', color: '#fff' }}>
                                                    {m}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            value={rankingsYear}
                                            onChange={(e) => setRankingsYear(Number(e.target.value))}
                                            style={{
                                                background: 'transparent',
                                                color: '#f8fafc',
                                                border: 'none',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                padding: '2px 4px',
                                                outline: 'none'
                                            }}
                                        >
                                            {[2024, 2025, 2026, 2027].map(y => (
                                                <option key={y} value={y} style={{ background: '#1e293b', color: '#fff' }}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            type="button"
                                            onClick={handleNextMonth}
                                            title="Mes siguiente"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: '#e2e8f0',
                                                width: '24px',
                                                height: '24px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            ▶
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Sort Mode: Mayor Actividad vs Menor Actividad */}
                            <div style={{
                                display: 'inline-flex',
                                background: 'rgba(0, 0, 0, 0.3)',
                                padding: '3px',
                                borderRadius: '9px',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setRankingSortMode('desc')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '0.38rem 0.85rem',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: rankingSortMode === 'desc' ? 'rgba(34, 197, 94, 0.25)' : 'transparent',
                                        color: rankingSortMode === 'desc' ? '#4ade80' : '#94a3b8',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🥇 {t('viewHighest') || 'Mayor Actividad'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRankingSortMode('asc')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '0.38rem 0.85rem',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: rankingSortMode === 'asc' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                                        color: rankingSortMode === 'asc' ? '#f87171' : '#94a3b8',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    📉 {t('viewLowest') || 'Menor Actividad'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Body: Loading, Cards or Table */}
                    {rankingsLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '18px', height: '18px', border: '2px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                                Cargando estadísticas y rankings...
                            </div>
                        </div>
                    ) : rankingsViewStyle === 'cards' ? (
                        /* CARDS VIEW */
                        <div className="rankings-grid">
                            {[
                                {
                                    key: 'closed_cases',
                                    title: t('rankClosedCasesTitle') || 'Casos en Closed',
                                    desc: rankingSortMode === 'desc'
                                        ? (t('rankClosedCasesDesc') || 'Personas con más casos criminales cerrados y resueltos')
                                        : 'Personas con menor o nulo registro de casos resueltos',
                                    iconColor: '#fbbf24',
                                    unit: t('unitCases') || 'Casos',
                                    icon: (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        </svg>
                                    )
                                },
                                {
                                    key: 'incidents',
                                    title: t('rankIncidentsTitle') || 'Incidentes Subidos',
                                    desc: rankingSortMode === 'desc'
                                        ? (t('rankIncidentsDesc') || 'Personas con más partes de incidentes subidos')
                                        : 'Personas con menor o nulo registro de partes de incidentes',
                                    iconColor: '#f87171',
                                    unit: t('unitIncidents') || 'Incidentes',
                                    icon: (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                    )
                                },
                                {
                                    key: 'outings',
                                    title: t('rankOutingsTitle') || 'Vigilancias Subidas',
                                    desc: rankingSortMode === 'desc'
                                        ? (t('rankOutingsDesc') || 'Personas con más salidas de vigilancia (Outings) registradas')
                                        : 'Personas con menor o nulo registro de salidas de vigilancia',
                                    iconColor: '#60a5fa',
                                    unit: t('unitOutings') || 'Vigilancias',
                                    icon: (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )
                                },
                                {
                                    key: 'interrogations',
                                    title: t('rankInterrogationsTitle') || 'Interrogatorios Realizados',
                                    desc: rankingSortMode === 'desc'
                                        ? (t('rankInterrogationsDesc') || 'Personas presentes en un mayor número de interrogatorios')
                                        : 'Personas con menor o nula participación en interrogatorios',
                                    iconColor: '#a5b4fc',
                                    unit: t('unitInterrogations') || 'Interrogatorios',
                                    icon: (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                        </svg>
                                    )
                                },
                                {
                                    key: 'matrix',
                                    title: t('rankMatricesTitle') || 'Matrices Subidas',
                                    desc: rankingSortMode === 'desc'
                                        ? (t('rankMatricesDesc') || 'Personas con más matrices de control de tiempo subidas en Gang Unit')
                                        : 'Personas con menor o nulo registro de matrices subidas',
                                    iconColor: '#4ade80',
                                    unit: t('unitMatrices') || 'Matrices',
                                    icon: (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="20" x2="18" y2="10" />
                                            <line x1="12" y1="20" x2="12" y2="4" />
                                            <line x1="6" y1="20" x2="6" y2="14" />
                                        </svg>
                                    )
                                }
                            ].map((card) => {
                                const list = processedRankings[card.key] || [];
                                return (
                                    <div key={card.key} className="ranking-card">
                                        <div className="ranking-card-header">
                                            <span className="ranking-card-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                {card.icon}
                                            </span>
                                            <h3 className="ranking-card-title">{card.title}</h3>
                                        </div>
                                        <div className="ranking-card-desc">{card.desc}</div>
                                        <div className="ranking-list">
                                            {list.length === 0 ? (
                                                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
                                                    {t('noRankingsFound') || 'Sin registros en este periodo'}
                                                </div>
                                            ) : (
                                                list.map((item, idx) => {
                                                    const isDesc = rankingSortMode === 'desc';
                                                    const rankClass = isDesc ? (idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''))) : '';
                                                    const badgeSymbol = isDesc
                                                        ? (idx === 0 ? '1º' : (idx === 1 ? '2º' : (idx === 2 ? '3º' : `#${idx + 1}`)))
                                                        : `#${idx + 1}`;
                                                    const isZero = item.count === 0;

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="ranking-item"
                                                            onClick={() => navigate(`/personnel/${item.id}`)}
                                                            title="Ver perfil del agente"
                                                        >
                                                            <div
                                                                className={`rank-badge ${rankClass}`}
                                                                style={!isDesc ? {
                                                                    background: isZero ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                                                    color: isZero ? '#fca5a5' : '#94a3b8',
                                                                    border: isZero ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)'
                                                                } : {}}
                                                            >
                                                                {badgeSymbol}
                                                            </div>
                                                            <img
                                                                src={getProfileImage(item.profile_image, '/logowebp/anon.webp')}
                                                                alt={item.nombre}
                                                                className="ranking-avatar"
                                                            />
                                                            <div className="ranking-user-info">
                                                                <div className="ranking-user-name">{item.nombre} {item.apellido}</div>
                                                                <div className="ranking-user-rank">{item.rango} #{item.no_placa || '---'}</div>
                                                            </div>
                                                            <div
                                                                className="ranking-count-pill"
                                                                style={!isDesc && isZero ? {
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    borderColor: 'rgba(239, 68, 68, 0.35)',
                                                                    color: '#fca5a5'
                                                                } : {}}
                                                            >
                                                                {item.count} {card.unit}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* TABLE / MATRIX VIEW */
                        <div style={{
                            background: 'rgba(var(--secondary-rgb), 0.45)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '14px',
                            padding: '1.25rem',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                        }}>
                            {/* Search and Summary KPIs */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, rango o placa..."
                                        value={rankingsTableSearch}
                                        onChange={(e) => setRankingsTableSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.55rem 0.9rem 0.55rem 2.2rem',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontSize: '0.85rem',
                                            outline: 'none'
                                        }}
                                    />
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#94a3b8"
                                        strokeWidth="2"
                                        style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Mostrando {filteredAndSortedAgentMatrix.length} agentes
                                    </span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '999px',
                                        background: 'rgba(34, 197, 94, 0.15)',
                                        color: '#4ade80',
                                        border: '1px solid rgba(34, 197, 94, 0.3)'
                                    }}>
                                        🟢 {filteredAndSortedAgentMatrix.filter(u => u.total >= 10).length} Alta
                                    </span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '999px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#60a5fa',
                                        border: '1px solid rgba(59, 130, 246, 0.3)'
                                    }}>
                                        🔵 {filteredAndSortedAgentMatrix.filter(u => u.total >= 4 && u.total < 10).length} Moderada
                                    </span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '999px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#f87171',
                                        border: '1px solid rgba(239, 68, 68, 0.3)'
                                    }}>
                                        🔴 {filteredAndSortedAgentMatrix.filter(u => u.total === 0).length} Sin Actividad
                                    </span>
                                </div>
                            </div>

                            {/* Table */}
                            <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                                            {[
                                                { id: 'nombre', label: 'Agente' },
                                                { id: 'rango', label: 'Rango / Placa' },
                                                { id: 'closed_cases', label: 'Casos Resueltos' },
                                                { id: 'incidents', label: 'Informes' },
                                                { id: 'outings', label: 'Vigilancias' },
                                                { id: 'interrogations', label: 'Interrogatorios' },
                                                { id: 'matrix', label: 'Matrices GU' },
                                                { id: 'total', label: 'Total Aportes' },
                                                { id: 'status', label: 'Nivel Actividad', noSort: true }
                                            ].map(col => {
                                                const isCurrent = rankingsTableSortCol === col.id;
                                                return (
                                                    <th
                                                        key={col.id}
                                                        onClick={() => {
                                                            if (col.noSort) return;
                                                            if (rankingsTableSortCol === col.id) {
                                                                setRankingsTableSortAsc(!rankingsTableSortAsc);
                                                            } else {
                                                                setRankingsTableSortCol(col.id);
                                                                setRankingsTableSortAsc(col.id === 'nombre' || col.id === 'rango');
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '0.75rem 1rem',
                                                            fontWeight: 700,
                                                            cursor: col.noSort ? 'default' : 'pointer',
                                                            userSelect: 'none',
                                                            whiteSpace: 'nowrap',
                                                            color: isCurrent ? 'var(--accent-gold)' : '#94a3b8',
                                                            borderBottom: isCurrent ? '2px solid var(--accent-gold)' : 'none'
                                                        }}
                                                    >
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                            {col.label}
                                                            {!col.noSort && (
                                                                <span style={{ fontSize: '0.7rem', opacity: isCurrent ? 1 : 0.35 }}>
                                                                    {isCurrent ? (rankingsTableSortAsc ? '▲' : '▼') : '↕'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAndSortedAgentMatrix.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                    No se encontraron agentes con los criterios de búsqueda.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAndSortedAgentMatrix.map((agent) => {
                                                const actStatus = agent.total >= 10
                                                    ? { label: 'Alta Actividad', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', color: '#4ade80' }
                                                    : agent.total >= 4
                                                        ? { label: 'Moderada', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }
                                                        : agent.total >= 1
                                                            ? { label: 'Baja', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', color: '#fde047' }
                                                            : { label: 'Sin Actividad', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', color: '#f87171' };

                                                return (
                                                    <tr
                                                        key={agent.id}
                                                        onClick={() => navigate(`/personnel/${agent.id}`)}
                                                        style={{
                                                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <img
                                                                    src={getProfileImage(agent.profile_image, '/logowebp/anon.webp')}
                                                                    alt={agent.nombre}
                                                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                                                                        {agent.nombre} {agent.apellido}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                        {agent.rango_interno || agent.rol || 'Agente'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem', color: '#cbd5e1' }}>
                                                            {agent.rango} <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>#{agent.no_placa || '---'}</span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{ fontWeight: 600, color: agent.closed_cases > 0 ? '#fbbf24' : '#64748b' }}>
                                                                {agent.closed_cases}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{ fontWeight: 600, color: agent.incidents > 0 ? '#f87171' : '#64748b' }}>
                                                                {agent.incidents}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{ fontWeight: 600, color: agent.outings > 0 ? '#60a5fa' : '#64748b' }}>
                                                                {agent.outings}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{ fontWeight: 600, color: agent.interrogations > 0 ? '#a5b4fc' : '#64748b' }}>
                                                                {agent.interrogations}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{ fontWeight: 600, color: agent.matrix > 0 ? '#4ade80' : '#64748b' }}>
                                                                {agent.matrix}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{
                                                                padding: '0.2rem 0.6rem',
                                                                borderRadius: '8px',
                                                                fontWeight: 800,
                                                                fontSize: '0.85rem',
                                                                background: agent.total > 0 ? 'rgba(var(--color-blue-rgb), 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                                color: agent.total > 0 ? 'var(--color-blue-light)' : '#64748b',
                                                                border: agent.total > 0 ? '1px solid rgba(var(--color-blue-rgb), 0.35)' : '1px solid rgba(255, 255, 255, 0.08)'
                                                            }}>
                                                                {agent.total}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.7rem 1rem' }}>
                                                            <span style={{
                                                                padding: '0.22rem 0.65rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                background: actStatus.bg,
                                                                color: actStatus.color,
                                                                border: `1px solid ${actStatus.border}`,
                                                                display: 'inline-block'
                                                            }}>
                                                                {actStatus.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Personnel Modal */}
            {showModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '640px',
                        width: '92vw',
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
                        {/* Titlebar with window dots */}
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowModal(false)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {modalMode === 'create' ? 'Añadir Nuevo Personal' : 'Editar Personal'}
                                </h3>
                            </div>
                        </div>

                        {message && (
                            <div style={{
                                padding: '0.85rem 1rem', marginBottom: '1.2rem', borderRadius: '10px',
                                backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: message.type === 'success' ? '#4ade80' : '#f87171',
                                border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Email</label>
                                <input
                                    required type="email" name="email" className="form-input" value={formData.email} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Contraseña {modalMode === 'edit' && '(Opcional)'}</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required={modalMode === 'create'}
                                    placeholder={modalMode === 'edit' ? "Dejar en blanco para conservar" : ""}
                                    style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Nombre</label>
                                <input
                                    required type="text" name="nombre" className="form-input" value={formData.nombre} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Apellido</label>
                                <input
                                    required type="text" name="apellido" className="form-input" value={formData.apellido} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Número de Placa</label>
                                <input
                                    required type="text" name="no_placa" className="form-input" value={formData.no_placa} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '10px', color: '#fde047', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', padding: '0.65rem 0.9rem' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Imagen de Perfil</label>
                                <label className="custom-file-upload" style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#cbd5e1', padding: '0.65rem 0.9rem', cursor: 'pointer', textAlign: 'center', fontSize: '0.82rem', display: 'block' }}>
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                    {formData.profile_image ? "Imagen Seleccionada ✓" : "Seleccionar Imagen..."}
                                </label>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Rango</label>
                                <select
                                    name="rango" className="form-input custom-select" value={formData.rango} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                >
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
                                    <option value="SEB Agent">SEB Agent</option>
                                    <option value="ASD Agent">ASD Agent</option>
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

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Rango Interno en la División</label>
                                <select
                                    name="rango_interno" className="form-input custom-select" value={formData.rango_interno || 'Auxiliar de Investigación'} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                >
                                    {availableInternalRanks.map(r => {
                                        const name = typeof r === 'string' ? r : r.name;
                                        return <option key={name} value={name} style={{ background: '#0f172a' }}>{name}</option>;
                                    })}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Rol del Sistema</label>
                                <select
                                    name="rol" className="form-input custom-select" value={formData.rol} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                >
                                    <option value="Externo">Invitado</option>
                                    <option value="Ayudante">Ayudante</option>
                                    <option value="Detective">Detective</option>
                                    <option value="Coordinador">Coordinador</option>
                                    <option value="Comisionado">Comisionado</option>
                                    <option value="Administrador">Administrador</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>División(es)</label>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.65)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                                    {['Detective Bureau', 'Internal Affairs', 'DOJ', 'SEB', 'ASD', 'DTP', 'Gang Unit', 'Undercover'].map(divName => (
                                        <label key={divName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#f8fafc', fontSize: '0.82rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.divisions.includes(divName)}
                                                onChange={(e) => {
                                                    const newDivisions = e.target.checked
                                                        ? [...formData.divisions, divName]
                                                        : formData.divisions.filter(d => d !== divName);
                                                    setFormData({ ...formData, divisions: newDivisions });
                                                }}
                                            />
                                            {divName}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#6ee7b7', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span>🪪</span>
                                    <span>Licencias y Habilitaciones ({formData.licenses?.length || 0})</span>
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.65)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                    {availableLicenses.length === 0 ? (
                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No hay licencias registradas en Coordinación.</span>
                                    ) : (
                                        availableLicenses.map(lic => {
                                            const isChecked = formData.licenses?.includes(lic.name);
                                            const licColor = lic.color || '#10b981';
                                            return (
                                                <button
                                                    key={lic.name}
                                                    type="button"
                                                    onClick={() => {
                                                        const newLics = isChecked
                                                            ? formData.licenses.filter(l => l !== lic.name)
                                                            : [...(formData.licenses || []), lic.name];
                                                        setFormData({ ...formData, licenses: newLics });
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '5px 10px',
                                                        borderRadius: '8px',
                                                        background: isChecked ? `${licColor}33` : 'rgba(255, 255, 255, 0.04)',
                                                        border: isChecked ? `1px solid ${licColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                                                        color: isChecked ? '#ffffff' : '#94a3b8',
                                                        fontSize: '0.8rem',
                                                        fontWeight: isChecked ? 700 : 500,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    title={lic.description || lic.name}
                                                >
                                                    <span>{lic.icon || '🪪'}</span>
                                                    <span>{lic.code ? `${lic.code} - ` : ''}{lic.name}</span>
                                                    {isChecked && <span style={{ color: licColor, marginLeft: '2px', fontWeight: 800 }}>✓</span>}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>Fecha de Ingreso al Bureau</label>
                                <input
                                    required type="date" name="fecha_ingreso" className="form-input" value={formData.fecha_ingreso} onChange={handleInputChange}
                                    style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.88rem', padding: '0.65rem 0.9rem' }}
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowModal(false)} disabled={processing} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="login-button" disabled={processing} style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }}>
                                    {processing ? 'Guardando...' : (modalMode === 'create' ? 'Añadir Personal' : 'Guardar Cambios')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cropper Modal */}
            {editorOpen && createPortal(
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '420px',
                        width: '90vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        textAlign: 'center'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={handleCancelCrop} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.1rem', color: '#f8fafc', fontWeight: 800 }}>
                                    Ajustar Imagen de Perfil
                                </h3>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor
                                ref={editorRef}
                                image={imageSrc}
                                width={240}
                                height={240}
                                border={20}
                                borderRadius={120}
                                color={[0, 0, 0, 0.6]}
                                scale={scale}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                                <span>-</span>
                                <input
                                    type="range" min="1" max="3" step="0.01" value={scale}
                                    className="zoom-slider"
                                    style={{ flex: 1 }}
                                    onChange={(e) => setScale(parseFloat(e.target.value))}
                                />
                                <span>+</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={handleCancelCrop} style={{ width: 'auto', padding: '0.45rem 1.2rem', borderRadius: '10px' }}>Cancelar</button>
                                <button type="button" className="login-button" onClick={handleSaveCroppedImage} style={{ width: 'auto', padding: '0.45rem 1.4rem', borderRadius: '10px', fontWeight: 700 }}>Guardar Imagen</button>
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


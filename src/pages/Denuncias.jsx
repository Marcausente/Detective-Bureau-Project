import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ComplaintCard from '../components/ComplaintCard';
import { useLanguage } from '../contexts/LanguageContext';
import { uploadImageToStorage, processHtmlImages } from '../utils/imageStorage';
import '../index.css';

function Denuncias() {
    const { t } = useLanguage();
    const [searchParams, setSearchParams] = useSearchParams();
    const highlightedRef = useRef(null);

    // Data lists
    const [complaints, setComplaints] = useState([]);
    const [openCases, setOpenCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Search and Filter State
    const [searchTerm, setSearchTerm] = useState('');

    // Modals visibility
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingComplaint, setEditingComplaint] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);

    // Dynamic forms initial states
    const initialComplainant = () => ({ nombre_apellido: '', telefono: '', id_documento: '' });
    const initialAccused = () => ({
        nombre_apellido: 'N/A',
        rasgos_fisicos: 'N/A',
        telefono: 'N/A',
        id_documento: 'N/A',
        instapic: 'N/A'
    });

    // Form states
    const [formCaseId, setFormCaseId] = useState('');
    const [complainants, setComplainants] = useState([initialComplainant()]);
    const [accusedList, setAccusedList] = useState([initialAccused()]);
    const [titulo, setTitulo] = useState('');
    const [motivo, setMotivo] = useState('');
    const [acontecimientos, setAcontecimientos] = useState('');
    const [solicitud, setSolicitud] = useState('');
    const [notas, setNotas] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        loadData();
        fetchOpenCases();
    }, []);

    // Scroll to highlighted element after data loads
    useEffect(() => {
        if (!loading && highlightedRef.current) {
            setTimeout(() => {
                highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    }, [loading]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_denuncias');
            if (error) throw error;
            setComplaints(data || []);
        } catch (err) {
            console.error('Error fetching complaints:', err);
            alert('Error loading complaints: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchOpenCases = async () => {
        try {
            const { data, error } = await supabase.rpc('get_cases', { p_status_filter: 'Open' });
            if (error) throw error;
            setOpenCases(data || []);
        } catch (err) {
            console.error('Error fetching cases:', err);
        }
    };

    // Form handlers
    const resetForm = () => {
        setFormCaseId('');
        setComplainants([initialComplainant()]);
        setAccusedList([initialAccused()]);
        setTitulo('');
        setMotivo('');
        setAcontecimientos('');
        setSolicitud('');
        setNotas('');
        setImageUrl('');
    };

    const handleAddComplainant = () => {
        setComplainants(prev => [...prev, initialComplainant()]);
    };

    const handleRemoveComplainant = (index) => {
        if (complainants.length > 1) {
            setComplainants(prev => prev.filter((_, idx) => idx !== index));
        }
    };

    const handleComplainantChange = (index, field, value) => {
        setComplainants(prev => prev.map((c, idx) => idx === index ? { ...c, [field]: value } : c));
    };

    const handleAddAccused = () => {
        setAccusedList(prev => [...prev, initialAccused()]);
    };

    const handleRemoveAccused = (index) => {
        if (accusedList.length > 1) {
            setAccusedList(prev => prev.filter((_, idx) => idx !== index));
        }
    };

    const handleAccusedChange = (index, field, value) => {
        setAccusedList(prev => prev.map((a, idx) => idx === index ? { ...a, [field]: value } : a));
    };

    // Image Upload & Canvas Resizing
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setImageUrl(dataUrl);
            };
        };
    };

    const parseJsonField = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        try {
            const parsed = typeof field === 'string' ? JSON.parse(field) : field;
            if (typeof parsed === 'string') {
                const doubleParsed = JSON.parse(parsed);
                return Array.isArray(doubleParsed) ? doubleParsed : [];
            }
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Error parsing JSON field in Denuncias:", e);
            return [];
        }
    };

    // Submissions
    const handleCreateComplaint = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let finalImageUrl = imageUrl;
            if (imageUrl && imageUrl.startsWith('data:')) {
                finalImageUrl = await uploadImageToStorage(imageUrl, 'complaints');
            }

            const finalAcontecimientos = await processHtmlImages(acontecimientos, 'complaints');

            const { data, error } = await supabase.rpc('create_denuncia', {
                p_case_id: formCaseId === "" ? null : formCaseId,
                p_complainants: complainants,
                p_accused: accusedList,
                p_motivo: motivo,
                p_acontecimientos: finalAcontecimientos,
                p_solicitud: solicitud || null,
                p_notas: notas || null,
                p_image_url: finalImageUrl || null,
                p_titulo: titulo
            });
            if (error) throw error;

            setShowCreateModal(false);
            resetForm();
            loadData();
        } catch (err) {
            alert('Error creating complaint: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (complaint) => {
        setEditingComplaint(complaint);
        setFormCaseId(complaint.case_id || '');
        setComplainants(parseJsonField(complaint.complainants) || [initialComplainant()]);
        setAccusedList(parseJsonField(complaint.accused) || [initialAccused()]);
        setTitulo(complaint.titulo || '');
        setMotivo(complaint.motivo || '');
        setAcontecimientos(complaint.acontecimientos || '');
        setSolicitud(complaint.solicitud || '');
        setNotas(complaint.notas || '');
        setImageUrl(complaint.image_url || '');
        setShowEditModal(true);
    };

    const handleUpdateComplaint = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let finalImageUrl = imageUrl;
            if (imageUrl && imageUrl.startsWith('data:')) {
                finalImageUrl = await uploadImageToStorage(imageUrl, 'complaints');
            }

            const finalAcontecimientos = await processHtmlImages(acontecimientos, 'complaints');

            const { error } = await supabase.rpc('update_denuncia', {
                p_id: editingComplaint.record_id,
                p_case_id: formCaseId === "" ? null : formCaseId,
                p_complainants: complainants,
                p_accused: accusedList,
                p_motivo: motivo,
                p_acontecimientos: finalAcontecimientos,
                p_solicitud: solicitud || null,
                p_notas: notas || null,
                p_image_url: finalImageUrl || null,
                p_titulo: titulo
            });
            if (error) throw error;

            setShowEditModal(false);
            setEditingComplaint(null);
            resetForm();
            loadData();
        } catch (err) {
            alert('Error updating complaint: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComplaint = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta denuncia?')) return;
        try {
            const { error } = await supabase.rpc('delete_denuncia', { p_id: id });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error al eliminar la denuncia: ' + err.message);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const { error } = await supabase.rpc('set_denuncia_status', { p_id: id, p_status: newStatus });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error updating status: ' + err.message);
        }
    };

    const handleLinkCase = async (id, caseId) => {
        const comp = complaints.find(c => c.record_id === id);
        if (!comp) return;
        try {
            const { error } = await supabase.rpc('update_denuncia', {
                p_id: id,
                p_case_id: caseId,
                p_complainants: parseJsonField(comp.complainants),
                p_accused: parseJsonField(comp.accused),
                p_motivo: comp.motivo,
                p_acontecimientos: comp.acontecimientos,
                p_solicitud: comp.solicitud,
                p_notas: comp.notas,
                p_image_url: comp.image_url,
                p_titulo: comp.titulo
            });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert('Error linking case: ' + err.message);
        }
    };

    // Filter logic based on Search Term
    const filteredComplaints = useMemo(() => {
        if (!searchTerm || searchTerm.trim() === '') return complaints;
        const term = searchTerm.toLowerCase().trim();
        return complaints.filter(c => {
            const compList = parseJsonField(c.complainants);
            const accList = parseJsonField(c.accused);
            const matchTitle = c.titulo && c.titulo.toLowerCase().includes(term);
            const matchRecord = c.record_id && c.record_id.toLowerCase().includes(term);
            const matchMotivo = c.motivo && c.motivo.toLowerCase().includes(term);
            const matchEvents = c.acontecimientos && c.acontecimientos.toLowerCase().includes(term);
            const matchNotes = c.notas && c.notas.toLowerCase().includes(term);
            const matchAuthor = c.author_name && c.author_name.toLowerCase().includes(term);

            const matchComplainants = compList.some(comp =>
                (comp.nombre_apellido && comp.nombre_apellido.toLowerCase().includes(term)) ||
                (comp.telefono && comp.telefono.toLowerCase().includes(term)) ||
                (comp.id_documento && comp.id_documento.toLowerCase().includes(term))
            );

            const matchAccused = accList.some(acc =>
                (acc.nombre_apellido && acc.nombre_apellido.toLowerCase().includes(term)) ||
                (acc.rasgos_fisicos && acc.rasgos_fisicos.toLowerCase().includes(term)) ||
                (acc.telefono && acc.telefono.toLowerCase().includes(term)) ||
                (acc.id_documento && acc.id_documento.toLowerCase().includes(term)) ||
                (acc.instapic && acc.instapic.toLowerCase().includes(term))
            );

            return matchTitle || matchRecord || matchMotivo || matchEvents || matchNotes || matchAuthor || matchComplainants || matchAccused;
        });
    }, [complaints, searchTerm]);

    // Column filtering
    const openComplaints = useMemo(() => filteredComplaints.filter(c => c.status === 'Open' && !c.case_id), [filteredComplaints]);
    const withCaseComplaints = useMemo(() => filteredComplaints.filter(c => c.status === 'Open' && c.case_id), [filteredComplaints]);
    const closedComplaints = useMemo(() => filteredComplaints.filter(c => c.status === 'Closed'), [filteredComplaints]);

    return (
        <div
            id="denuncias-page"
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
            {/* Header / Navbar Bar */}
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
                {/* Left: Brand Logo & Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img
                        src="/logowebp/Generalcrimes.webp"
                        alt="General Crimes Logo"
                        style={{ height: '48px', width: 'auto', filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.4))' }}
                    />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.015em' }}>
                            {t('complaintsTitle') || 'Registro de Denuncias'}
                        </h2>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Abiertas: <strong style={{ color: '#60a5fa' }}>{openComplaints.length}</strong></span>
                            <span>•</span>
                            <span>Con Caso: <strong style={{ color: '#4ade80' }}>{withCaseComplaints.length}</strong></span>
                            <span>•</span>
                            <span>Archivadas: <strong style={{ color: '#f87171' }}>{closedComplaints.length}</strong></span>
                        </div>
                    </div>
                </div>

                {/* Right: Search + Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Real-Time Search input pill */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '20px',
                        padding: '0.38rem 0.9rem',
                        gap: '8px',
                        minWidth: '260px',
                        transition: 'border-color 0.2s',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nº, título, denunciante..."
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

                    {/* Reset URL Highlight parameter button */}
                    {searchParams.get('complaint_id') && (
                        <button
                            type="button"
                            onClick={() => setSearchParams({})}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '0.38rem 1rem',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '20px',
                                color: '#cbd5e1',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Mostrar todos
                        </button>
                    )}

                    {/* Create Complaint Button */}
                    <button
                        type="button"
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '7px',
                            padding: '0.4rem 1.15rem',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.4) 100%)',
                            border: '1px solid rgba(96, 165, 250, 0.4)',
                            borderRadius: '20px',
                            color: '#93c5fd',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.2)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t('logComplaintBtn') || 'Registrar Denuncia'}
                    </button>
                </div>
            </div>

            {/* Main Column Feed Grid */}
            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        {t('loadingComplaints') || 'Cargando denuncias...'}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '1.25rem',
                    width: '100%',
                    height: 'calc(100% - 70px)',
                    minHeight: 0
                }}>
                    {/* Column 1: Denuncias Abiertas */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '16px',
                        padding: '1rem',
                        height: '100%',
                        minHeight: 0,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            paddingBottom: '0.75rem',
                            marginBottom: '0.75rem',
                            borderBottom: '1px solid rgba(59, 130, 246, 0.25)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 10px #60a5fa' }}></span>
                                {t('openComplaintsCol') || 'Denuncias Abiertas'}
                            </h3>
                            <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {openComplaints.length}
                            </span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem' }} className="custom-scrollbar">
                            {openComplaints.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    {t('noComplaints') || 'No hay denuncias abiertas'}
                                </div>
                            ) : (
                                openComplaints.map(item => {
                                    const isHighlighted = searchParams.get('complaint_id') === item.record_id;
                                    return (
                                        <div key={item.record_id} ref={isHighlighted ? highlightedRef : null}>
                                            <ComplaintCard
                                                data={item}
                                                onExpand={setExpandedImage}
                                                onDelete={handleDeleteComplaint}
                                                onEdit={handleEditClick}
                                                onStatusChange={handleStatusChange}
                                                onLinkCase={handleLinkCase}
                                                openCases={openCases}
                                                isHighlighted={isHighlighted}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Column 2: Denuncias con Caso */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '16px',
                        padding: '1rem',
                        height: '100%',
                        minHeight: 0,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            paddingBottom: '0.75rem',
                            marginBottom: '0.75rem',
                            borderBottom: '1px solid rgba(34, 197, 94, 0.25)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }}></span>
                                {t('withCaseComplaintsCol') || 'Denuncias con Caso'}
                            </h3>
                            <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {withCaseComplaints.length}
                            </span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem' }} className="custom-scrollbar">
                            {withCaseComplaints.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }}>
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                    {t('noWithCaseComplaints') || 'No hay denuncias vinculadas a casos'}
                                </div>
                            ) : (
                                withCaseComplaints.map(item => {
                                    const isHighlighted = searchParams.get('complaint_id') === item.record_id;
                                    return (
                                        <div key={item.record_id} ref={isHighlighted ? highlightedRef : null}>
                                            <ComplaintCard
                                                data={item}
                                                onExpand={setExpandedImage}
                                                onDelete={handleDeleteComplaint}
                                                onEdit={handleEditClick}
                                                onStatusChange={handleStatusChange}
                                                onLinkCase={handleLinkCase}
                                                openCases={openCases}
                                                isHighlighted={isHighlighted}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Column 3: Denuncias Archivadas */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '16px',
                        padding: '1rem',
                        height: '100%',
                        minHeight: 0,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            paddingBottom: '0.75rem',
                            marginBottom: '0.75rem',
                            borderBottom: '1px solid rgba(239, 68, 68, 0.25)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 10px #f87171' }}></span>
                                {t('closedComplaintsCol') || 'Denuncias Archivadas'}
                            </h3>
                            <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {closedComplaints.length}
                            </span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem' }} className="custom-scrollbar">
                            {closedComplaints.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }}>
                                        <polyline points="21 8 21 21 3 21 3 8" />
                                        <rect x="1" y="3" width="22" height="5" />
                                    </svg>
                                    {t('noClosedComplaints') || 'No hay denuncias archivadas'}
                                </div>
                            ) : (
                                closedComplaints.map(item => {
                                    const isHighlighted = searchParams.get('complaint_id') === item.record_id;
                                    return (
                                        <div key={item.record_id} ref={isHighlighted ? highlightedRef : null}>
                                            <ComplaintCard
                                                data={item}
                                                onExpand={setExpandedImage}
                                                onDelete={handleDeleteComplaint}
                                                onEdit={handleEditClick}
                                                onStatusChange={handleStatusChange}
                                                isHighlighted={isHighlighted}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- CREATE MODAL --- */}
            {showCreateModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{ maxWidth: '720px', width: '92vw', maxHeight: '88vh', overflowY: 'auto', borderRadius: '16px' }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                                📋 {t('logComplaintBtn') || 'Registrar Denuncia'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* COMPLAINT TITLE */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600, color: '#60a5fa', fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>
                                    {t('complaintTitle') || 'Título de la Denuncia'}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={titulo}
                                    onChange={e => setTitulo(e.target.value)}
                                    placeholder="e.g. Robo a mano armada en joyería de Vinewood"
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* COMPLAINANTS LIST */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                                        👤 Denunciantes ({complainants.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleAddComplainant}
                                        style={{
                                            padding: '4px 10px',
                                            background: 'rgba(251, 191, 36, 0.15)',
                                            color: '#fbbf24',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + {t('addComplainantBtn') || 'Añadir Denunciante'}
                                    </button>
                                </div>

                                {complainants.map((c, index) => (
                                    <div key={index} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.65rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                                                Denunciante #{index + 1}
                                            </span>
                                            {complainants.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem' }} onClick={() => handleRemoveComplainant(index)}>
                                                    🗑️ Eliminar
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('complainantName') || 'Nombre y Apellidos'}</label>
                                                <input className="form-input" required value={c.nombre_apellido} onChange={e => handleComplainantChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('complainantPhone') || 'Teléfono'}</label>
                                                <input className="form-input" required value={c.telefono} onChange={e => handleComplainantChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('complainantId') || 'ID / DNI'}</label>
                                                <input className="form-input" required value={c.id_documento} onChange={e => handleComplainantChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ACCUSED LIST */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem' }}>
                                        👤 Denunciados ({accusedList.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleAddAccused}
                                        style={{
                                            padding: '4px 10px',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#f87171',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + {t('addAccusedBtn') || 'Añadir Denunciado'}
                                    </button>
                                </div>

                                {accusedList.map((a, index) => (
                                    <div key={index} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.65rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                                                Denunciado #{index + 1}
                                            </span>
                                            {accusedList.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem' }} onClick={() => handleRemoveAccused(index)}>
                                                    🗑️ Eliminar
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.5rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedName') || 'Nombre y Apellidos'}</label>
                                                <input className="form-input" required value={a.nombre_apellido} onChange={e => handleAccusedChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedTraits') || 'Rasgos Físicos / Vestimenta'}</label>
                                                <input className="form-input" required value={a.rasgos_fisicos} onChange={e => handleAccusedChange(index, 'rasgos_fisicos', e.target.value)} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedPhone') || 'Teléfono'}</label>
                                                <input className="form-input" required value={a.telefono} onChange={e => handleAccusedChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedId') || 'ID / DNI'}</label>
                                                <input className="form-input" required value={a.id_documento} onChange={e => handleAccusedChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedInstapic') || 'Instapic'}</label>
                                                <input className="form-input" required value={a.instapic} onChange={e => handleAccusedChange(index, 'instapic', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* BODY & MOTIVE */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{t('complaintReason') || 'Motivo de la Denuncia'}</label>
                                <input className="form-input" required value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="e.g. Robo con violencia y agresiones físicas" />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('complaintEvents') || 'Acontecimientos'}</label>
                                <textarea className="eval-textarea" rows="4" required value={acontecimientos} onChange={e => setAcontecimientos(e.target.value)} placeholder="Describe detalladamente lo ocurrido..." />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('complaintRequest') || 'Solicitud del Denunciante'}</label>
                                    <input className="form-input" value={solicitud} onChange={e => setSolicitud(e.target.value)} placeholder="e.g. Orden de alejamiento y compensación" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('complaintNotes') || 'Notas Internas'}</label>
                                    <input className="form-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones adicionales..." />
                                </div>
                            </div>

                            {/* IMAGE UPLOAD & LINK CASE */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                                        {t('uploadImageBtn') || 'Evidencia Fotográfica'}
                                    </label>
                                    <label htmlFor="complaint-file-upload" className="login-button btn-secondary" style={{ width: '100%', cursor: 'pointer', textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📷 {t('uploadImageBtn') || 'Adjuntar Imagen'}
                                    </label>
                                    <input
                                        id="complaint-file-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
                                    />
                                    {imageUrl && (
                                        <div style={{ position: 'relative', marginTop: '8px', display: 'inline-block' }}>
                                            <img src={imageUrl} style={{ height: '70px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }} alt="Preview" />
                                            <button
                                                type="button"
                                                onClick={() => setImageUrl('')}
                                                style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('linkToCaseLabel') || 'Vincular a Caso Abierto'}</label>
                                    <select
                                        className="form-input"
                                        value={formCaseId}
                                        onChange={e => setFormCaseId(e.target.value)}
                                        style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '6px' }}
                                    >
                                        <option value="">{t('noneOption') || 'Ninguno'}</option>
                                        {openCases.map(c => (
                                            <option key={c.id} value={c.id}>
                                                #{String(c.case_number).padStart(3, '0')} - {c.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)} style={{ width: 'auto', padding: '0.45rem 1.2rem' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.45rem 1.4rem' }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : (t('createComplaintBtn') || 'Crear Denuncia')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EDIT MODAL --- */}
            {showEditModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{ maxWidth: '720px', width: '92vw', maxHeight: '88vh', overflowY: 'auto', borderRadius: '16px' }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                                ✏️ {t('editComplaintTitle') || 'Editar Denuncia'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => { setShowEditModal(false); setEditingComplaint(null); resetForm(); }}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUpdateComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* COMPLAINT TITLE */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600, color: '#60a5fa', fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>
                                    {t('complaintTitle') || 'Título de la Denuncia'}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={titulo}
                                    onChange={e => setTitulo(e.target.value)}
                                    placeholder="e.g. Robo a mano armada en joyería de Vinewood"
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* COMPLAINANTS LIST */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                                        👤 Denunciantes ({complainants.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleAddComplainant}
                                        style={{
                                            padding: '4px 10px',
                                            background: 'rgba(251, 191, 36, 0.15)',
                                            color: '#fbbf24',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + {t('addComplainantBtn') || 'Añadir Denunciante'}
                                    </button>
                                </div>

                                {complainants.map((c, index) => (
                                    <div key={index} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.65rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                                                Denunciante #{index + 1}
                                            </span>
                                            {complainants.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem' }} onClick={() => handleRemoveComplainant(index)}>
                                                    🗑️ Eliminar
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('complainantName') || 'Nombre y Apellidos'}</label>
                                                <input className="form-input" required value={c.nombre_apellido} onChange={e => handleComplainantChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('complainantPhone') || 'Teléfono'}</label>
                                                <input className="form-input" required value={c.telefono} onChange={e => handleComplainantChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('complainantId') || 'ID / DNI'}</label>
                                                <input className="form-input" required value={c.id_documento} onChange={e => handleComplainantChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ACCUSED LIST */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem' }}>
                                        👤 Denunciados ({accusedList.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleAddAccused}
                                        style={{
                                            padding: '4px 10px',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#f87171',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + {t('addAccusedBtn') || 'Añadir Denunciado'}
                                    </button>
                                </div>

                                {accusedList.map((a, index) => (
                                    <div key={index} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', marginBottom: '0.65rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                                                Denunciado #{index + 1}
                                            </span>
                                            {accusedList.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem' }} onClick={() => handleRemoveAccused(index)}>
                                                    🗑️ Eliminar
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.5rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedName') || 'Nombre y Apellidos'}</label>
                                                <input className="form-input" required value={a.nombre_apellido} onChange={e => handleAccusedChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedTraits') || 'Rasgos Físicos / Vestimenta'}</label>
                                                <input className="form-input" required value={a.rasgos_fisicos} onChange={e => handleAccusedChange(index, 'rasgos_fisicos', e.target.value)} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedPhone') || 'Teléfono'}</label>
                                                <input className="form-input" required value={a.telefono} onChange={e => handleAccusedChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedId') || 'ID / DNI'}</label>
                                                <input className="form-input" required value={a.id_documento} onChange={e => handleAccusedChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t('accusedInstapic') || 'Instapic'}</label>
                                                <input className="form-input" required value={a.instapic} onChange={e => handleAccusedChange(index, 'instapic', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* BODY & MOTIVE */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{t('complaintReason') || 'Motivo de la Denuncia'}</label>
                                <input className="form-input" required value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="e.g. Robo con violencia y agresiones físicas" />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('complaintEvents') || 'Acontecimientos'}</label>
                                <textarea className="eval-textarea" rows="4" required value={acontecimientos} onChange={e => setAcontecimientos(e.target.value)} placeholder="Describe detalladamente lo ocurrido..." />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('complaintRequest') || 'Solicitud del Denunciante'}</label>
                                    <input className="form-input" value={solicitud} onChange={e => setSolicitud(e.target.value)} placeholder="e.g. Orden de alejamiento y compensación" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('complaintNotes') || 'Notas Internas'}</label>
                                    <input className="form-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones adicionales..." />
                                </div>
                            </div>

                            {/* IMAGE UPLOAD & LINK CASE */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                                        {t('uploadImageBtn') || 'Evidencia Fotográfica'}
                                    </label>
                                    <label htmlFor="complaint-edit-upload" className="login-button btn-secondary" style={{ width: '100%', cursor: 'pointer', textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        📷 {t('uploadImageBtn') || 'Adjuntar Imagen'}
                                    </label>
                                    <input
                                        id="complaint-edit-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
                                    />
                                    {imageUrl && (
                                        <div style={{ position: 'relative', marginTop: '8px', display: 'inline-block' }}>
                                            <img src={imageUrl} style={{ height: '70px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }} alt="Preview" />
                                            <button
                                                type="button"
                                                onClick={() => setImageUrl('')}
                                                style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('linkToCaseLabel') || 'Vincular a Caso Abierto'}</label>
                                    <select
                                        className="form-input"
                                        value={formCaseId}
                                        onChange={e => setFormCaseId(e.target.value)}
                                        style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '6px' }}
                                    >
                                        <option value="">{t('noneOption') || 'Ninguno'}</option>
                                        {openCases.map(c => (
                                            <option key={c.id} value={c.id}>
                                                #{String(c.case_number).padStart(3, '0')} - {c.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => { setShowEditModal(false); setEditingComplaint(null); resetForm(); }} style={{ width: 'auto', padding: '0.45rem 1.2rem' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.45rem 1.4rem' }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : (t('saveChangesBtn') || 'Guardar Cambios')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- IMAGE ZOOM OVERLAY --- */}
            {expandedImage && (
                <div className="mac-modal-overlay" onClick={() => setExpandedImage(null)} style={{ cursor: 'zoom-out', zIndex: 9999 }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img src={expandedImage} style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }} alt="Imagen ampliada" />
                        <button
                            type="button"
                            onClick={() => setExpandedImage(null)}
                            style={{
                                position: 'absolute',
                                top: -14,
                                right: -14,
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

export default Denuncias;


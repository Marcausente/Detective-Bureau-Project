import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ComplaintCard from '../components/ComplaintCard';
import { useLanguage } from '../contexts/LanguageContext';
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
            const { data, error } = await supabase.rpc('create_denuncia', {
                p_case_id: formCaseId === "" ? null : formCaseId,
                p_complainants: complainants,
                p_accused: accusedList,
                p_motivo: motivo,
                p_acontecimientos: acontecimientos,
                p_solicitud: solicitud || null,
                p_notas: notas || null,
                p_image_url: imageUrl || null,
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
            const { error } = await supabase.rpc('update_denuncia', {
                p_id: editingComplaint.record_id,
                p_case_id: formCaseId === "" ? null : formCaseId,
                p_complainants: complainants,
                p_accused: accusedList,
                p_motivo: motivo,
                p_acontecimientos: acontecimientos,
                p_solicitud: solicitud || null,
                p_notas: notas || null,
                p_image_url: imageUrl || null,
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

    // Column filtering
    const openComplaints = complaints.filter(c => c.status === 'Open' && !c.case_id);
    const withCaseComplaints = complaints.filter(c => c.status === 'Open' && c.case_id);
    const closedComplaints = complaints.filter(c => c.status === 'Closed');

    return (
        <div className="documentation-container" style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
            
            {/* Header Area */}
            <div className="doc-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <img 
                        src="/lssd/Generalcrimes.png" 
                        alt="General Crimes Logo" 
                        style={{ height: '70px', width: 'auto', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }} 
                    />
                    <h2 className="page-title" style={{ margin: 0 }}>{t('complaintsTitle')}</h2>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {searchParams.get('complaint_id') && (
                        <button
                            className="login-button btn-secondary"
                            style={{ width: 'auto', padding: '0.5rem 1rem' }}
                            onClick={() => setSearchParams({})}
                        >
                            Mostrar todos
                        </button>
                    )}
                    <button className="login-button" style={{ width: 'auto', margin: 0 }} onClick={() => { resetForm(); setShowCreateModal(true); }}>
                        {t('logComplaintBtn')}
                    </button>
                </div>
            </div>

            {/* Main Column Feed Grid */}
            {loading ? (
                <div className="loading-container">{t('loadingComplaints')}</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2rem', width: '100%' }}>
                    
                    {/* Column 1: Denuncias Abiertas */}
                    <div className="column-container" style={{ minWidth: 0, width: '100%' }}>
                        <h3 className="section-title" style={{ borderBottom: '2px solid #60a5fa', paddingBottom: '0.5rem', color: '#60a5fa' }}>
                            {t('openComplaintsCol')} ({openComplaints.length})
                        </h3>
                        <div className="scroll-feed" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {openComplaints.length === 0 ? (
                                <div className="empty-list">{t('noComplaints')}</div>
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
                    <div className="column-container" style={{ minWidth: 0, width: '100%' }}>
                        <h3 className="section-title" style={{ borderBottom: '2px solid #4ade80', paddingBottom: '0.5rem', color: '#4ade80' }}>
                            {t('withCaseComplaintsCol')} ({withCaseComplaints.length})
                        </h3>
                        <div className="scroll-feed" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {withCaseComplaints.length === 0 ? (
                                <div className="empty-list">{t('noWithCaseComplaints')}</div>
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

                    {/* Column 3: Denuncias Archivadas / Cerradas */}
                    <div className="column-container" style={{ minWidth: 0, width: '100%' }}>
                        <h3 className="section-title" style={{ borderBottom: '2px solid #f87171', paddingBottom: '0.5rem', color: '#f87171' }}>
                            {t('closedComplaintsCol')} ({closedComplaints.length})
                        </h3>
                        <div className="scroll-feed" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {closedComplaints.length === 0 ? (
                                <div className="empty-list">{t('noClosedComplaints')}</div>
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
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
                        <h3 className="section-title">{t('logComplaintBtn')}</h3>
                        <form onSubmit={handleCreateComplaint}>
                            
                            {/* COMPLAINT TITLE */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>{t('complaintTitle')}</label>
                                <input 
                                    type="text"
                                    className="form-input" 
                                    required 
                                    value={titulo} 
                                    onChange={e => setTitulo(e.target.value)} 
                                    placeholder="e.g. Robo a mano armada en joyería"
                                />
                            </div>

                            {/* COMPLAINANTS LIST */}
                            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>👤 {t('complainantNumber').replace('#{number}', 's')}</h4>
                                    <button type="button" className="login-button" style={{ width: 'auto', margin: 0, padding: '4px 10px', fontSize: '0.8rem' }} onClick={handleAddComplainant}>
                                        {t('addComplainantBtn')}
                                    </button>
                                </div>

                                {complainants.map((c, index) => (
                                    <div key={index} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t('complainantNumber').replace('{number}', index + 1)}</span>
                                            {complainants.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleRemoveComplainant(index)}>
                                                    ❌ Eliminar
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('complainantName')}</label>
                                                <input className="form-input" required value={c.nombre_apellido} onChange={e => handleComplainantChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('complainantPhone')}</label>
                                                <input className="form-input" required value={c.telefono} onChange={e => handleComplainantChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('complainantId')}</label>
                                                <input className="form-input" required value={c.id_documento} onChange={e => handleComplainantChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ACCUSED LIST */}
                            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: '#f87171' }}>👤 {t('accusedNumber').replace('#{number}', 's')}</h4>
                                    <button type="button" className="login-button" style={{ width: 'auto', margin: 0, padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }} onClick={handleAddAccused}>
                                        {t('addAccusedBtn')}
                                    </button>
                                </div>

                                {accusedList.map((a, index) => (
                                    <div key={index} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t('accusedNumber').replace('{number}', index + 1)}</span>
                                            {accusedList.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleRemoveAccused(index)}>
                                                    ❌ Eliminar
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedName')}</label>
                                                <input className="form-input" required value={a.nombre_apellido} onChange={e => handleAccusedChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedTraits')}</label>
                                                <input className="form-input" required value={a.rasgos_fisicos} onChange={e => handleAccusedChange(index, 'rasgos_fisicos', e.target.value)} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedPhone')}</label>
                                                <input className="form-input" required value={a.telefono} onChange={e => handleAccusedChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedId')}</label>
                                                <input className="form-input" required value={a.id_documento} onChange={e => handleAccusedChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedInstapic')}</label>
                                                <input className="form-input" required value={a.instapic} onChange={e => handleAccusedChange(index, 'instapic', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* BODY & MOTIVE */}
                            <div className="form-group">
                                <label className="form-label">{t('complaintReason')}</label>
                                <input className="form-input" required value={motivo} onChange={e => setMotivo(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('complaintEvents')}</label>
                                <textarea className="eval-textarea" rows="4" required value={acontecimientos} onChange={e => setAcontecimientos(e.target.value)} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('complaintRequest')}</label>
                                    <input className="form-input" value={solicitud} onChange={e => setSolicitud(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('complaintNotes')}</label>
                                    <input className="form-input" value={notas} onChange={e => setNotas(e.target.value)} />
                                </div>
                            </div>

                            {/* IMAGE UPLOAD */}
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t('uploadImageBtn')}</label>
                                <label htmlFor="complaint-file-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    📷 {t('uploadImageBtn')}
                                </label>
                                <input
                                    id="complaint-file-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />
                                {imageUrl && (
                                    <div style={{ position: 'relative', marginTop: '10px', display: 'inline-block' }}>
                                        <img src={imageUrl} style={{ height: '80px', borderRadius: '6px', border: '1px solid #444' }} alt="Preview" />
                                        <button
                                            type="button"
                                            onClick={() => setImageUrl('')}
                                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* LINK TO CASE */}
                            <div className="form-group">
                                <label className="form-label">{t('linkToCaseLabel')}</label>
                                <select 
                                    className="form-input" 
                                    value={formCaseId} 
                                    onChange={e => setFormCaseId(e.target.value)}
                                    style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px' }}
                                >
                                    <option value="">{t('noneOption')}</option>
                                    {openCases.map(c => (
                                        <option key={c.id} value={c.id}>
                                            #{String(c.case_number).padStart(3, '0')} - {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)} style={{ width: 'auto' }}>
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>
                                    {submitting ? t('savingBtn') : t('createComplaintBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EDIT MODAL --- */}
            {showEditModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
                        <h3 className="section-title">{t('editComplaintTitle')}</h3>
                        <form onSubmit={handleUpdateComplaint}>
                            
                            {/* COMPLAINT TITLE */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>{t('complaintTitle')}</label>
                                <input 
                                    type="text"
                                    className="form-input" 
                                    required 
                                    value={titulo} 
                                    onChange={e => setTitulo(e.target.value)} 
                                    placeholder="e.g. Robo a mano armada en joyería"
                                />
                            </div>

                            {/* COMPLAINANTS LIST */}
                            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>👤 {t('complainantNumber').replace('#{number}', 's')}</h4>
                                    <button type="button" className="login-button" style={{ width: 'auto', margin: 0, padding: '4px 10px', fontSize: '0.8rem' }} onClick={handleAddComplainant}>
                                        {t('addComplainantBtn')}
                                    </button>
                                </div>

                                {complainants.map((c, index) => (
                                    <div key={index} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t('complainantNumber').replace('{number}', index + 1)}</span>
                                            {complainants.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleRemoveComplainant(index)}>
                                                    ❌ Eliminar
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('complainantName')}</label>
                                                <input className="form-input" required value={c.nombre_apellido} onChange={e => handleComplainantChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('complainantPhone')}</label>
                                                <input className="form-input" required value={c.telefono} onChange={e => handleComplainantChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('complainantId')}</label>
                                                <input className="form-input" required value={c.id_documento} onChange={e => handleComplainantChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ACCUSED LIST */}
                            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: '#f87171' }}>👤 {t('accusedNumber').replace('#{number}', 's')}</h4>
                                    <button type="button" className="login-button" style={{ width: 'auto', margin: 0, padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }} onClick={handleAddAccused}>
                                        {t('addAccusedBtn')}
                                    </button>
                                </div>

                                {accusedList.map((a, index) => (
                                    <div key={index} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t('accusedNumber').replace('{number}', index + 1)}</span>
                                            {accusedList.length > 1 && (
                                                <button type="button" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleRemoveAccused(index)}>
                                                    ❌ Eliminar
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedName')}</label>
                                                <input className="form-input" required value={a.nombre_apellido} onChange={e => handleAccusedChange(index, 'nombre_apellido', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedTraits')}</label>
                                                <input className="form-input" required value={a.rasgos_fisicos} onChange={e => handleAccusedChange(index, 'rasgos_fisicos', e.target.value)} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedPhone')}</label>
                                                <input className="form-input" required value={a.telefono} onChange={e => handleAccusedChange(index, 'telefono', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedId')}</label>
                                                <input className="form-input" required value={a.id_documento} onChange={e => handleAccusedChange(index, 'id_documento', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('accusedInstapic')}</label>
                                                <input className="form-input" required value={a.instapic} onChange={e => handleAccusedChange(index, 'instapic', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* BODY & MOTIVE */}
                            <div className="form-group">
                                <label className="form-label">{t('complaintReason')}</label>
                                <input className="form-input" required value={motivo} onChange={e => setMotivo(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('complaintEvents')}</label>
                                <textarea className="eval-textarea" rows="4" required value={acontecimientos} onChange={e => setAcontecimientos(e.target.value)} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('complaintRequest')}</label>
                                    <input className="form-input" value={solicitud} onChange={e => setSolicitud(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('complaintNotes')}</label>
                                    <input className="form-input" value={notas} onChange={e => setNotas(e.target.value)} />
                                </div>
                            </div>

                            {/* IMAGE UPLOAD */}
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t('uploadImageBtn')}</label>
                                <label htmlFor="complaint-edit-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    📷 {t('uploadImageBtn')}
                                </label>
                                <input
                                    id="complaint-edit-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />
                                {imageUrl && (
                                    <div style={{ position: 'relative', marginTop: '10px', display: 'inline-block' }}>
                                        <img src={imageUrl} style={{ height: '80px', borderRadius: '6px', border: '1px solid #444' }} alt="Preview" />
                                        <button
                                            type="button"
                                            onClick={() => setImageUrl('')}
                                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* LINK TO CASE */}
                            <div className="form-group">
                                <label className="form-label">{t('linkToCaseLabel')}</label>
                                <select 
                                    className="form-input" 
                                    value={formCaseId} 
                                    onChange={e => setFormCaseId(e.target.value)}
                                    style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px' }}
                                >
                                    <option value="">{t('noneOption')}</option>
                                    {openCases.map(c => (
                                        <option key={c.id} value={c.id}>
                                            #{String(c.case_number).padStart(3, '0')} - {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => { setShowEditModal(false); setEditingComplaint(null); resetForm(); }} style={{ width: 'auto' }}>
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>
                                    {submitting ? t('savingBtn') : t('saveChangesBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- IMAGE ZOOM OVERLAY --- */}
            {expandedImage && (
                <div className="cropper-modal-overlay" onClick={() => setExpandedImage(null)} style={{ cursor: 'zoom-out' }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img src={expandedImage} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }} alt="Zoomed" />
                    </div>
                </div>
            )}

        </div>
    );
}

export default Denuncias;

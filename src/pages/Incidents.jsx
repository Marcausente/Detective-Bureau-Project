import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Incidents() {
    const [incidents, setIncidents] = useState([]);
    const [outings, setOutings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showOutingModal, setShowOutingModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);

    // Data for Selectors
    const [users, setUsers] = useState([]);
    const [gangs, setGangs] = useState([]); // List of gangs for selection

    // --- FORM STATE: INCIDENT ---
    const [incTitle, setIncTitle] = useState('');
    const [incLocation, setIncLocation] = useState('');
    const [incDate, setIncDate] = useState('');
    const [incTablet, setIncTablet] = useState('');
    const [incDesc, setIncDesc] = useState('');
    const [incGangId, setIncGangId] = useState(''); // Selected Gang
    const [incImages, setIncImages] = useState([]);

    // --- FORM STATE: OUTING ---
    const [outTitle, setOutTitle] = useState('');
    const [outDate, setOutDate] = useState('');
    const [outDetectives, setOutDetectives] = useState([]); // Array of IDs
    const [outReason, setOutReason] = useState('');
    const [outInfo, setOutInfo] = useState('');
    const [outGangId, setOutGangId] = useState(''); // Selected Gang
    const [outImages, setOutImages] = useState([]);


    useEffect(() => {
        loadData();
        fetchUsers();
        fetchGangs();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data: incData, error: incError } = await supabase.rpc('get_incidents_v2');
        const { data: outData, error: outError } = await supabase.rpc('get_outings');

        if (incError) console.error("Incidents Error:", incError);
        if (outError) console.error("Outings Error:", outError);

        setIncidents(incData || []);
        setOutings(outData || []);
        setLoading(false);
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango, profile_image').order('rango');
        setUsers(data || []);
    };

    const fetchGangs = async () => {
        // Simple fetch for dropdown
        const { data } = await supabase.from('gangs').select('id, name').order('name');
        setGangs(data || []);
    };

    // --- IMAGE HANDLING ---
    const handleImageUpload = (e, setState) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
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
                    setState(prev => [...prev, dataUrl]);
                };
            };
        });
    };

    // --- SUBMIT HANDLERS ---
    const handleSubmitIncident = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Updated to use create_incident_v2 (note: SQL needs to support gang_id if not already added to RPC or via separate update)
            // Correction: The v2 RPC in SQL doesn't have p_gang_id param yet. 
            // Strategy: Create then Link, OR update RPC. Updating RPC is cleaner but requires user to run SQL again.
            // I'll do Create then Link implicitly via direct UPDATE if RPC doesn't support it, but better to use the link_incident_gang RPC I made.

            const { data: newId, error } = await supabase.rpc('create_incident_v2', {
                p_title: incTitle,
                p_location: incLocation,
                p_occurred_at: new Date(incDate).toISOString(),
                p_tablet_number: incTablet,
                p_description: incDesc,
                p_images: incImages
            });
            if (error) throw error;

            if (incGangId) {
                await supabase.rpc('link_incident_gang', { p_incident_id: newId, p_gang_id: incGangId });
            }

            setShowIncidentModal(false);
            resetIncidentForm();
            loadData();
        } catch (err) {
            alert('Error creating incident: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitOuting = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { data: newId, error } = await supabase.rpc('create_outing', {
                p_title: outTitle,
                p_occurred_at: new Date(outDate).toISOString(),
                p_reason: outReason,
                p_info_obtained: outInfo,
                p_images: outImages,
                p_detective_ids: outDetectives
            });
            if (error) throw error;

            if (outGangId) {
                await supabase.rpc('link_outing_gang', { p_outing_id: newId, p_gang_id: outGangId });
            }

            setShowOutingModal(false);
            resetOutingForm();
            loadData();
        } catch (err) {
            alert('Error creating outing: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- DELETE HANDLERS ---
    const handleDeleteIncident = async (id) => {
        if (!confirm("Are you sure you want to delete this incident?")) return;
        try {
            const { error } = await supabase.rpc('delete_incident', { p_id: id });
            if (error) throw error;
            loadData();
        } catch (err) { alert(err.message); }
    };

    const handleDeleteOuting = async (id) => {
        if (!confirm("Are you sure you want to delete this outing?")) return;
        try {
            const { error } = await supabase.rpc('delete_outing', { p_id: id });
            if (error) throw error;
            loadData();
        } catch (err) { alert(err.message); }
    };

    // --- HELPERS ---
    const resetIncidentForm = () => {
        setIncTitle(''); setIncLocation(''); setIncDate(''); setIncTablet(''); setIncDesc(''); setIncGangId(''); setIncImages([]);
    };
    const resetOutingForm = () => {
        setOutTitle(''); setOutDate(''); setOutDetectives([]); setOutReason(''); setOutInfo(''); setOutGangId(''); setOutImages([]);
    };

    // Toggle Detective Selection
    const toggleDetective = (id) => {
        setOutDetectives(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // --- RENDER ---
    return (
        <div className="documentation-container" style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>

            {/* GLOBAL ACTIONS */}
            <div className="doc-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="page-title" style={{ margin: 0 }}>OPERATIONAL LOGS</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="login-button" style={{ width: 'auto' }} onClick={() => setShowIncidentModal(true)}>
                        + New Incident
                    </button>
                    <button className="login-button" style={{ width: 'auto', background: 'var(--accent-gold)', color: 'black' }} onClick={() => setShowOutingModal(true)}>
                        + New Outing
                    </button>
                </div>
            </div>

            {loading ? <div className="loading-container">Loading Operation Data...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>

                    {/* COLUMN 1: UNLINKED INCIDENTS */}
                    <div className="column-container">
                        <h3 className="section-title" style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>General Incidents</h3>
                        <div className="scroll-feed" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {incidents.filter(i => !i.gang_id).length === 0 ? <div className="empty-list">No unlinked incidents.</div> :
                                incidents.filter(i => !i.gang_id).map(inc => (
                                    <IncidentCard
                                        key={inc.record_id}
                                        data={inc}
                                        onExpand={setExpandedImage}
                                        onDelete={handleDeleteIncident}
                                    />
                                ))
                            }
                        </div>
                    </div>

                    {/* COLUMN 2: LINKED INCIDENTS */}
                    <div className="column-container">
                        <h3 className="section-title" style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Gang Linked Incidents</h3>
                        <div className="scroll-feed" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {incidents.filter(i => i.gang_id).length === 0 ? <div className="empty-list">No linked incidents.</div> :
                                incidents.filter(i => i.gang_id).map(inc => (
                                    <IncidentCard
                                        key={inc.record_id}
                                        data={inc}
                                        onExpand={setExpandedImage}
                                        onDelete={handleDeleteIncident}
                                    />
                                ))
                            }
                        </div>
                    </div>

                    {/* COLUMN 3: OUTINGS */}
                    <div className="column-container">
                        <h3 className="section-title" style={{ borderBottom: '2px solid var(--accent-gold)', paddingBottom: '0.5rem' }}>Outings & Patrols</h3>
                        <div className="scroll-feed" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {outings.length === 0 ? <div className="empty-list">No outings logged.</div> :
                                outings.map(out => (
                                    <OutingCard
                                        key={out.record_id}
                                        data={out}
                                        onExpand={setExpandedImage}
                                        onDelete={handleDeleteOuting}
                                    />
                                ))
                            }
                        </div>
                    </div>

                </div>
            )}

            {/* --- MODAL: NEW INCIDENT --- */}
            {showIncidentModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 className="section-title">Log New Incident</h3>
                        <form onSubmit={handleSubmitIncident}>
                            <div className="form-group"><label>Title</label><input className="form-input" required value={incTitle} onChange={e => setIncTitle(e.target.value)} /></div>
                            <div className="form-group">
                                <label>Link to Syndicate (Optional)</label>
                                <select className="form-input" value={incGangId} onChange={e => setIncGangId(e.target.value)}>
                                    <option value="">-- None --</option>
                                    {gangs.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label>Date & Time</label><input type="datetime-local" className="form-input" required value={incDate} onChange={e => setIncDate(e.target.value)} /></div>
                            <div className="form-group"><label>Location (Optional)</label><input className="form-input" value={incLocation} onChange={e => setIncLocation(e.target.value)} /></div>
                            <div className="form-group"><label>Tablet Incident # (Optional)</label><input className="form-input" value={incTablet} onChange={e => setIncTablet(e.target.value)} /></div>
                            <div className="form-group"><label>Description (Optional)</label><textarea className="eval-textarea" rows="4" value={incDesc} onChange={e => setIncDesc(e.target.value)} /></div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Images (Optional)</label>
                                <label htmlFor="inc-file-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    📷 Upload Images
                                </label>
                                <input
                                    id="inc-file-upload"
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, setIncImages)}
                                    style={{ display: 'none' }}
                                />
                                <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
                                    {incImages.map((src, i) => (
                                        <div key={i} style={{ position: 'relative' }}>
                                            <img src={src} style={{ height: '60px', borderRadius: '4px', border: '1px solid #444' }} alt="" />
                                            <button
                                                type="button"
                                                onClick={() => setIncImages(prev => prev.filter((_, idx) => idx !== i))}
                                                style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowIncidentModal(false)} style={{ width: 'auto' }}>Cancel</button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: NEW OUTING --- */}
            {showOutingModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 className="section-title" style={{ color: 'var(--accent-gold)' }}>Log New Outing</h3>
                        <form onSubmit={handleSubmitOuting}>
                            <div className="form-group"><label>Title</label><input className="form-input" required value={outTitle} onChange={e => setOutTitle(e.target.value)} /></div>

                            {/* User Selector */}
                            <div className="form-group">
                                <label>Detectives Present</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {users.map(u => (
                                        <div key={u.id} onClick={() => toggleDetective(u.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outDetectives.includes(u.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={outDetectives.includes(u.id)} readOnly style={{ marginRight: '10px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{u.rango} {u.nombre} {u.apellido}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Link to Syndicate (Optional)</label>
                                <select className="form-input" value={outGangId} onChange={e => setOutGangId(e.target.value)}>
                                    <option value="">-- None --</option>
                                    {gangs.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group"><label>Date & Time</label><input type="datetime-local" className="form-input" required value={outDate} onChange={e => setOutDate(e.target.value)} /></div>
                            <div className="form-group"><label>Reason</label><input className="form-input" value={outReason} onChange={e => setOutReason(e.target.value)} /></div>
                            <div className="form-group"><label>Information Obtained</label><textarea className="eval-textarea" rows="4" value={outInfo} onChange={e => setOutInfo(e.target.value)} /></div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Images (Optional)</label>
                                <label htmlFor="out-file-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    📷 Upload Images
                                </label>
                                <input
                                    id="out-file-upload"
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, setOutImages)}
                                    style={{ display: 'none' }}
                                />
                                <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
                                    {outImages.map((src, i) => (
                                        <div key={i} style={{ position: 'relative' }}>
                                            <img src={src} style={{ height: '60px', borderRadius: '4px', border: '1px solid #444' }} alt="" />
                                            <button
                                                type="button"
                                                onClick={() => setOutImages(prev => prev.filter((_, idx) => idx !== i))}
                                                style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowOutingModal(false)} style={{ width: 'auto' }}>Cancel</button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : 'Create Outing'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* FULL SCREEN IMAGE VIEWER */}
            {expandedImage && (
                <div onClick={() => setExpandedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={expandedImage} alt="" style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain' }} />
                </div>
            )}
        </div>
    );
}

// --- SUB-COMPONENTS ---
function IncidentCard({ data, onExpand, onDelete }) {
    return (
        <div className="announcement-card" style={{ marginBottom: '1rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{data.title}</h4>
                    {data.tablet_incident_number && <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>Tablet #: {data.tablet_incident_number}</div>}
                </div>
                {data.can_delete && (
                    <button onClick={() => onDelete(data.record_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
                )}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
                📅 {new Date(data.occurred_at).toLocaleString()} <br />
                {data.location && <span>📍 {data.location}</span>}
            </div>

            {data.description && <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-line', marginBottom: '0.5rem' }}>{data.description}</div>}

            {data.images && data.images.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {data.images.map((src, i) => (
                        <div key={i} onClick={() => onExpand(src)} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <img src={src} style={{ height: '60px', width: '60px', objectFit: 'cover' }} alt="" />
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <img src={data.author_avatar || '/anon.png'} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '5px' }} />
                By {data.author_rank} {data.author_name}
            </div>
        </div>
    );
}

function OutingCard({ data, onExpand, onDelete }) {
    return (
        <div className="announcement-card" style={{ marginBottom: '1rem', background: 'rgba(20, 20, 20, 0.6)', padding: '1rem', borderLeft: '2px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>{data.title}</h4>
                {data.can_delete && (
                    <button onClick={() => onDelete(data.record_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem', marginLeft: 'auto' }}>&times;</button>
                )}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                📅 {new Date(data.occurred_at).toLocaleString()}
            </div>

            <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>👥 Detecting Team</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {data.detectives && data.detectives.map((d, i) => (
                    <div key={i} title={`${d.rank} ${d.name}`} style={{ position: 'relative' }}>
                        <img src={d.avatar || '/anon.png'} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--accent-gold)' }} alt="" />
                    </div>
                ))}
            </div>

            {data.reason && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reason:</strong>
                    <div style={{ fontSize: '0.9rem' }}>{data.reason}</div>
                </div>
            )}

            {data.info_obtained && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Intel Obtained:</strong>
                    <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{data.info_obtained}</div>
                </div>
            )}

            {data.images && data.images.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {data.images.map((src, i) => (
                        <div key={i} onClick={() => onExpand(src)} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <img src={src} style={{ height: '60px', width: '60px', objectFit: 'cover' }} alt="" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Incidents;

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import IncidentCard from '../components/IncidentCard';
import OutingCard from '../components/OutingCard';
import '../index.css';

function Incidents() {
    const [incidents, setIncidents] = useState([]);
    const [outings, setOutings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [showEditIncidentModal, setShowEditIncidentModal] = useState(false);
    const [editingIncident, setEditingIncident] = useState(null);
    const [showOutingModal, setShowOutingModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);
    const [showEditOutingModal, setShowEditOutingModal] = useState(false);
    const [editingOuting, setEditingOuting] = useState(null);

    // Data for Selectors
    const [users, setUsers] = useState([]);
    const [gangs, setGangs] = useState([]); // List of gangs for selection

    // --- FORM STATE: INCIDENT ---
    const [incTitle, setIncTitle] = useState('');
    const [incLocation, setIncLocation] = useState('');
    const [incDate, setIncDate] = useState('');
    const [incTablet, setIncTablet] = useState('');
    const [incDesc, setIncDesc] = useState('');
    const [incGangIds, setIncGangIds] = useState([]); // Changed to array for multiple gangs
    const [incImages, setIncImages] = useState([]);

    // --- FORM STATE: OUTING ---
    const [outTitle, setOutTitle] = useState('');
    const [outDate, setOutDate] = useState('');
    const [outDetectives, setOutDetectives] = useState([]); // Array of IDs
    const [outReason, setOutReason] = useState('');
    const [outInfo, setOutInfo] = useState('');
    const [outGangIds, setOutGangIds] = useState([]); // Changed to array for multiple gangs
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
            // Format title with tablet number if present
            const finalTitle = incTablet ? `[${incTablet}] ${incTitle}` : incTitle;

            const { data: newId, error } = await supabase.rpc('create_incident_v2', {
                p_title: finalTitle,
                p_location: incLocation,
                p_occurred_at: new Date(incDate).toISOString(),
                p_tablet_number: incTablet,
                p_description: incDesc,
                p_images: incImages
            });
            if (error) throw error;

            // Link to multiple gangs
            if (incGangIds.length > 0) {
                for (const gangId of incGangIds) {
                    await supabase.rpc('link_incident_gang', { p_incident_id: newId, p_gang_id: gangId });
                }
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

            // Link to multiple gangs
            if (outGangIds.length > 0) {
                for (const gangId of outGangIds) {
                    await supabase.rpc('link_outing_gang', { p_outing_id: newId, p_gang_id: gangId });
                }
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

    // --- EDIT HANDLERS ---
    const handleEditIncident = async (incident) => {
        setEditingIncident(incident);

        let titleToEdit = incident.title;
        // If title starts with "[123] ", strip it for editing if it matches the tablet number
        if (incident.tablet_incident_number) {
            const prefix = `[${incident.tablet_incident_number}] `;
            if (titleToEdit.startsWith(prefix)) {
                titleToEdit = titleToEdit.substring(prefix.length);
            }
        }

        setIncTitle(titleToEdit);
        setIncLocation(incident.location || '');
        setIncDate(incident.occurred_at ? new Date(incident.occurred_at).toISOString().slice(0, 16) : '');
        setIncTablet(incident.tablet_incident_number || '');
        setIncDesc(incident.description || '');
        setIncImages(incident.images || []); // Load existing images

        // Load linked gangs
        const { data: linkedGangs, error } = await supabase.rpc('get_incident_gangs', { p_incident_id: incident.record_id });
        if (!error && linkedGangs) {
            setIncGangIds(linkedGangs.map(g => g.gang_id));
        } else {
            setIncGangIds([]);
        }

        setShowEditIncidentModal(true);
    };

    const handleUpdateIncident = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Format title with tablet number if present
            const finalTitle = incTablet ? `[${incTablet}] ${incTitle}` : incTitle;

            // Update incident details
            const { error: updateError } = await supabase.rpc('update_incident', {
                p_incident_id: editingIncident.record_id,
                p_title: finalTitle,
                p_location: incLocation,
                p_occurred_at: new Date(incDate).toISOString(),
                p_tablet_number: incTablet,
                p_description: incDesc,
                p_images: incImages // Pass updated images
            });
            if (updateError) throw updateError;

            // Get current gang links
            const { data: currentGangs } = await supabase.rpc('get_incident_gangs', { p_incident_id: editingIncident.record_id });
            const currentGangIds = currentGangs ? currentGangs.map(g => g.gang_id) : [];

            // Remove unselected gangs
            for (const gangId of currentGangIds) {
                if (!incGangIds.includes(gangId)) {
                    await supabase.rpc('unlink_incident_gang', { p_incident_id: editingIncident.record_id, p_gang_id: gangId });
                }
            }

            // Add newly selected gangs
            for (const gangId of incGangIds) {
                if (!currentGangIds.includes(gangId)) {
                    await supabase.rpc('link_incident_gang', { p_incident_id: editingIncident.record_id, p_gang_id: gangId });
                }
            }

            setShowEditIncidentModal(false);
            setEditingIncident(null);
            resetIncidentForm();
            loadData();
        } catch (err) {
            alert('Error updating incident: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditOuting = async (outing) => {
        setEditingOuting(outing);
        setOutTitle(outing.title);
        setOutDate(outing.occurred_at ? new Date(outing.occurred_at).toISOString().slice(0, 16) : '');
        setOutReason(outing.reason || '');
        setOutInfo(outing.info_obtained || '');
        setOutImages(outing.images || []);

        // Setup detectives
        // Note: outing.detectives now contains { id, name, rank, avatar } thanks to updated RPC
        if (outing.detectives && outing.detectives.length > 0) {
            setOutDetectives(outing.detectives.map(d => d.id).filter(id => id));
        } else {
            setOutDetectives([]);
        }

        // Setup Gangs - fetch linked
        const { data: linkedGangs, error } = await supabase.rpc('get_outing_gangs', { p_outing_id: outing.record_id });
        if (!error && linkedGangs) {
            setOutGangIds(linkedGangs.map(g => g.gang_id));
        } else {
            setOutGangIds([]);
        }

        setShowEditOutingModal(true);
    };

    const handleUpdateOuting = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error: updateError } = await supabase.rpc('update_outing', {
                p_outing_id: editingOuting.record_id,
                p_title: outTitle,
                p_occurred_at: new Date(outDate).toISOString(),
                p_reason: outReason,
                p_info_obtained: outInfo,
                p_images: outImages
            });
            if (updateError) throw updateError;

            // --- Update Gangs ---
            const { data: currentGangs } = await supabase.rpc('get_outing_gangs', { p_outing_id: editingOuting.record_id });
            const currentGangIds = currentGangs ? currentGangs.map(g => g.gang_id) : [];

            // Unlink
            for (const gangId of currentGangIds) {
                if (!outGangIds.includes(gangId)) {
                    await supabase.rpc('unlink_outing_gang', { p_outing_id: editingOuting.record_id, p_gang_id: gangId });
                }
            }
            // Link
            for (const gangId of outGangIds) {
                if (!currentGangIds.includes(gangId)) {
                    await supabase.rpc('link_outing_gang', { p_outing_id: editingOuting.record_id, p_gang_id: gangId });
                }
            }

            // --- Update Detectives ---
            // Fetch current detectives from RPC to be safe, or assume existing state is accurate enough for diffing if we haven't changed anything else.
            // Using get_outing_detectives RPC I added.
            const { data: currentDetectives } = await supabase.rpc('get_outing_detectives', { p_outing_id: editingOuting.record_id });
            // currentDetectives is array of objects { user_id }
            const currentDetIds = currentDetectives ? currentDetectives.map(d => d.user_id) : [];

            // Unlink removed
            for (const uid of currentDetIds) {
                if (!outDetectives.includes(uid)) {
                    await supabase.rpc('unlink_outing_detective', { p_outing_id: editingOuting.record_id, p_user_id: uid });
                }
            }
            // Link new
            for (const uid of outDetectives) {
                if (!currentDetIds.includes(uid)) {
                    await supabase.rpc('link_outing_detective', { p_outing_id: editingOuting.record_id, p_user_id: uid });
                }
            }

            setShowEditOutingModal(false);
            setEditingOuting(null);
            resetOutingForm();
            loadData();
        } catch (err) {
            alert('Error updating outing: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- HELPERS ---
    const resetIncidentForm = () => {
        setIncTitle(''); setIncLocation(''); setIncDate(''); setIncTablet(''); setIncDesc(''); setIncGangIds([]); setIncImages([]);
    };
    const resetOutingForm = () => {
        setOutTitle(''); setOutDate(''); setOutDetectives([]); setOutReason(''); setOutInfo(''); setOutGangIds([]); setOutImages([]);
    };

    const toggleGangIncident = (gangId) => {
        setIncGangIds(prev => prev.includes(gangId) ? prev.filter(id => id !== gangId) : [...prev, gangId]);
    };

    const toggleGangOuting = (gangId) => {
        setOutGangIds(prev => prev.includes(gangId) ? prev.filter(id => id !== gangId) : [...prev, gangId]);
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
                                        onEdit={handleEditIncident}
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
                                        onEdit={handleEditIncident}
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
                                        onEdit={handleEditOuting}
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
                                <label>Link to Syndicates (Optional)</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {gangs.map(g => (
                                        <div key={g.id} onClick={() => toggleGangIncident(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: incGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={incGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                        </div>
                                    ))}
                                </div>
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

            {/* --- MODAL: EDIT INCIDENT --- */}
            {showEditIncidentModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 className="section-title">Edit Incident</h3>
                        <form onSubmit={handleUpdateIncident}>
                            <div className="form-group"><label>Title</label><input className="form-input" required value={incTitle} onChange={e => setIncTitle(e.target.value)} /></div>
                            <div className="form-group">
                                <label>Link to Syndicates (Optional)</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {gangs.map(g => (
                                        <div key={g.id} onClick={() => toggleGangIncident(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: incGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={incGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group"><label>Date & Time</label><input type="datetime-local" className="form-input" required value={incDate} onChange={e => setIncDate(e.target.value)} /></div>
                            <div className="form-group"><label>Location (Optional)</label><input className="form-input" value={incLocation} onChange={e => setIncLocation(e.target.value)} /></div>
                            <div className="form-group"><label>Tablet Incident # (Optional)</label><input className="form-input" value={incTablet} onChange={e => setIncTablet(e.target.value)} /></div>
                            <div className="form-group"><label>Description (Optional)</label><textarea className="eval-textarea" rows="4" value={incDesc} onChange={e => setIncDesc(e.target.value)} /></div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Images (Optional)</label>
                                <label htmlFor="inc-edit-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    📷 Upload Images
                                </label>
                                <input
                                    id="inc-edit-upload"
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
                                <button type="button" className="login-button btn-secondary" onClick={() => { setShowEditIncidentModal(false); setEditingIncident(null); resetIncidentForm(); }} style={{ width: 'auto' }}>Cancel</button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : 'Update'}</button>
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
                                <label>Link to Syndicates (Optional)</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {gangs.map(g => (
                                        <div key={g.id} onClick={() => toggleGangOuting(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={outGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                        </div>
                                    ))}
                                </div>
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

            {/* --- MODAL: EDIT OUTING --- */}
            {showEditOutingModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 className="section-title" style={{ color: 'var(--accent-gold)' }}>Edit Outing</h3>
                        <form onSubmit={handleUpdateOuting}>
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
                                <label>Link to Syndicates (Optional)</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {gangs.map(g => (
                                        <div key={g.id} onClick={() => toggleGangOuting(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={outGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group"><label>Date & Time</label><input type="datetime-local" className="form-input" required value={outDate} onChange={e => setOutDate(e.target.value)} /></div>
                            <div className="form-group"><label>Reason</label><input className="form-input" value={outReason} onChange={e => setOutReason(e.target.value)} /></div>
                            <div className="form-group"><label>Information Obtained</label><textarea className="eval-textarea" rows="4" value={outInfo} onChange={e => setOutInfo(e.target.value)} /></div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Images (Optional)</label>
                                <label htmlFor="out-edit-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    📷 Upload Images
                                </label>
                                <input
                                    id="out-edit-upload"
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
                                <button type="button" className="login-button btn-secondary" onClick={() => { setShowEditOutingModal(false); setEditingOuting(null); resetOutingForm(); }} style={{ width: 'auto' }}>Cancel</button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : 'Update Outing'}</button>
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

export default Incidents;

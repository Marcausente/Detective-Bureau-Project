import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Gangs() {
    const [gangs, setGangs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [userRole, setUserRole] = useState(null);

    // --- VIEW STATE ---
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'

    // --- MODAL CONTROLS ---
    const [activeModal, setActiveModal] = useState(null); // 'createGang', 'vehicle', 'home', 'member', 'info'
    const [activeGangId, setActiveGangId] = useState(null); // Which gang is being edited
    const [editingItemId, setEditingItemId] = useState(null); // ID of the specific item being edited (vehicle, member, etc.)
    const [submitting, setSubmitting] = useState(false);

    // --- FORMS STATE ---
    // Gang
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#ffffff');
    const [zonesImage, setZonesImage] = useState(null);

    // Vehicle
    const [vehModel, setVehModel] = useState('');
    const [vehPlate, setVehPlate] = useState('');
    const [vehOwner, setVehOwner] = useState('');
    const [vehNotes, setVehNotes] = useState('');
    const [vehImages, setVehImages] = useState([]);

    // Home
    const [homeOwner, setHomeOwner] = useState('');
    const [homeNotes, setHomeNotes] = useState('');
    const [homeImages, setHomeImages] = useState([]);

    // Member
    const [memName, setMemName] = useState('');
    const [memRole, setMemRole] = useState('Sospechoso');
    const [memNotes, setMemNotes] = useState('');
    const [memPhoto, setMemPhoto] = useState(null);

    // Info
    const [infoType, setInfoType] = useState('info'); // info | characteristic
    const [infoContent, setInfoContent] = useState('');
    const [infoImages, setInfoImages] = useState([]);

    // --- IMAGE VIEWER STATE ---
    const [expandedImage, setExpandedImage] = useState(null);


    useEffect(() => {
        loadGangs();
        fetchUserRole();
    }, []);

    const fetchUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('rol').eq('id', user.id).single();
            if (data) setUserRole(data.rol);
        }
    };

    const isVIP = () => {
        if (!userRole) return false;
        const r = userRole.trim().toLowerCase();
        return ['coordinador', 'comisionado', 'administrador', 'admin'].includes(r);
    };

    const loadGangs = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_gangs_data');

        if (error) {
            console.error(error);
            if (error.message.includes("Access Denied") || error.code === 'P0001') {
                setAccessDenied(true);
            }
        } else if (data === null) {
            setAccessDenied(true);
        } else {
            setGangs(data || []);
        }
        setLoading(false);
    };

    const handleImageUpload = (e, setState, single = false) => {
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
                    const MAX_WIDTH = 800; // Good balance for detail vs size
                    const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
                    canvas.width = img.width * scaleSize;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // Compress to 0.6 quality for storage efficiency
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    if (single) setState(dataUrl);
                    else setState(prev => [...prev, dataUrl]);
                };
            };
        });
    };

    // --- ACTIONS ---

    const handleToggleArchive = async (id, currentStatus) => {
        if (!confirm(currentStatus ? "Re-open this syndicate file?" : "Archive this syndicate? Data will be preserved.")) return;
        try {
            const { error } = await supabase.rpc('toggle_gang_archive', { p_gang_id: id, p_archive: !currentStatus });
            if (error) throw error;
            loadGangs();
        } catch (err) { alert(err.message); }
    };

    const handleDeleteGang = async (id) => {
        if (!confirm("⚠️ DANGER: This will permanently delete the gang and ALL associated data (vehicles, members, etc). This cannot be undone.\n\nAre you sure?")) return;
        try {
            const { error } = await supabase.rpc('delete_gang_fully', { p_gang_id: id });
            if (error) throw error;
            loadGangs();
        } catch (err) { alert(err.message); }
    };

    const handleDeleteItem = async (type, id) => {
        if (!confirm("Delete this item permanently?")) return;
        try {
            const { error } = await supabase.rpc('delete_gang_item', { p_table: type, p_id: id });
            if (error) throw error;
            loadGangs();
        } catch (err) { alert(err.message); }
    };

    const handleEditItem = (type, gangId, item) => {
        setActiveGangId(gangId);
        setEditingItemId(item.id);
        setActiveModal(type);

        // Populate inputs based on type
        if (type === 'vehicle') {
            setVehModel(item.model); setVehPlate(item.plate); setVehOwner(item.owner); setVehNotes(item.notes); setVehImages(item.images || []);
        } else if (type === 'home') {
            setHomeOwner(item.owner); setHomeNotes(item.notes); setHomeImages(item.images || []);
        } else if (type === 'member') {
            setMemName(item.name); setMemRole(item.role); setMemNotes(item.notes); setMemPhoto(item.photo);
        } else if (type === 'info') {
            setInfoType(item.type); setInfoContent(item.content); setInfoImages(item.images || []);
        }
    };

    // --- SUBMISSION HANDLERS ---

    const handleCreateGang = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_gang', { p_name: newName, p_color: newColor, p_zones_image: zonesImage });
            if (error) throw error;
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingItemId) {
                const { error } = await supabase.rpc('update_gang_vehicle', {
                    p_vehicle_id: editingItemId, p_model: vehModel, p_plate: vehPlate, p_owner: vehOwner, p_notes: vehNotes, p_images: vehImages
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('add_gang_vehicle', {
                    p_gang_id: activeGangId, p_model: vehModel, p_plate: vehPlate, p_owner: vehOwner, p_notes: vehNotes, p_images: vehImages
                });
                if (error) throw error;
            }
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddHome = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingItemId) {
                const { error } = await supabase.rpc('update_gang_home', {
                    p_home_id: editingItemId, p_owner: homeOwner, p_notes: homeNotes, p_images: homeImages
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('add_gang_home', {
                    p_gang_id: activeGangId, p_owner: homeOwner, p_notes: homeNotes, p_images: homeImages
                });
                if (error) throw error;
            }
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingItemId) {
                const { error } = await supabase.rpc('update_gang_member', {
                    p_member_id: editingItemId, p_name: memName, p_role: memRole, p_photo: memPhoto, p_notes: memNotes
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('add_gang_member', {
                    p_gang_id: activeGangId, p_name: memName, p_role: memRole, p_photo: memPhoto, p_notes: memNotes
                });
                if (error) throw error;
            }
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleAddInfo = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingItemId) {
                const { error } = await supabase.rpc('update_gang_info', {
                    p_info_id: editingItemId, p_type: infoType, p_content: infoContent, p_images: infoImages
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('add_gang_info', {
                    p_gang_id: activeGangId, p_type: infoType, p_content: infoContent, p_images: infoImages
                });
                if (error) throw error;
            }
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    const handleUpdateZone = async (e) => {
        e.preventDefault();
        if (!zonesImage) { alert("Please upload a map image."); return; }
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('update_gang_zone', {
                p_gang_id: activeGangId, p_image: zonesImage
            });
            if (error) throw error;
            closeModal();
            loadGangs();
        } catch (err) { alert(err.message); } finally { setSubmitting(false); }
    };

    // --- HELPER HANDLERS ---
    const openModal = (type, gangId) => {
        setActiveModal(type);
        setActiveGangId(gangId);
        if (type === 'updateZone') {
            // Find current gang and set existing image if any
            const gang = gangs.find(g => g.gang_id === gangId);
            if (gang) setZonesImage(gang.zones_image);
        }
    };

    const closeModal = () => {
        setActiveModal(null);
        setActiveGangId(null);
        setEditingItemId(null);
        // Reset forms
        setNewName(''); setNewColor('#ffffff'); setZonesImage(null);
        setVehModel(''); setVehPlate(''); setVehOwner(''); setVehNotes(''); setVehImages([]);
        setHomeOwner(''); setHomeNotes(''); setHomeImages([]);
        setMemName(''); setMemRole('Sospechoso'); setMemNotes(''); setMemPhoto(null);
        setInfoType('info'); setInfoContent(''); setInfoImages([]);
    };


    if (loading) return <div className="loading-container">Loading Intel...</div>;

    if (accessDenied) {
        return (
            <div className="documentation-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h1 style={{ color: 'red', fontSize: '3rem' }}>ACCESS DENIED</h1>
                <p>This intelligence database is restricted to Detectives and above.</p>
            </div>
        );
    }

    const filteredGangs = gangs.filter(g => viewMode === 'active' ? !g.is_archived : g.is_archived);

    return (
        <div id="gangs-page" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
            {/* Header */}
            {/* Header */}
            <div className="doc-header" style={{ padding: '1rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                    <h2 className="header-title" style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Gang Intelligence Unit</h2>
                    <div className="gangs-tabs">
                        <button className={`gang-tab-btn ${viewMode === 'active' ? 'active' : ''}`} onClick={() => setViewMode('active')}>Active Operation</button>
                        <button className={`gang-tab-btn ${viewMode === 'archived' ? 'active' : ''}`} onClick={() => setViewMode('archived')}>Archive</button>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* DEBUG ROLE */}
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px' }}>Role: {userRole || 'Loading...'}</span>

                    {viewMode === 'active' && <button className="login-button" style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} onClick={() => openModal('createGang', null)}>+ Track New Syndicate</button>}
                </div>
            </div>

            {/* Horizontal Scroll Container */}
            <div className="gang-scroll-container">
                {filteredGangs.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.6 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                        <div>No {viewMode} syndicates files found.</div>
                    </div>
                ) : (
                    filteredGangs.map(gang => (
                        <GangColumn
                            key={gang.gang_id}
                            gang={gang}
                            onAdd={openModal}
                            isVIP={isVIP()}
                            onArchive={() => handleToggleArchive(gang.gang_id, gang.is_archived)}
                            onDelete={() => handleDeleteGang(gang.gang_id)}
                            onViewImage={setExpandedImage}
                            onEdit={handleEditItem}
                            onDeleteSubItem={handleDeleteItem}
                        />
                    ))
                )}
            </div>

            {/* --- MODALS --- */}

            {/* Create Gang */}
            {activeModal === 'createGang' && (
                <Modal title="Track New Syndicate" onClose={closeModal} onSubmit={handleCreateGang} submitting={submitting}>
                    <Input label="Syndicate Name" value={newName} onChange={e => setNewName(e.target.value)} required />
                    <ColorPicker label="Color Identifier" value={newColor} onChange={e => setNewColor(e.target.value)} />
                    <ImageUpload label="Controlled Zones (Map)" image={zonesImage} onUpload={e => handleImageUpload(e, setZonesImage, true)} single />
                </Modal>
            )}

            {/* Update Zone Map */}
            {activeModal === 'updateZone' && (
                <Modal title="Update Controlled Zones" onClose={closeModal} onSubmit={handleUpdateZone} submitting={submitting}>
                    <ImageUpload label="New Map Image" image={zonesImage} onUpload={e => handleImageUpload(e, setZonesImage, true)} single />
                </Modal>
            )}

            {/* Add/Edit Vehicle */}
            {activeModal === 'vehicle' && (
                <Modal title={editingItemId ? "Edit Vehicle" : "Add Vehicle Intelligence"} onClose={closeModal} onSubmit={handleAddVehicle} submitting={submitting}>
                    <Input label="Model" value={vehModel} onChange={e => setVehModel(e.target.value)} />
                    <Input label="Plate" value={vehPlate} onChange={e => setVehPlate(e.target.value)} />
                    <Input label="Registered Owner" value={vehOwner} onChange={e => setVehOwner(e.target.value)} />
                    <TextArea label="Notes" value={vehNotes} onChange={e => setVehNotes(e.target.value)} />
                    <MultiImageUpload images={vehImages} setImages={setVehImages} onUpload={e => handleImageUpload(e, setVehImages)} />
                </Modal>
            )}

            {/* Add/Edit Home */}
            {activeModal === 'home' && (
                <Modal title={editingItemId ? "Edit Property" : "Add Property Intelligence"} onClose={closeModal} onSubmit={handleAddHome} submitting={submitting}>
                    <Input label="Registered Owner / Occupant" value={homeOwner} onChange={e => setHomeOwner(e.target.value)} />
                    <TextArea label="Address & Notes" value={homeNotes} onChange={e => setHomeNotes(e.target.value)} />
                    <MultiImageUpload images={homeImages} setImages={setHomeImages} onUpload={e => handleImageUpload(e, setHomeImages)} />
                </Modal>
            )}

            {/* Add/Edit Member */}
            {activeModal === 'member' && (
                <Modal title={editingItemId ? "Edit Member" : "Identify Member"} onClose={closeModal} onSubmit={handleAddMember} submitting={submitting}>
                    <Input label="Full Name / Alias" value={memName} onChange={e => setMemName(e.target.value)} required />
                    <div className="form-group">
                        <label>Role / Hierarchy</label>
                        <select className="form-input" value={memRole} onChange={e => setMemRole(e.target.value)}>
                            <option value="Lider">Líder (Boss)</option>
                            <option value="Sublider">Sublíder (Underboss)</option>
                            <option value="Miembro">Miembro (Soldier)</option>
                            <option value="Sospechoso">Sospechoso (Associate)</option>
                        </select>
                    </div>
                    <TextArea label="Notes" value={memNotes} onChange={e => setMemNotes(e.target.value)} />
                    <ImageUpload label="Mugshot / Photo" image={memPhoto} onUpload={e => handleImageUpload(e, setMemPhoto, true)} single />
                </Modal>
            )}

            {/* Add/Edit Info */}
            {activeModal === 'info' && (
                <Modal title={editingItemId ? "Edit Intel" : "Add Intelligence"} onClose={closeModal} onSubmit={handleAddInfo} submitting={submitting}>
                    <div className="form-group">
                        <label>Entry Type</label>
                        <select className="form-input" value={infoType} onChange={e => setInfoType(e.target.value)}>
                            <option value="info">General Info</option>
                            <option value="characteristic">Defining Characteristic</option>
                        </select>
                    </div>
                    <TextArea label="Content" value={infoContent} onChange={e => setInfoContent(e.target.value)} required />
                    <MultiImageUpload images={infoImages} setImages={setInfoImages} onUpload={e => handleImageUpload(e, setInfoImages)} />
                </Modal>
            )}

            {/* Image Viewer */}
            {expandedImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setExpandedImage(null)}>
                    <img src={expandedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} alt="Enlarged Evidence" />
                </div>
            )}

        </div>
    );
}

// --- SUB-COMPONENTS ---

function GangColumn({ gang, onAdd, isVIP, onArchive, onDelete, onViewImage, onEdit, onDeleteSubItem }) {
    // Helper for buttons
    const ActionButtons = ({ type, item }) => (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
            <button onClick={() => onEdit(type, gang.gang_id, item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }}>✏️</button>
            <button onClick={() => onDeleteSubItem(type, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }}>🗑️</button>
        </div>
    );
    return (
        <div className="gang-column">

            {/* Header Card */}
            <div className="gang-header-card" style={{ borderTop: `4px solid ${gang.color}` }}>
                <div className="gang-header-top">
                    <h3 className="gang-title" style={{ color: gang.color }}>{gang.name}</h3>
                    {isVIP && (
                        <div className="gang-actions">
                            <button className="gang-action-btn" onClick={onArchive} title={gang.is_archived ? "Re-open" : "Archive"}>
                                {gang.is_archived ? '📂' : '🔒'}
                            </button>
                            <button className="gang-action-btn" onClick={onDelete} title="Delete Permanently" style={{ color: '#ef4444' }}>
                                🗑️
                            </button>
                        </div>
                    )}
                </div>
                <div className="gang-image-container" style={{ position: 'relative' }}>
                    {/* Edit Button for Map */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onAdd('updateZone', gang.gang_id); }}
                        style={{
                            position: 'absolute', top: 10, right: 10, zIndex: 10,
                            background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                            borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem'
                        }}
                    >
                        ✏️ Edit Map
                    </button>

                    <div onClick={() => gang.zones_image && onViewImage(gang.zones_image)} style={{ width: '100%', height: '100%', cursor: gang.zones_image ? 'pointer' : 'default' }}>
                        {gang.zones_image ? (
                            <img src={gang.zones_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Zones" />
                        ) : (
                            <div className="gang-image-empty">
                                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</span>
                                <span>No Zone Data</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="gang-stat-grid">
                <StatBox label="Incidents" count={gang.incident_count} />
                <StatBox label="Outings" count={gang.outing_count} />
            </div>

            {/* Intel Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title">📝 Intel & Characteristics</span>
                    <button className="gang-add-btn" onClick={() => onAdd('info', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {gang.info && gang.info.map(i => (
                        <div key={i.id} style={{
                            fontSize: '0.85rem', marginBottom: '0.8rem',
                            borderLeft: `3px solid ${i.type === 'characteristic' ? 'var(--accent-gold)' : '#64748b'}`,
                            paddingLeft: '0.8rem', color: '#cbd5e1', position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, marginRight: '10px' }}>{i.content}</div>
                                <ActionButtons type="info" item={i} />
                            </div>
                            {i.images && i.images.length > 0 && (
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    {i.images.map((img, idx) => (
                                        <img key={idx} src={img} onClick={() => onViewImage(img)} style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} alt="Intel" />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {(!gang.info || gang.info.length === 0) && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>No intel gathered.</div>}
                </div>
            </div>

            {/* Vehicles Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title">🚗 Fleet ({gang.vehicles.length})</span>
                    <button className="gang-add-btn" onClick={() => onAdd('vehicle', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {gang.vehicles.map(v => (
                        <div key={v.id} className="gang-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: '3px solid #3b82f6', paddingLeft: '0.8rem' }}>
                            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{v.model}</span>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--accent-gold)', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>[{v.plate}]</span>
                                    <ActionButtons type="vehicle" item={v} />
                                </div>
                            </div>
                            {v.owner && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>Owner: {v.owner}</div>}
                            {v.notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '5px', fontStyle: 'italic' }}>{v.notes}</div>}
                            {/* Vehicle Images */}
                            {v.images && v.images.length > 0 && (
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    {v.images.map((img, idx) => (
                                        <img key={idx} src={img} onClick={() => onViewImage(img)} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} alt="Car" />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {gang.vehicles.length === 0 && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>No known vehicles.</div>}
                </div>
            </div>

            {/* Homes Section */}
            <div className="gang-section-card">
                <div className="gang-section-header">
                    <span className="gang-section-title">🏠 Properties ({gang.homes.length})</span>
                    <button className="gang-add-btn" onClick={() => onAdd('home', gang.gang_id)}>+</button>
                </div>
                <div className="gang-list-content">
                    {gang.homes.map(h => (
                        <div key={h.id} className="gang-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: '3px solid #10b981', paddingLeft: '0.8rem' }}>
                            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                                <span>{h.owner}</span>
                                <ActionButtons type="home" item={h} />
                            </div>
                            {h.notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '5px', fontStyle: 'italic' }}>{h.notes}</div>}
                            {/* Home Images */}
                            {h.images && h.images.length > 0 && (
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    {h.images.map((img, idx) => (
                                        <img key={idx} src={img} onClick={() => onViewImage(img)} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #444' }} alt="Home" />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {gang.homes.length === 0 && <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>No known properties.</div>}
                </div>
            </div>

            {/* Members Section */}
            <div className="gang-section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="gang-section-header">
                    <span className="gang-section-title">👥 Known Affiliates ({gang.members.length})</span>
                    <button className="gang-add-btn" onClick={() => onAdd('member', gang.gang_id)}>+</button>
                </div>
                <div className="gang-member-grid">
                    {gang.members.map(m => (
                        <div key={m.id} className="gang-member-item">
                            <img
                                src={m.photo || '/anon.png'}
                                className="gang-member-photo"
                                style={{ border: `2px solid ${getStatusColor(m.role)}`, cursor: 'pointer' }}
                                onClick={() => m.photo && onViewImage(m.photo)}
                                alt=""
                            />
                            <div style={{ fontSize: '0.75rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{m.role}</div>
                            {m.notes && <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '3px', fontStyle: 'italic', textAlign: 'center' }} title={m.notes}>📋</div>}
                            <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                                <button onClick={() => onEdit('member', gang.gang_id, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}>✏️</button>
                                <button onClick={() => onDeleteSubItem('member', m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}>🗑️</button>
                            </div>
                        </div>
                    ))}
                    {gang.members.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem', padding: '1rem' }}>No known members.</div>}
                </div>
            </div>

            {/* Expanded Image Modal */}

        </div>
    );
}

// --- FORM COMPONENTS ---

function ColorPicker({ label, value, onChange }) {
    return (
        <div className="form-group">
            <label>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    position: 'relative',
                    width: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    backgroundColor: value,
                    border: '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    <input
                        type="color"
                        value={value}
                        onChange={onChange}
                        style={{
                            opacity: 0,
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'pointer'
                        }}
                    />
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={onChange}
                    className="form-input"
                    style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '1px' }}
                    placeholder="#RRGGBB"
                />
            </div>
        </div>
    );
}

function Modal({ title, onClose, onSubmit, submitting, children }) {
    return (
        <div className="cropper-modal-overlay">
            <div className="cropper-modal-content" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 className="section-title" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>{title}</h3>
                <form onSubmit={onSubmit}>
                    {children}
                    <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
                        <button type="button" className="login-button btn-secondary" onClick={onClose} style={{ width: 'auto' }}>Cancel</button>
                        <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Input({ label, ...props }) {
    return (
        <div className="form-group">
            <label>{label}</label>
            <input className="form-input" {...props} />
        </div>
    );
}

function TextArea({ label, ...props }) {
    return (
        <div className="form-group">
            <label>{label}</label>
            <textarea className="eval-textarea" rows="3" {...props} />
        </div>
    );
}

function ImageUpload({ label, onUpload, image, single }) {
    return (
        <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>{label}</label>
            <label className="login-button btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', height: '50px', borderStyle: 'dashed' }}>
                📷 Upload Image
                <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
            </label>
            {image && <img src={image} style={{ marginTop: '10px', width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} alt="" />}
        </div>
    );
}

function MultiImageUpload({ images, setImages, onUpload }) {
    return (
        <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Images (Optional)</label>
            <label className="login-button btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', height: '50px', borderStyle: 'dashed' }}>
                📷 Upload Images
                <input type="file" multiple accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {images.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                        <img src={src} style={{ height: '70px', borderRadius: '4px', border: '1px solid #444' }} alt="" />
                        <button
                            type="button"
                            onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatBox({ label, count }) {
    return (
        <div className="gang-stat-box">
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>{count || 0}</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>{label}</div>
        </div>
    );
}

function getStatusColor(role) {
    if (role === 'Lider') return '#ef4444';
    if (role === 'Sublider') return '#f97316';
    if (role === 'Miembro') return '#eab308';
    return '#94a3b8';
}

export default Gangs;

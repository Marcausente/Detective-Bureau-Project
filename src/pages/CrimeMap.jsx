import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import GTAVMap from '../assets/GTAV-HD-MAP-satellite.jpg';
import '../doc_styles.css';

// Fix icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function CrimeMap() {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);
    const drawingLayerRef = useRef(null);

    // State
    const [zones, setZones] = useState([]);
    const [authorized, setAuthorized] = useState(false);
    const [mode, setMode] = useState('view'); // 'view', 'draw'
    const [drawingPoints, setDrawingPoints] = useState([]);

    // Form State
    const [tempZoneData, setTempZoneData] = useState({ name: '', description: '', color: '#ef4444' });
    const [showModal, setShowModal] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState(null); // ID if editing, null if creating

    // Dropdown Data
    const [gangs, setGangs] = useState([]);
    const [cases, setCases] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [selectedGang, setSelectedGang] = useState('');
    const [selectedCase, setSelectedCase] = useState('');
    const [selectedIncident, setSelectedIncident] = useState('');

    // Refs for closure access
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    const drawingPointsRef = useRef(drawingPoints);
    useEffect(() => { drawingPointsRef.current = drawingPoints; }, [drawingPoints]);

    // We need to access handleEditZone inside the popup click handler
    // Since popup HTML strings are not React components, we attach a global or custom event listener,
    // or we render the popup using ReactDOM (complex with Leaflet),
    // OR simplest: Assign a function to the window object (hacky but works for vanilla JS popups).
    // Better approach: Use event delegation on the map container for the 'edit-btn' class.

    useEffect(() => {
        checkAuth();
        fetchZones();
        fetchDropdownData();
    }, []);

    useEffect(() => {
        if (!mapInstanceRef.current && mapContainerRef.current) {
            // MAP CONFIGURATION
            const bounds = [[0, 0], [8192, 8192]];

            const map = L.map(mapContainerRef.current, {
                crs: L.CRS.Simple,
                minZoom: -3,
                maxZoom: 2,
                zoom: -1,
                center: [4096, 4096],
                zoomControl: false,
                attributionControl: false,
                maxBounds: bounds,
                maxBoundsViscosity: 1.0,
                bounceAtZoomLimits: false
            });

            mapContainerRef.current.style.background = '#0f172a';

            L.imageOverlay(GTAVMap, bounds).addTo(map);
            map.fitBounds(bounds);

            layerGroupRef.current = L.layerGroup().addTo(map);
            drawingLayerRef.current = L.layerGroup().addTo(map);

            map.on('click', (e) => {
                if (modeRef.current === 'draw') {
                    const newPoint = [e.latlng.lat, e.latlng.lng];
                    setDrawingPoints(prev => [...prev, newPoint]);
                }
            });

            map.on('contextmenu', (e) => {
                if (modeRef.current === 'draw') {
                    e.originalEvent.preventDefault();
                    setDrawingPoints(prev => prev.slice(0, -1));
                }
            });

            // Event delegation for popup buttons
            const container = map.getContainer();
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-zone-btn')) {
                    const id = e.target.getAttribute('data-id');
                    handleDeleteZone(id);
                }
                if (e.target.classList.contains('edit-zone-btn')) {
                    const id = e.target.getAttribute('data-id');
                    // We need to find the zone data. 
                    // Since specific zone data isn't easily passed via HTML attribute, 
                    // we'll trigger a custom event or look it up in state.
                    // Accessing 'zones' state here directly might be stale if not careful, 
                    // but we can use a custom event dispatch to the component.
                    const event = new CustomEvent('edit-zone-click', { detail: { id } });
                    window.dispatchEvent(event);
                }
            });

            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Listen for the custom event to handle edit with fresh state
    useEffect(() => {
        const handleEditEvent = (e) => {
            const id = e.detail.id;
            const zoneToEdit = zones.find(z => z.id === id);
            if (zoneToEdit) {
                prepareEdit(zoneToEdit);
            }
        };
        window.addEventListener('edit-zone-click', handleEditEvent);
        return () => window.removeEventListener('edit-zone-click', handleEditEvent);
    }, [zones]); // Re-bind when zones change so we have fresh data


    // --- DATA FETCHING ---
    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.rpc('auth_is_gang_authorized');
            if (data) setAuthorized(true);
        }
    };

    const fetchZones = async () => {
        const { data } = await supabase.rpc('get_map_zones');
        setZones(data || []);
    };

    const fetchDropdownData = async () => {
        const { data: g } = await supabase.rpc('get_gangs_data');
        if (g) setGangs(g);
        const { data: c } = await supabase.rpc('get_cases');
        if (c) setCases(c);
        const { data: i } = await supabase.rpc('get_incidents_v2');
        if (i) setIncidents(i);
    };


    // --- RENDERING MAP LAYERS ---
    useEffect(() => {
        if (mapInstanceRef.current && layerGroupRef.current) {
            layerGroupRef.current.clearLayers();

            zones.forEach(zone => {
                const poly = L.polygon(zone.coordinates, {
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: 0.35,
                    weight: 2
                });

                let popupHTML = `
                    <h3 style="margin: 0 0 5px 0; color: #cfb53b; text-transform: uppercase;">${zone.name}</h3>
                    <p style="margin: 0 0 10px 0; color: #ccc; font-size: 0.9em;">${zone.description || ''}</p>
                    ${zone.gang_name ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">Gang:</strong> ${zone.gang_name}</div>` : ''}
                    ${zone.case_title ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">Case:</strong> ${authorized ? zone.case_title : '<span style="color: #ef4444; font-weight: bold;">SIN ACCESO</span>'}</div>` : ''}
                    ${zone.incident_title ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">Incident:</strong> ${zone.incident_title}</div>` : ''}
                `;

                if (authorized) {
                    popupHTML += `
                        <div style="display: flex; gap: 5px; margin-top: 10px;">
                            <button class="edit-zone-btn" data-id="${zone.id}" style="
                                flex: 1;
                                background: #3b82f6; 
                                color: white; 
                                border: none; 
                                padding: 6px; 
                                cursor: pointer; 
                                border-radius: 4px;
                                font-size: 0.75rem;
                                font-weight: 600;
                                text-transform: uppercase;
                            ">EDIT</button>
                            <button class="delete-zone-btn" data-id="${zone.id}" style="
                                flex: 1;
                                background: #ef4444; 
                                color: white; 
                                border: none; 
                                padding: 6px; 
                                cursor: pointer; 
                                border-radius: 4px;
                                font-size: 0.75rem;
                                font-weight: 600;
                                text-transform: uppercase;
                            ">DELETE</button>
                        </div>
                    `;
                }

                poly.bindPopup(popupHTML, {
                    className: 'custom-popup-dark'
                });

                poly.on('mouseover', function () { this.setStyle({ fillOpacity: 0.6, weight: 3 }); });
                poly.on('mouseout', function () { this.setStyle({ fillOpacity: 0.35, weight: 2 }); });

                poly.addTo(layerGroupRef.current);
            });
        }
    }, [zones, authorized]);

    // --- DRAWING PREVIEW ---
    useEffect(() => {
        if (mapInstanceRef.current && drawingLayerRef.current) {
            drawingLayerRef.current.clearLayers();

            if (mode === 'draw' && drawingPoints.length > 0) {
                drawingPoints.forEach(pt => {
                    L.circleMarker(pt, { color: '#cfb53b', radius: 4, fillOpacity: 1 }).addTo(drawingLayerRef.current);
                });

                if (drawingPoints.length > 1) {
                    L.polyline(drawingPoints, { color: '#cfb53b', dashArray: '5, 10', weight: 2 }).addTo(drawingLayerRef.current);
                }

                if (drawingPoints.length > 2) {
                    L.polyline([drawingPoints[drawingPoints.length - 1], drawingPoints[0]], { color: '#cfb53b', dashArray: '5, 10', opacity: 0.5, weight: 2 }).addTo(drawingLayerRef.current);
                }
            }
        }
    }, [drawingPoints, mode]);


    // --- HANDLERS ---
    const handleDeleteZone = async (id) => {
        if (!confirm('Are you sure you want to delete this zone?')) return;
        const { error } = await supabase.rpc('delete_map_zone', { p_id: id });
        if (error) alert('Error: ' + error.message);
        else fetchZones();
    };

    const prepareEdit = (zone) => {
        setTempZoneData({
            name: zone.name,
            description: zone.description || '',
            color: zone.color || '#ef4444'
        });
        setSelectedGang(zone.gang_id || '');
        setSelectedCase(zone.case_id || '');
        setSelectedIncident(zone.incident_id || '');
        setEditingZoneId(zone.id);
        setShowModal(true);
    };

    const handleFinishDraw = () => {
        if (drawingPoints.length < 3) return alert("Zone must have at least 3 points");
        setEditingZoneId(null); // Ensure we are creating
        setTempZoneData({ name: '', description: '', color: '#ef4444' });
        setSelectedGang('');
        setSelectedCase('');
        setSelectedIncident('');
        setShowModal(true);
    };

    const handleSaveZone = async () => {
        if (!tempZoneData.name) return alert("Name is required");

        let error;

        if (editingZoneId) {
            // UPDATE EXISTING
            const payload = {
                p_id: editingZoneId,
                p_name: tempZoneData.name,
                p_description: tempZoneData.description,
                p_gang_id: selectedGang || null,
                p_case_id: selectedCase || null,
                p_incident_id: selectedIncident || null,
                p_color: tempZoneData.color
            };
            const res = await supabase.rpc('update_map_zone', payload);
            error = res.error;
        } else {
            // CREATE NEW
            const payload = {
                p_name: tempZoneData.name,
                p_description: tempZoneData.description,
                p_coordinates: drawingPoints,
                p_type: 'polygon',
                p_gang_id: selectedGang || null,
                p_case_id: selectedCase || null,
                p_incident_id: selectedIncident || null,
                p_color: tempZoneData.color
            };
            const res = await supabase.rpc('create_map_zone', payload);
            error = res.error;
        }

        if (error) {
            alert('Error: ' + error.message);
        } else {
            fetchZones();
            setMode('view');
            setDrawingPoints([]);
            setShowModal(false);
            setEditingZoneId(null);
            setTempZoneData({ name: '', description: '', color: '#ef4444' });
            setSelectedGang('');
            setSelectedCase('');
            setSelectedIncident('');
        }
    };


    // --- STYLES ---
    const toolbarStyle = {
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(10px)',
        padding: '15px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        minWidth: '250px'
    };

    const floatingActionStyle = {
        padding: '10px 15px',
        background: 'linear-gradient(45deg, #1e293b, #0f172a)',
        border: '1px solid rgba(207, 181, 59, 0.3)',
        color: '#cfb53b',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        textTransform: 'uppercase',
        fontSize: '0.8rem',
        letterSpacing: '1px',
        transition: 'all 0.2s',
        textAlign: 'center'
    };

    return (
        <div style={{ position: 'relative', height: 'calc(100vh - 140px)', width: '100%', overflow: 'hidden', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>

            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', outline: 'none' }} />

            <div style={toolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#cfb53b', borderRadius: '50%', boxShadow: '0 0 10px #cfb53b' }}></div>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', letterSpacing: '1px' }}>CRIME MAP</h3>
                </div>

                {authorized ? (
                    mode === 'view' ? (
                        <button
                            onClick={() => setMode('draw')}
                            style={floatingActionStyle}
                            onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 15px rgba(207, 181, 59, 0.3)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            + New Restricted Zone
                        </button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                Click map to place points.<br />Right-click to undo.
                            </div>
                            <button
                                onClick={handleFinishDraw}
                                style={{ ...floatingActionStyle, background: '#cfb53b', color: '#000', borderColor: '#cfb53b' }}
                                disabled={drawingPoints.length < 3}
                            >
                                Finish & Save
                            </button>
                            <button
                                onClick={() => { setMode('view'); setDrawingPoints([]); }}
                                style={{ ...floatingActionStyle, borderColor: '#ef4444', color: '#ef4444' }}
                            >
                                Cancel
                            </button>
                        </div>
                    )
                ) : (
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        View Access Only
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div className="login-card" style={{ maxWidth: '450px', animation: 'zoomIn 0.3s ease' }}>
                        <h2 style={{ textAlign: 'center', color: '#cfb53b', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                            {editingZoneId ? 'Edit Zone' : 'Define New Zone'}
                        </h2>

                        <div className="form-group">
                            <label className="form-label">Zone Name</label>
                            <input
                                className="form-input"
                                value={tempZoneData.name}
                                onChange={e => setTempZoneData({ ...tempZoneData, name: e.target.value })}
                                placeholder="Designation..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description / Intel</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                value={tempZoneData.description}
                                onChange={e => setTempZoneData({ ...tempZoneData, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                                <label className="form-label">Zone Color</label>
                                <input
                                    type="color"
                                    className="form-input"
                                    style={{ height: '45px', padding: '5px' }}
                                    value={tempZoneData.color}
                                    onChange={e => setTempZoneData({ ...tempZoneData, color: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Linked Gang</label>
                                <select
                                    className="form-input"
                                    value={selectedGang}
                                    onChange={e => setSelectedGang(e.target.value)}
                                >
                                    <option value="">-- None --</option>
                                    {gangs.map(g => <option key={g.gang_id} value={g.gang_id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Linked Case</label>
                            <select
                                className="form-input"
                                value={selectedCase}
                                onChange={e => setSelectedCase(e.target.value)}
                            >
                                <option value="">-- None --</option>
                                {cases.map(c => <option key={c.id} value={c.id}>#{c.case_number} - {c.title}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Linked Incident</label>
                            <select
                                className="form-input"
                                value={selectedIncident}
                                onChange={e => setSelectedIncident(e.target.value)}
                            >
                                <option value="">-- None --</option>
                                {incidents.map(i => <option key={i.record_id} value={i.record_id}>{i.tablet_incident_number ? `[${i.tablet_incident_number}] ` : ''}{i.title}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                            <button
                                onClick={handleSaveZone}
                                className="login-button"
                                style={{ flex: 1, color: '#000', background: '#cfb53b' }}
                            >
                                {editingZoneId ? 'Update' : 'Save'}
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="login-button"
                                style={{ flex: 1, background: 'transparent', color: '#94a3b8' }}
                            >
                                Cancel
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

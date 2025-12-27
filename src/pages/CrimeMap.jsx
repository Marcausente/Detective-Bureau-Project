import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import GTAVMap from '../assets/GTAV-HD-MAP-satellite.jpg';
import '../doc_styles.css'; // Ensure we have access to common styles

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
    const [tempZoneData, setTempZoneData] = useState({ name: '', description: '', color: '#ef4444' });
    const [showModal, setShowModal] = useState(false);

    // Dropdown Data
    const [gangs, setGangs] = useState([]);
    const [cases, setCases] = useState([]);
    const [selectedGang, setSelectedGang] = useState('');
    const [selectedCase, setSelectedCase] = useState('');

    // Refs for closure access
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    const drawingPointsRef = useRef(drawingPoints);
    useEffect(() => { drawingPointsRef.current = drawingPoints; }, [drawingPoints]);

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
                zoomControl: false, // Custom placement if needed
                attributionControl: false,
                maxBounds: bounds,
                maxBoundsViscosity: 1.0, // Strict bounds
                bounceAtZoomLimits: false
            });

            // Dark background for container
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

            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

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

                const popupContent = document.createElement('div');
                popupContent.className = 'map-popup-content';
                popupContent.innerHTML = `
                    <h3 style="margin: 0 0 5px 0; color: #cfb53b; text-transform: uppercase;">${zone.name}</h3>
                    <p style="margin: 0 0 10px 0; color: #ccc; font-size: 0.9em;">${zone.description || ''}</p>
                    ${zone.gang_name ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">Gang:</strong> ${authorized ? zone.gang_name : '<span style="color: #ef4444; font-weight: bold;">SIN ACCESO</span>'}</div>` : ''}
                    ${zone.case_title ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">Case:</strong> ${authorized ? zone.case_title : '<span style="color: #ef4444; font-weight: bold;">SIN ACCESO</span>'}</div>` : ''}
                `;

                if (authorized) {
                    const btn = document.createElement('button');
                    btn.innerText = 'DELETE ZONE';
                    btn.style.cssText = `
                        background: #ef4444; 
                        color: white; 
                        border: none; 
                        padding: 6px 12px; 
                        margin-top: 10px; 
                        cursor: pointer; 
                        border-radius: 4px;
                        font-size: 0.75rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        width: 100%;
                    `;
                    btn.onclick = () => handleDeleteZone(zone.id);
                    popupContent.appendChild(btn);
                }

                poly.bindPopup(popupContent, {
                    className: 'custom-popup-dark'
                });

                // Highlight on hover
                poly.on('mouseover', function () {
                    this.setStyle({ fillOpacity: 0.6, weight: 3 });
                });
                poly.on('mouseout', function () {
                    this.setStyle({ fillOpacity: 0.35, weight: 2 });
                });

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

    const handleFinishDraw = () => {
        if (drawingPoints.length < 3) return alert("Zone must have at least 3 points");
        setShowModal(true);
    };

    const handleSaveZone = async () => {
        if (!tempZoneData.name) return alert("Name is required");

        const payload = {
            p_name: tempZoneData.name,
            p_description: tempZoneData.description,
            p_coordinates: drawingPoints,
            p_type: 'polygon',
            p_gang_id: selectedGang || null,
            p_case_id: selectedCase || null,
            p_color: tempZoneData.color
        };

        const { error } = await supabase.rpc('create_map_zone', payload);
        if (error) {
            alert('Error: ' + error.message);
        } else {
            fetchZones();
            setMode('view');
            setDrawingPoints([]);
            setShowModal(false);
            setTempZoneData({ name: '', description: '', color: '#ef4444' });
            setSelectedGang('');
            setSelectedCase('');
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

    // Using inline styles for simplicity here, but would ideally move to CSS file
    return (
        <div style={{ position: 'relative', height: 'calc(100vh - 140px)', width: '100%', overflow: 'hidden', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>

            {/* Map Container */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', outline: 'none' }} />

            {/* Floating Toolbar */}
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
                        <h2 style={{ textAlign: 'center', color: '#cfb53b', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Define Zone</h2>

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

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                            <button
                                onClick={handleSaveZone}
                                className="login-button"
                                style={{ flex: 1, color: '#000', background: '#cfb53b' }}
                            >
                                Save Data
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

// Additional CSS for popup injected into head or via class
// Note: Leaflet popups are rendered outside React root usually, so standard CSS works best.

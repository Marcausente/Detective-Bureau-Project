import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import GTAVMap from '../assets/GTAV-HD-MAP-satellite.jpg';

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
    const [zones, setZones] = useState([]);

    // Auth & Edit Mode State
    const [authorized, setAuthorized] = useState(false);
    const [mode, setMode] = useState('view'); // 'view', 'draw'
    const [drawingPoints, setDrawingPoints] = useState([]);
    const [tempZoneData, setTempZoneData] = useState({ name: '', description: '', color: '#ef4444' });
    const [showModal, setShowModal] = useState(false);

    // Drawing Ref to clear preview lines
    const drawingLayerRef = useRef(null);

    useEffect(() => {
        // 1. Initialize Map
        if (!mapInstanceRef.current && mapContainerRef.current) {
            const map = L.map(mapContainerRef.current, {
                crs: L.CRS.Simple,
                minZoom: -3,
                maxZoom: 2,
                zoom: -1,
                center: [4096, 4096]
            });

            const bounds = [[0, 0], [8192, 8192]];
            L.imageOverlay(GTAVMap, bounds).addTo(map);
            map.fitBounds(bounds);

            // Layer Group for Zones
            layerGroupRef.current = L.layerGroup().addTo(map);
            // Layer Group for Drawing Preview
            drawingLayerRef.current = L.layerGroup().addTo(map);

            // Event Listeners for Drawing
            map.on('click', (e) => {
                // We'll handle state updates via a ref or event, 
                // but since we need access to 'mode' state, we might need to use a mutable ref for mode 
                // or just rely on the React state update triggering a re-render/effect logic.
                // However, Leaflet events inside useEffect with stale closures are tricky.
                // We'll dispatch a custom event or use a Ref for current mode.
                handleMapClick(e);
            });

            map.on('contextmenu', (e) => {
                handleMapRightClick(e);
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

    // Helper to access state inside Leaflet listeners (which close over initial state)
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    const drawingPointsRef = useRef(drawingPoints);
    useEffect(() => { drawingPointsRef.current = drawingPoints; }, [drawingPoints]);

    const handleMapClick = (e) => {
        if (modeRef.current === 'draw') {
            const newPoint = [e.latlng.lat, e.latlng.lng];
            // Update State
            setDrawingPoints(prev => [...prev, newPoint]);
        }
    };

    const handleMapRightClick = (e) => {
        if (modeRef.current === 'draw') {
            e.originalEvent.preventDefault();
            setDrawingPoints(prev => prev.slice(0, -1));
        }
    };

    // 2. Fetch Data
    useEffect(() => {
        checkAuth();
        fetchZones();
    }, []);

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

    // 3. Render Zones to Map
    useEffect(() => {
        if (mapInstanceRef.current && layerGroupRef.current) {
            layerGroupRef.current.clearLayers();

            zones.forEach(zone => {
                const poly = L.polygon(zone.coordinates, { color: zone.color, fillColor: zone.color, fillOpacity: 0.3 });

                const popupContent = document.createElement('div');
                popupContent.innerHTML = `
                    <h3>${zone.name}</h3>
                    <p>${zone.description || ''}</p>
                    ${zone.gang_name ? `<p><strong>Gang:</strong> ${zone.gang_name}</p>` : ''}
                    ${zone.case_title ? `<p><strong>Case:</strong> ${zone.case_title}</p>` : ''}
                `;

                if (authorized) {
                    const btn = document.createElement('button');
                    btn.innerText = 'Delete Zone';
                    btn.style = 'background: #ef4444; color: white; border: none; padding: 5px; margin-top: 5px; cursor: pointer; border-radius: 4px;';
                    btn.onclick = () => handleDeleteZone(zone.id);
                    popupContent.appendChild(btn);
                }

                poly.bindPopup(popupContent);
                poly.addTo(layerGroupRef.current);
            });
        }
    }, [zones, authorized]); // Re-render zones when data or auth changes

    // 4. Render Drawing Preview
    useEffect(() => {
        if (mapInstanceRef.current && drawingLayerRef.current) {
            drawingLayerRef.current.clearLayers();

            if (mode === 'draw' && drawingPoints.length > 0) {
                // Points
                drawingPoints.forEach(pt => {
                    L.circleMarker(pt, { color: 'yellow', radius: 4 }).addTo(drawingLayerRef.current);
                });

                // Lines
                if (drawingPoints.length > 1) {
                    L.polyline(drawingPoints, { color: 'yellow', dashArray: '5, 10' }).addTo(drawingLayerRef.current);
                }

                // Closing line (optional visual)
                if (drawingPoints.length > 2) {
                    L.polyline([drawingPoints[drawingPoints.length - 1], drawingPoints[0]], { color: 'yellow', dashArray: '5, 10', opacity: 0.5 }).addTo(drawingLayerRef.current);
                }
            }
        }
    }, [drawingPoints, mode]);


    // ACTIONS
    const handleDeleteZone = async (id) => {
        if (!confirm('Delete this zone?')) return;
        const { error } = await supabase.rpc('delete_map_zone', { p_id: id });
        if (error) alert('Error: ' + error.message);
        else fetchZones();
    };

    const handleFinishDraw = () => {
        if (drawingPoints.length < 3) return alert("All zones must have at least 3 points");
        setShowModal(true);
    };

    const handleSaveZone = async () => {
        const payload = {
            p_name: tempZoneData.name,
            p_description: tempZoneData.description,
            p_coordinates: drawingPoints,
            p_type: 'polygon',
            p_color: tempZoneData.color
        };
        const { error } = await supabase.rpc('create_map_zone', payload);
        if (error) alert('Error: ' + error.message);
        else {
            fetchZones();
            setMode('view');
            setDrawingPoints([]);
            setShowModal(false);
            setTempZoneData({ name: '', description: '', color: '#ef4444' });
        }
    };

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <div className="crime-map-toolbar" style={{ padding: '10px', background: '#1a1a1a', display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #333' }}>
                <h2 style={{ margin: 0, marginRight: '20px' }}>Crime Map</h2>
                {authorized && mode === 'view' && (
                    <button onClick={() => setMode('draw')} className="action-btn">Add Zone</button>
                )}
                {mode === 'draw' && (
                    <>
                        <span style={{ color: '#aaa' }}>Click map to add points. Right-click to undo. </span>
                        <button onClick={handleFinishDraw} className="action-btn confirm" disabled={drawingPoints.length < 3}>Finish & Save</button>
                        <button onClick={() => { setMode('view'); setDrawingPoints([]); }} className="action-btn cancel">Cancel</button>
                    </>
                )}
            </div>

            {/* Map Container */}
            <div ref={mapContainerRef} style={{ flex: 1, width: '100%', background: '#0fa8d2' }} />

            {/* Save Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '400px' }}>
                        <h3>Save New Zone</h3>
                        <div className="form-group">
                            <label>Name</label>
                            <input value={tempZoneData.name} onChange={e => setTempZoneData({ ...tempZoneData, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea value={tempZoneData.description} onChange={e => setTempZoneData({ ...tempZoneData, description: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Color</label>
                            <input type="color" value={tempZoneData.color} onChange={e => setTempZoneData({ ...tempZoneData, color: e.target.value })} style={{ width: '100%', height: '40px' }} />
                        </div>
                        <div className="modal-actions">
                            <button onClick={handleSaveZone} className="action-btn confirm">Save</button>
                            <button onClick={() => setShowModal(false)} className="action-btn cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

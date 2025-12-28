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

export default function PublicGangMap() {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);
    const [zones, setZones] = useState([]);

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

            mapInstanceRef.current = map;
        }

        // Fetch Public Zones
        fetchPublicZones();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const fetchPublicZones = async () => {
        const { data, error } = await supabase.rpc('get_public_gang_zones');
        if (error) {
            console.error("Error fetching public zones:", error);
        } else {
            setZones(data || []);
        }
    };

    // Render Layers
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

                // Simplified Popup for Public: Title & Description ONLY
                const popupHTML = `
                    <h3 style="margin: 0 0 5px 0; color: #cfb53b; text-transform: uppercase;">${zone.name}</h3>
                    <p style="margin: 0 0 10px 0; color: #ccc; font-size: 0.9em;">${zone.description || ''}</p>
                    <div style="font-size: 0.8em; margin-top: 5px; color: #ef4444; font-weight: bold; border: 1px solid #ef4444; padding: 2px 5px; border-radius: 4px; display: inline-block;">DANGER ZONE</div>
                `;

                poly.bindPopup(popupHTML, {
                    className: 'custom-popup-dark'
                });

                poly.on('mouseover', function () { this.setStyle({ fillOpacity: 0.6, weight: 3 }); });
                poly.on('mouseout', function () { this.setStyle({ fillOpacity: 0.35, weight: 2 }); });

                poly.addTo(layerGroupRef.current);
            });
        }
    }, [zones]);

    const toolbarStyle = {
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '15px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        minWidth: '280px'
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0f172a', position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', outline: 'none' }} />

            <div style={toolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px #ef4444' }}></div>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Public Danger Map</h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Visualizing known high-risk and gang activity zones. Proceed with caution.
                </div>
            </div>
            <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '25px',
                zIndex: 1000,
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.8rem',
                pointerEvents: 'none'
            }}>
                Detective Bureau Public Service
            </div>
        </div>
    );
}

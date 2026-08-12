import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, processHtmlImages, getProfileImage, filterBucketImages, stripBase64FromHtml } from '../utils/imageStorage';
import IncidentCard from '../components/IncidentCard';
import OutingCard from '../components/OutingCard';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Incidents() {
    const [incidents, setIncidents] = useState([]);
    const [outings, setOutings] = useState([]);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();
    const [searchParams, setSearchParams] = useSearchParams();
    const highlightedRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGangName, setSelectedGangName] = useState('');
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const searchHighlightedRef = useRef(null);

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
    const [interrogations, setInterrogations] = useState([]); // List of interrogations for selection

    // --- FORM STATE: INCIDENT ---
    const [incTitle, setIncTitle] = useState('');
    const [incLocation, setIncLocation] = useState('');
    const [incDate, setIncDate] = useState('');
    const [incTablet, setIncTablet] = useState('');
    const [incDesc, setIncDesc] = useState('');
    const [incGangIds, setIncGangIds] = useState([]); // Changed to array for multiple gangs
    const [incInterrogationIds, setIncInterrogationIds] = useState([]); // Array of linked interrogation IDs
    const [incImages, setIncImages] = useState([]);

    // --- FORM STATE: OUTING ---
    const [outTitle, setOutTitle] = useState('');
    const [outDate, setOutDate] = useState('');
    const [outDetectives, setOutDetectives] = useState([]); // Array of IDs
    const [outReason, setOutReason] = useState('');
    const [outInfo, setOutInfo] = useState('');
    const [outGangIds, setOutGangIds] = useState([]); // Changed to array for multiple gangs
    const [outInterrogationIds, setOutInterrogationIds] = useState([]); // Array of linked interrogation IDs
    const [outTag, setOutTag] = useState('');
    const [outImages, setOutImages] = useState([]);
    // --- PAGINATION / LIMITS (20 ITEMS PER SECTION) ---
    const [visibleGeneralCount, setVisibleGeneralCount] = useState(20);
    const [visibleLinkedCount, setVisibleLinkedCount] = useState(20);
    const [visibleOutingsCount, setVisibleOutingsCount] = useState(20);

    useEffect(() => {
        loadData();
        fetchUsers();
        fetchGangs();
        fetchInterrogations();
    }, []);

    // Scroll to highlighted element after data loads
    useEffect(() => {
        if (!loading && highlightedRef.current) {
            setTimeout(() => {
                highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    }, [loading]);

    // Filter to only Informes Generales (unlinked incidents)
    const generalIncidents = useMemo(() => incidents.filter(i => !i.gang_id), [incidents]);
    const linkedIncidents = useMemo(() => incidents.filter(i => i.gang_id), [incidents]);

    const visibleGeneralIncidents = useMemo(() => {
        if (searchTerm || selectedGangName || searchParams.get('incident_id')) return generalIncidents;
        return generalIncidents.slice(0, visibleGeneralCount);
    }, [generalIncidents, visibleGeneralCount, searchTerm, selectedGangName, searchParams]);

    const visibleLinkedIncidents = useMemo(() => {
        if (searchTerm || searchParams.get('incident_id')) return linkedIncidents;
        return linkedIncidents.slice(0, visibleLinkedCount);
    }, [linkedIncidents, visibleLinkedCount, searchTerm, searchParams]);

    const visibleOutings = useMemo(() => {
        if (searchParams.get('outing_id')) return outings;
        return outings.slice(0, visibleOutingsCount);
    }, [outings, visibleOutingsCount, searchParams]);

    // Compute search matches:
    // - If selectedGangName is set -> Search ONLY in generalIncidents (unlinked reports) for gang members
    // - If searchTerm is set -> Search across ALL incidents (General & Linked) for report number/text/author
    const searchMatches = useMemo(() => {
        if (selectedGangName && selectedGangName.trim() !== '') {
            const term = selectedGangName.toLowerCase().trim();
            const matchedGang = gangs.find(g => g.name && g.name.toLowerCase() === term);

            const searchTerms = [term];
            if (matchedGang && matchedGang.gang_members) {
                matchedGang.gang_members.forEach(m => {
                    if (m.name) {
                        const nameLower = m.name.toLowerCase().trim();
                        searchTerms.push(nameLower);

                        const bracketMatch = m.name.match(/\[([^\]]+)\]/);
                        if (bracketMatch && bracketMatch[1]) {
                            searchTerms.push(bracketMatch[1].toLowerCase().trim());
                        }
                    }
                });
            }

            return generalIncidents.filter(inc => {
                return searchTerms.some(sTerm => {
                    return (
                        (inc.title && inc.title.toLowerCase().includes(sTerm)) ||
                        (inc.description && inc.description.toLowerCase().includes(sTerm)) ||
                        (inc.location && inc.location.toLowerCase().includes(sTerm)) ||
                        (inc.author_name && inc.author_name.toLowerCase().includes(sTerm))
                    );
                });
            }).map(inc => inc.record_id);
        }

        if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') return [];

        const term = searchTerm.toLowerCase().trim();
        const cleanSTerm = term.replace(/^#/, '');

        return incidents.filter(inc => {
            return (
                (inc.title && inc.title.toLowerCase().includes(term)) ||
                (inc.description && inc.description.toLowerCase().includes(term)) ||
                (inc.tablet_incident_number && inc.tablet_incident_number.toString().toLowerCase().includes(cleanSTerm)) ||
                (inc.location && inc.location.toLowerCase().includes(term)) ||
                (inc.author_name && inc.author_name.toLowerCase().includes(term)) ||
                (inc.gang_names && inc.gang_names.some(gName => gName.toLowerCase().includes(term))) ||
                (inc.record_id && inc.record_id.toLowerCase().includes(term))
            );
        }).map(inc => inc.record_id);
    }, [incidents, generalIncidents, searchTerm, selectedGangName, gangs]);

    const goToNextMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev + 1) % searchMatches.length);
    };

    const goToPrevMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev - 1 + searchMatches.length) % searchMatches.length);
    };

    // Scroll to search highlighted element
    useEffect(() => {
        if (searchMatches.length > 0 && searchHighlightedRef.current) {
            const el = searchHighlightedRef.current;
            const timer = setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [searchTerm, selectedGangName, currentMatchIndex]);

    const loadData = async () => {
        setLoading(true);
        const { data: incData, error: incError } = await supabase.rpc('get_incidents_v2');
        const { data: outData, error: outError } = await supabase.rpc('get_outings');

        if (incError) console.error("Incidents Error:", incError);
        if (outError) {
            console.error("Outings Error:", outError);
            alert("Error loading outings: " + outError.message);
        }

        const sanitizedIncidents = (incData || []).map(inc => ({
            ...inc,
            images: filterBucketImages(inc.images),
            author_avatar: getProfileImage(inc.author_avatar, '/logowebp/anon.webp'),
            description: stripBase64FromHtml(inc.description),
            gang_names: inc.gang_names || []
        }));

        const sanitizedOutings = (outData || []).map(out => ({
            ...out,
            images: filterBucketImages(out.images),
            author_avatar: getProfileImage(out.author_avatar, '/logowebp/anon.webp'),
            info_obtained: stripBase64FromHtml(out.info_obtained),
            detectives: (out.detectives && Array.isArray(out.detectives))
                ? out.detectives.map(d => ({ ...d, avatar: getProfileImage(d.avatar, '/logowebp/anon.webp') }))
                : []
        }));

        setIncidents(sanitizedIncidents);
        setOutings(sanitizedOutings);
        setLoading(false);
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('id, nombre, apellido, rango').order('rango');
        setUsers(data || []);
    };

    const fetchGangs = async () => {
        // Fetch gangs and their members using get_gangs_data RPC to avoid RLS restrictions
        const { data, error } = await supabase.rpc('get_gangs_data');
        if (error) {
            console.error("Error fetching gangs for incidents filter:", error);
            return;
        }
        const mappedGangs = (data || []).map(g => ({
            id: g.gang_id,
            name: g.name,
            gang_members: g.members || []
        })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setGangs(mappedGangs);
    };

    const fetchInterrogations = async () => {
        // Fetch available interrogations for linking
        console.log("Fetching interrogations...");
        const { data, error } = await supabase.rpc('get_available_interrogations_to_link');
        if (error) console.error("Error fetching interrogations:", error);
        if (data) {
            console.log("Interrogations fetched:", data);
            setInterrogations(data);
        }
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
            if (incTablet && incTablet.trim() !== '') {
                const trimmedTablet = incTablet.trim();
                const { data: existing } = await supabase
                    .from('incidents')
                    .select('id, tablet_incident_number')
                    .ilike('tablet_incident_number', trimmedTablet);

                const isDuplicate = (existing && existing.length > 0) || incidents.some(i => i.tablet_incident_number && i.tablet_incident_number.toString().trim().toLowerCase() === trimmedTablet.toLowerCase());

                if (isDuplicate) {
                    const warningMsg = (t('tabletExistsWarning') || "El número de informe tablet '{number}' ya se encuentra en la BBDD, ¿estás seguro de que quieres añadirlo?").replace('{number}', trimmedTablet);
                    if (!window.confirm(warningMsg)) {
                        setSubmitting(false);
                        return;
                    }
                }
            }

            // Format title with tablet number if present
            const finalTitle = incTablet ? `[${incTablet}] ${incTitle}` : incTitle;

            let uploadedImages = [];
            if (incImages && incImages.length > 0) {
                uploadedImages = await Promise.all(
                    incImages.map(img => (img && img.startsWith('data:')) ? uploadImageToStorage(img, 'incidents') : Promise.resolve(img))
                );
            }

            const finalDesc = await processHtmlImages(incDesc, 'incidents');

            const { data: newId, error } = await supabase.rpc('create_incident_v2', {
                p_title: finalTitle,
                p_location: incLocation,
                p_occurred_at: new Date(incDate).toISOString(),
                p_tablet_number: incTablet,
                p_description: finalDesc,
                p_images: uploadedImages
            });
            if (error) throw error;

            // Link to multiple gangs
            if (incGangIds.length > 0) {
                for (const gangId of incGangIds) {
                    await supabase.rpc('link_incident_gang', { p_incident_id: newId, p_gang_id: gangId });
                }
            }

            // Link to Interrogations
            if (incInterrogationIds.length > 0) {
                for (const intId of incInterrogationIds) {
                    await supabase.rpc('link_incident_interrogation', { p_incident_id: newId, p_interrogation_id: intId });
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
            let uploadedImages = [];
            if (outImages && outImages.length > 0) {
                uploadedImages = await Promise.all(
                    outImages.map(img => (img && img.startsWith('data:')) ? uploadImageToStorage(img, 'incidents') : Promise.resolve(img))
                );
            }

            const finalInfo = await processHtmlImages(outInfo, 'incidents');

            const { data: newId, error } = await supabase.rpc('create_outing', {
                p_title: outTitle,
                p_occurred_at: new Date(outDate).toISOString(),
                p_reason: outReason,
                p_info_obtained: finalInfo,
                p_images: uploadedImages,
                p_detective_ids: outDetectives,
                p_tag: outTag || null
            });
            if (error) throw error;

            // Link to multiple gangs
            if (outGangIds.length > 0) {
                for (const gangId of outGangIds) {
                    await supabase.rpc('link_outing_gang', { p_outing_id: newId, p_gang_id: gangId });
                }
            }

            // Link to Interrogations
            if (outInterrogationIds.length > 0) {
                for (const intId of outInterrogationIds) {
                    await supabase.rpc('link_outing_interrogation', { p_incident_id: newId, p_interrogation_id: intId });
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
        if (incident.occurred_at) {
            const dt = new Date(incident.occurred_at);
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            setIncDate(dt.toISOString().slice(0, 16));
        } else {
            setIncDate('');
        }
        setIncTablet(incident.tablet_incident_number || '');
        setIncDesc(incident.description || '');
        setIncImages(filterBucketImages(incident.images || [])); // Load existing Bucket images only

        // Load linked gangs
        const { data: linkedGangs, error } = await supabase.rpc('get_incident_gangs', { p_incident_id: incident.record_id });
        if (!error && linkedGangs) {
            setIncGangIds(linkedGangs.map(g => g.gang_id));
        }

        // Load linked interrogations
        const { data: linkedInters, error: intError } = await supabase.rpc('get_incident_interrogations', { p_incident_id: incident.record_id });
        if (!intError && linkedInters) {
            setIncInterrogationIds(linkedInters.map(i => i.id));
        } else {
            setIncInterrogationIds([]);
        }

        setShowEditIncidentModal(true);
    };

    const handleUpdateIncident = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (incTablet && incTablet.trim() !== '') {
                const trimmedTablet = incTablet.trim();
                const currentId = editingIncident?.record_id || editingIncident?.id;

                const { data: existing } = await supabase
                    .from('incidents')
                    .select('id, tablet_incident_number')
                    .ilike('tablet_incident_number', trimmedTablet);

                const duplicateInDb = existing && existing.some(item => item.id !== currentId);
                const duplicateInState = incidents.some(i =>
                    (i.record_id !== currentId && i.id !== currentId) &&
                    i.tablet_incident_number &&
                    i.tablet_incident_number.toString().trim().toLowerCase() === trimmedTablet.toLowerCase()
                );

                if (duplicateInDb || duplicateInState) {
                    const warningMsg = (t('tabletExistsWarning') || "El número de informe tablet '{number}' ya se encuentra en la BBDD, ¿estás seguro de que quieres añadirlo?").replace('{number}', trimmedTablet);
                    if (!window.confirm(warningMsg)) {
                        setSubmitting(false);
                        return;
                    }
                }
            }

            // Format title with tablet number if present
            const finalTitle = incTablet ? `[${incTablet}] ${incTitle}` : incTitle;

            let uploadedImages = [];
            if (incImages && incImages.length > 0) {
                uploadedImages = await Promise.all(
                    incImages.map(img => (img && img.startsWith('data:')) ? uploadImageToStorage(img, 'incidents') : Promise.resolve(img))
                );
            }

            const finalDesc = await processHtmlImages(incDesc, 'incidents');

            // Update incident details
            const { error: updateError } = await supabase.rpc('update_incident', {
                p_incident_id: editingIncident.record_id,
                p_title: finalTitle,
                p_location: incLocation,
                p_occurred_at: new Date(incDate).toISOString(),
                p_tablet_number: incTablet,
                p_description: finalDesc,
                p_images: uploadedImages
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

            // --- Update Interrogations ---
            const { data: currentInters } = await supabase.rpc('get_incident_interrogations', { p_incident_id: editingIncident.record_id });
            const currentIntIds = currentInters ? currentInters.map(i => i.id) : [];

            // Unlink removed
            for (const intId of currentIntIds) {
                if (!incInterrogationIds.includes(intId)) {
                    await supabase.rpc('unlink_incident_interrogation', { p_incident_id: editingIncident.record_id, p_interrogation_id: intId });
                }
            }
            // Link new
            for (const intId of incInterrogationIds) {
                if (!currentIntIds.includes(intId)) {
                    await supabase.rpc('link_incident_interrogation', { p_incident_id: editingIncident.record_id, p_interrogation_id: intId });
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
        try {
            setEditingOuting(outing);
            setOutTitle(outing.title);
            if (outing.occurred_at) {
                const dt = new Date(outing.occurred_at);
                dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                setOutDate(dt.toISOString().slice(0, 16));
            } else {
                setOutDate('');
            }
            setOutReason(outing.reason || '');
            setOutInfo(outing.info_obtained || '');
            setOutImages(filterBucketImages(outing.images || []));
            setOutTag(outing.tag || '');

            // Setup detectives
            if (outing.detectives && outing.detectives.length > 0) {
                setOutDetectives(outing.detectives.map(d => d.id).filter(id => id));
            } else {
                setOutDetectives([]);
            }

            // Setup Gangs - fetch linked
            const { data: linkedGangs, error } = await supabase.rpc('get_outing_gangs', { p_outing_id: outing.record_id });
            if (error) {
                console.error("Error fetching outing gangs:", error);
            }
            if (!error && linkedGangs) {
                setOutGangIds(linkedGangs.map(g => g.gang_id));
            } else {
                setOutGangIds([]);
            }

            // Setup Interrogations - fetch linked
            const { data: linkedInters, error: intError } = await supabase.rpc('get_outing_interrogations', { p_outing_id: outing.record_id });
            if (!intError && linkedInters) {
                setOutInterrogationIds(linkedInters.map(i => i.id));
            } else {
                setOutInterrogationIds([]);
            }

            setShowEditOutingModal(true);
        } catch (e) {
            console.error("Error opening outing edit modal:", e);
            alert("Error opening edit menu: " + e.message);
        }
    };

    const handleUpdateOuting = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let uploadedImages = [];
            if (outImages && outImages.length > 0) {
                uploadedImages = await Promise.all(
                    outImages.map(img => (img && img.startsWith('data:')) ? uploadImageToStorage(img, 'incidents') : Promise.resolve(img))
                );
            }

            const finalInfo = await processHtmlImages(outInfo, 'incidents');

            const { error: updateError } = await supabase.rpc('update_outing', {
                p_outing_id: editingOuting.record_id,
                p_title: outTitle,
                p_occurred_at: new Date(outDate).toISOString(),
                p_reason: outReason,
                p_info_obtained: finalInfo,
                p_images: uploadedImages,
                p_tag: outTag || null
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

            // --- Update Interrogations ---
            const { data: currentInters } = await supabase.rpc('get_outing_interrogations', { p_outing_id: editingOuting.record_id });
            const currentIntIds = currentInters ? currentInters.map(i => i.id) : [];

            // Unlink removed
            for (const intId of currentIntIds) {
                if (!outInterrogationIds.includes(intId)) {
                    await supabase.rpc('unlink_outing_interrogation', { p_outing_id: editingOuting.record_id, p_interrogation_id: intId });
                }
            }
            // Link new
            for (const intId of outInterrogationIds) {
                if (!currentIntIds.includes(intId)) {
                    await supabase.rpc('link_outing_interrogation', { p_outing_id: editingOuting.record_id, p_interrogation_id: intId });
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
        setIncTitle(''); setIncLocation(''); setIncDate(''); setIncTablet(''); setIncDesc(''); setIncGangIds([]); setIncInterrogationIds([]); setIncImages([]);
    };
    const resetOutingForm = () => {
        setOutTitle(''); setOutDate(''); setOutDetectives([]); setOutReason(''); setOutInfo(''); setOutGangIds([]); setOutInterrogationIds([]); setOutImages([]); setOutTag('');
    };

    const toggleGangIncident = (gangId) => {
        setIncGangIds(prev => prev.includes(gangId) ? prev.filter(id => id !== gangId) : [...prev, gangId]);
    };

    const toggleInterrogationIncident = (intId) => {
        setIncInterrogationIds(prev => prev.includes(intId) ? prev.filter(id => id !== intId) : [...prev, intId]);
    };

    const toggleGangOuting = (gangId) => {
        setOutGangIds(prev => prev.includes(gangId) ? prev.filter(id => id !== gangId) : [...prev, gangId]);
    };

    const toggleInterrogationOuting = (intId) => {
        setOutInterrogationIds(prev => prev.includes(intId) ? prev.filter(id => id !== intId) : [...prev, intId]);
    };

    // Toggle Detective Selection
    const toggleDetective = (id) => {
        setOutDetectives(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // --- RENDER ---
    return (
        <div id="incidents-page" style={{ width: '100%', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', padding: '1rem 1.5rem 0 1.5rem', boxSizing: 'border-box', overflow: 'hidden' }}>

            {/* ── Inner Header Navbar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', padding: '0.3rem 0.8rem', gap: '1rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box', flexShrink: 0, minHeight: 0 }}>

                {/* Left: Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.015em' }}>{t('incidentsTitle')}</h2>
                </div>

                {/* Right: Search + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

                    {/* General search pill */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '20px',
                        padding: '0.35rem 0.85rem',
                        gap: '8px',
                        minWidth: '240px',
                        transition: 'border-color 0.2s',
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar informe, nº, autor, ubicación…"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (e.target.value) setSelectedGangName('');
                                setCurrentMatchIndex(0);
                            }}
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
                                onClick={() => { setSearchTerm(''); setCurrentMatchIndex(0); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 }}
                            >✕</button>
                        )}
                    </div>

                    {/* Gang filter — custom glass select */}
                    <div style={{ position: 'relative', minWidth: '175px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <select
                            value={selectedGangName}
                            onChange={(e) => {
                                setSelectedGangName(e.target.value);
                                if (e.target.value) setSearchTerm('');
                                setCurrentMatchIndex(0);
                            }}
                            style={{
                                width: '100%',
                                padding: '0.38rem 2rem 0.38rem 2.1rem',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                borderRadius: '20px',
                                color: selectedGangName ? '#fff' : '#94a3b8',
                                fontSize: '0.82rem',
                                outline: 'none',
                                appearance: 'none',
                                cursor: 'pointer',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 10px center',
                            }}
                        >
                            <option value="" style={{ background: '#0f172a', color: '#94a3b8' }}>Filtrar por banda</option>
                            {gangs.map(g => (
                                <option key={g.id} value={g.name} style={{ background: '#0f172a', color: '#fff' }}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Show-all pill button */}
                    {(searchParams.get('incident_id') || searchParams.get('outing_id')) && (
                        <button
                            type="button"
                            onClick={() => setSearchParams({})}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '0.38rem 1rem',
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '20px',
                                color: '#cbd5e1',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            Mostrar todos
                        </button>
                    )}

                    {/* NEW REPORT button */}
                    <button
                        type="button"
                        onClick={() => setShowIncidentModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '7px',
                            padding: '0.38rem 1.1rem',
                            background: 'rgba(99,102,241,0.18)',
                            border: '1px solid rgba(99,102,241,0.4)',
                            borderRadius: '20px',
                            color: '#a5b4fc',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t('logIncidentBtn')}
                    </button>

                    {/* NEW OUTING button */}
                    <button
                        type="button"
                        onClick={() => setShowOutingModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '7px',
                            padding: '0.38rem 1.1rem',
                            background: 'rgba(212,175,55,0.15)',
                            border: '1px solid rgba(212,175,55,0.45)',
                            borderRadius: '20px',
                            color: '#d4af37',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        {t('logOutingBtn')}
                    </button>
                </div>
            </div>

            {/* ── Search match navigator ── */}
            {searchMatches.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.4rem 1.2rem', marginBottom: '0.7rem',
                    background: 'rgba(56,189,248,0.08)',
                    border: '1px solid rgba(56,189,248,0.2)',
                    borderRadius: '10px',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span style={{ fontSize: '0.83rem', color: '#38bdf8', fontWeight: 500 }}>
                            {selectedGangName
                                ? `Coincidencia ${currentMatchIndex + 1} de ${searchMatches.length} — banda: ${selectedGangName}`
                                : `Coincidencia ${currentMatchIndex + 1} de ${searchMatches.length}`
                            }
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button type="button" onClick={goToPrevMatch} className="mac-doc-tab" style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                            Anterior
                        </button>
                        <button type="button" onClick={goToNextMatch} className="mac-doc-tab" style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Siguiente
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                    </div>
                </div>
            )}
            {searchMatches.length === 0 && (searchTerm.trim() !== '' || selectedGangName.trim() !== '') && (
                <div style={{
                    padding: '0.45rem 1.2rem', marginBottom: '0.7rem',
                    background: 'rgba(239,68,68,0.07)', borderRadius: '10px',
                    border: '1px solid rgba(239,68,68,0.15)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    flexShrink: 0,
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span style={{ fontSize: '0.83rem', color: '#f87171' }}>
                        {selectedGangName ? `Sin resultados para la banda "${selectedGangName}"` : `Sin resultados para "${searchTerm}"`}
                    </span>
                </div>
            )}

            {/* ── Main Content ── */}
            {loading ? (
                <div className="loading-container">{t('loadingIncidents')}</div>
            ) : (
                <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', gap: '1.5rem', overflow: 'hidden', paddingBottom: '0.5rem' }}>

                    {/* COLUMN 1: UNLINKED INCIDENTS */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', overflow: 'hidden' }}>
                        {/* Column Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '0.55rem 0.85rem',
                            background: 'rgba(99,102,241,0.1)',
                            border: '1px solid rgba(99,102,241,0.25)',
                            borderRadius: '10px',
                        }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#a5b4fc', letterSpacing: '-0.01em' }}>{t('generalIncidentsCol')}</span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '0.72rem', fontWeight: 700,
                                color: '#a5b4fc',
                                background: 'rgba(99,102,241,0.2)',
                                border: '1px solid rgba(99,102,241,0.35)',
                                borderRadius: '20px', padding: '0.1rem 0.55rem'
                            }}>{generalIncidents.length}</span>
                        </div>

                        {/* Cards */}
                        <div className="scroll-feed" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', paddingRight: '4px', paddingBottom: '1rem' }}>
                            {generalIncidents.length === 0 ? (
                                <div className="empty-list">{t('noIncidents')}</div>
                            ) : (
                                visibleGeneralIncidents.map(inc => {
                                    const isUrlHighlighted = searchParams.get('incident_id') === inc.record_id;
                                    const isSearchHighlighted = searchMatches.length > 0 && searchMatches[currentMatchIndex] === inc.record_id;
                                    return (
                                        <div key={inc.record_id} ref={isUrlHighlighted ? highlightedRef : (isSearchHighlighted ? searchHighlightedRef : null)}>
                                            <IncidentCard data={inc} onExpand={setExpandedImage} onDelete={handleDeleteIncident} onEdit={handleEditIncident} isHighlighted={isUrlHighlighted || isSearchHighlighted} />
                                        </div>
                                    );
                                })
                            )}
                            {!searchTerm && !searchParams.get('incident_id') && generalIncidents.length > visibleGeneralCount && (
                                <button
                                    type="button"
                                    className="mac-doc-tab"
                                    style={{ width: '100%', justifyContent: 'center', margin: '0.5rem 0', padding: '0.45rem 1rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={() => setVisibleGeneralCount(prev => prev + 20)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                    Cargar más ({generalIncidents.length - visibleGeneralCount} restantes)
                                </button>
                            )}
                        </div>
                    </div>

                    {/* COLUMN 2: LINKED INCIDENTS */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', overflow: 'hidden' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '0.55rem 0.85rem',
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.25)',
                            borderRadius: '10px',
                        }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#6ee7b7', letterSpacing: '-0.01em' }}>{t('linkedIncidentsCol')}</span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '0.72rem', fontWeight: 700,
                                color: '#6ee7b7',
                                background: 'rgba(16,185,129,0.2)',
                                border: '1px solid rgba(16,185,129,0.35)',
                                borderRadius: '20px', padding: '0.1rem 0.55rem'
                            }}>{linkedIncidents.length}</span>
                        </div>

                        <div className="scroll-feed" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', paddingRight: '4px', paddingBottom: '1rem' }}>
                            {linkedIncidents.length === 0 ? (
                                <div className="empty-list">{t('noLinkedIncidents')}</div>
                            ) : (
                                visibleLinkedIncidents.map(inc => {
                                    const isUrlHighlighted = searchParams.get('incident_id') === inc.record_id;
                                    const isSearchHighlighted = searchMatches.length > 0 && searchMatches[currentMatchIndex] === inc.record_id;
                                    return (
                                        <div key={inc.record_id} ref={isUrlHighlighted ? highlightedRef : (isSearchHighlighted ? searchHighlightedRef : null)}>
                                            <IncidentCard data={inc} onExpand={setExpandedImage} onDelete={handleDeleteIncident} onEdit={handleEditIncident} isHighlighted={isUrlHighlighted || isSearchHighlighted} />
                                        </div>
                                    );
                                })
                            )}
                            {!searchTerm && !searchParams.get('incident_id') && linkedIncidents.length > visibleLinkedCount && (
                                <button
                                    type="button"
                                    className="mac-doc-tab"
                                    style={{ width: '100%', justifyContent: 'center', margin: '0.5rem 0', padding: '0.45rem 1rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={() => setVisibleLinkedCount(prev => prev + 20)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                    Cargar más ({linkedIncidents.length - visibleLinkedCount} restantes)
                                </button>
                            )}
                        </div>
                    </div>

                    {/* COLUMN 3: OUTINGS / VIGILANCIAS */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', overflow: 'hidden' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '0.55rem 0.85rem',
                            background: 'rgba(212,175,55,0.1)',
                            border: '1px solid rgba(212,175,55,0.3)',
                            borderRadius: '10px',
                        }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d4af37', letterSpacing: '-0.01em' }}>{t('outingsCol')}</span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '0.72rem', fontWeight: 700,
                                color: '#d4af37',
                                background: 'rgba(212,175,55,0.15)',
                                border: '1px solid rgba(212,175,55,0.35)',
                                borderRadius: '20px', padding: '0.1rem 0.55rem'
                            }}>{outings.length}</span>
                        </div>

                        <div className="scroll-feed" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', paddingRight: '4px', paddingBottom: '1rem' }}>
                            {outings.length === 0 ? (
                                <div className="empty-list">{t('noOutings')}</div>
                            ) : (
                                visibleOutings.map(out => {
                                    const isHighlighted = searchParams.get('outing_id') === out.record_id;
                                    return (
                                        <div key={out.record_id} ref={isHighlighted ? highlightedRef : null}>
                                            <OutingCard data={out} onExpand={setExpandedImage} onDelete={handleDeleteOuting} onEdit={handleEditOuting} isHighlighted={isHighlighted} />
                                        </div>
                                    );
                                })
                            )}
                            {!searchParams.get('outing_id') && outings.length > visibleOutingsCount && (
                                <button
                                    type="button"
                                    className="mac-doc-tab"
                                    style={{ width: '100%', justifyContent: 'center', margin: '0.5rem 0', padding: '0.45rem 1rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(212,175,55,0.3)' }}
                                    onClick={() => setVisibleOutingsCount(prev => prev + 20)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                    Cargar más ({outings.length - visibleOutingsCount} restantes)
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            )}

            {/* --- MODAL: NEW INCIDENT --- */}
            {showIncidentModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        {/* macOS traffic dots */}
                        <div className="mac-window-dots" style={{ marginBottom: '1rem' }}>
                            <span className="mac-window-dot close" onClick={() => setShowIncidentModal(false)} title="Cerrar" />
                            <span className="mac-window-dot min" />
                            <span className="mac-window-dot max" />
                        </div>
                        <h3 className="section-title">{t('logNewIncidentTitle')}</h3>
                        <form onSubmit={handleSubmitIncident}>
                            <div className="form-group"><label>{t('titleLabel')}</label><input className="form-input" required value={incTitle} onChange={e => setIncTitle(e.target.value)} /></div>
                            <div className="form-group">
                                <label>{t('linkSyndicatesLabel')}</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {gangs.map(g => (
                                        <div key={g.id} onClick={() => toggleGangIncident(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: incGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={incGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                            <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>


                            <div className="form-group">
                                <label>{t('linkInterrogationsLabel')}</label>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                    {interrogations.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('noInterrogations')}</div> :
                                        interrogations.map(int => (
                                            <div key={int.id} onClick={() => toggleInterrogationIncident(int.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: incInterrogationIds.includes(int.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                <input type="checkbox" checked={incInterrogationIds.includes(int.id)} readOnly style={{ marginRight: '10px' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{int.title} ({new Date(int.created_at).toLocaleDateString()})</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="form-group"><label>{t('dateTimeLabel')}</label><input type="datetime-local" className="form-input" required value={incDate} onChange={e => setIncDate(e.target.value)} /></div>
                            <div className="form-group"><label>{t('locationLabel')}</label><input className="form-input" value={incLocation} onChange={e => setIncLocation(e.target.value)} /></div>
                            <div className="form-group"><label>{t('tabletNumberLabel')}</label><input className="form-input" value={incTablet} onChange={e => setIncTablet(e.target.value)} /></div>
                            <div className="form-group"><label>{t('descriptionLabel')}</label><textarea className="eval-textarea" rows="4" value={incDesc} onChange={e => setIncDesc(e.target.value)} /></div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('imagesLabel')}</label>
                                <label htmlFor="inc-file-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                    {t('uploadImagesBtn')}
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
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowIncidentModal(false)} style={{ width: 'auto' }}>{t('cancelBtn')}</button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : t('createBtn')}</button>
                            </div>
                        </form>
                    </div >
                </div >
            )}

            {/* --- MODAL: EDIT INCIDENT --- */}
            {
                showEditIncidentModal && (
                    <div className="cropper-modal-overlay">
                        <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div className="mac-window-dots" style={{ marginBottom: '1rem' }}>
                                <span className="mac-window-dot close" onClick={() => { setShowEditIncidentModal(false); setEditingIncident(null); resetIncidentForm(); }} title="Cerrar" />
                                <span className="mac-window-dot min" />
                                <span className="mac-window-dot max" />
                            </div>
                            <h3 className="section-title">{t('editIncidentTitle')}</h3>
                            <form onSubmit={handleUpdateIncident}>
                                <div className="form-group"><label>{t('titleLabel')}</label><input className="form-input" required value={incTitle} onChange={e => setIncTitle(e.target.value)} /></div>
                                <div className="form-group">
                                    <label>{t('linkSyndicatesLabel')}</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                        {gangs.map(g => (
                                            <div key={g.id} onClick={() => toggleGangIncident(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: incGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                <input type="checkbox" checked={incGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('linkInterrogationsLabel')}</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                        {interrogations.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('noInterrogations')}</div> :
                                            interrogations.map(int => (
                                                <div key={int.id} onClick={() => toggleInterrogationIncident(int.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: incInterrogationIds.includes(int.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                    <input type="checkbox" checked={incInterrogationIds.includes(int.id)} readOnly style={{ marginRight: '10px' }} />
                                                    <span style={{ fontSize: '0.9rem' }}>{int.title} ({new Date(int.created_at).toLocaleDateString()})</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>

                                <div className="form-group"><label>{t('dateTimeLabel')}</label><input type="datetime-local" className="form-input" required value={incDate} onChange={e => setIncDate(e.target.value)} /></div>
                                <div className="form-group"><label>{t('locationLabel')}</label><input className="form-input" value={incLocation} onChange={e => setIncLocation(e.target.value)} /></div>
                                <div className="form-group"><label>{t('tabletNumberLabel')}</label><input className="form-input" value={incTablet} onChange={e => setIncTablet(e.target.value)} /></div>
                                <div className="form-group"><label>{t('descriptionLabel')}</label><textarea className="eval-textarea" rows="4" value={incDesc} onChange={e => setIncDesc(e.target.value)} /></div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('imagesLabel')}</label>
                                    <label htmlFor="inc-edit-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                        {t('uploadImagesBtn')}
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
                                    <button type="button" className="login-button btn-secondary" onClick={() => { setShowEditIncidentModal(false); setEditingIncident(null); resetIncidentForm(); }} style={{ width: 'auto' }}>{t('cancelBtn')}</button>
                                    <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : t('updateBtn')}</button>
                                </div>
                            </form >
                        </div >
                    </div >
                )
            }

            {/* --- MODAL: NEW OUTING --- */}
            {
                showOutingModal && (
                    <div className="cropper-modal-overlay">
                        <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div className="mac-window-dots" style={{ marginBottom: '1rem' }}>
                                <span className="mac-window-dot close" onClick={() => setShowOutingModal(false)} title="Cerrar" />
                                <span className="mac-window-dot min" />
                                <span className="mac-window-dot max" />
                            </div>
                            <h3 className="section-title" style={{ color: 'var(--accent-gold)' }}>{t('logNewOutingTitle')}</h3>
                            <form onSubmit={handleSubmitOuting}>
                                <div className="form-group"><label>{t('titleLabel')}</label><input className="form-input" required value={outTitle} onChange={e => setOutTitle(e.target.value)} /></div>

                                {/* User Selector */}
                                <div className="form-group">
                                    <label>{t('detectivesPresentLabel')}</label>
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
                                    <label>{t('linkSyndicatesLabel')}</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                        {gangs.map(g => (
                                            <div key={g.id} onClick={() => toggleGangOuting(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                <input type="checkbox" checked={outGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('linkInterrogationsLabel')}</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                        {interrogations.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('noInterrogations')}</div> :
                                            interrogations.map(int => (
                                                <div key={int.id} onClick={() => toggleInterrogationOuting(int.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outInterrogationIds.includes(int.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                    <input type="checkbox" checked={outInterrogationIds.includes(int.id)} readOnly style={{ marginRight: '10px' }} />
                                                    <span style={{ fontSize: '0.9rem' }}>{int.title} ({new Date(int.created_at).toLocaleDateString()})</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>

                                <div className="form-group"><label>{t('dateTimeLabel')}</label><input type="datetime-local" className="form-input" required value={outDate} onChange={e => setOutDate(e.target.value)} /></div>
                                <div className="form-group"><label>{t('reasonForOutingLabel')}</label><input className="form-input" value={outReason} onChange={e => setOutReason(e.target.value)} /></div>
                                <div className="form-group"><label>{t('infoObtainedLabel')}</label><textarea className="eval-textarea" rows="4" value={outInfo} onChange={e => setOutInfo(e.target.value)} /></div>
                                <div className="form-group">
                                    <label>{t('tagLabel')}</label>
                                    <select className="form-input" value={outTag} onChange={e => setOutTag(e.target.value)}>
                                        <option value="">-- {t('noneOption') || 'Ninguno'} --</option>
                                        <option value="ORDINARIA">{t('tagOrdinaria')}</option>
                                        <option value="FOXTROT">{t('tagFoxtrot')}</option>
                                        <option value="MIKE">{t('tagMike')}</option>
                                        <option value="FUERA DE SERVICIO">{t('tagFueraDeServicio')}</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('imagesLabel')}</label>
                                    <label htmlFor="out-file-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                        {t('uploadImagesBtn')}
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
                                    <button type="button" className="login-button btn-secondary" onClick={() => setShowOutingModal(false)} style={{ width: 'auto' }}>{t('cancelBtn')}</button>
                                    <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : t('createBtn')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* --- MODAL: EDIT OUTING --- */}
            {
                showEditOutingModal && (
                    <div className="cropper-modal-overlay">
                        <div className="cropper-modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div className="mac-window-dots" style={{ marginBottom: '1rem' }}>
                                <span className="mac-window-dot close" onClick={() => { setShowEditOutingModal(false); setEditingOuting(null); resetOutingForm(); }} title="Cerrar" />
                                <span className="mac-window-dot min" />
                                <span className="mac-window-dot max" />
                            </div>
                            <h3 className="section-title" style={{ color: 'var(--accent-gold)' }}>{t('editOutingTitle')}</h3>
                            <form onSubmit={handleUpdateOuting}>
                                <div className="form-group"><label>{t('titleLabel')}</label><input className="form-input" required value={outTitle} onChange={e => setOutTitle(e.target.value)} /></div>

                                {/* User Selector */}
                                <div className="form-group">
                                    <label>{t('detectivesPresentLabel')}</label>
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
                                    <label>{t('linkSyndicatesLabel')}</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                        {gangs.map(g => (
                                            <div key={g.id} onClick={() => toggleGangOuting(g.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outGangIds.includes(g.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                <input type="checkbox" checked={outGangIds.includes(g.id)} readOnly style={{ marginRight: '10px' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{g.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('linkInterrogationsLabel')}</label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                        {interrogations.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('noInterrogations')}</div> :
                                            interrogations.map(int => (
                                                <div key={int.id} onClick={() => toggleInterrogationOuting(int.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.3rem', cursor: 'pointer', background: outInterrogationIds.includes(int.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}>
                                                    <input type="checkbox" checked={outInterrogationIds.includes(int.id)} readOnly style={{ marginRight: '10px' }} />
                                                    <span style={{ fontSize: '0.9rem' }}>{int.title} ({new Date(int.created_at).toLocaleDateString()})</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>

                                <div className="form-group"><label>{t('dateTimeLabel')}</label><input type="datetime-local" className="form-input" required value={outDate} onChange={e => setOutDate(e.target.value)} /></div>
                                <div className="form-group"><label>{t('reasonForOutingLabel')}</label><input className="form-input" value={outReason} onChange={e => setOutReason(e.target.value)} /></div>
                                <div className="form-group"><label>{t('infoObtainedLabel')}</label><textarea className="eval-textarea" rows="4" value={outInfo} onChange={e => setOutInfo(e.target.value)} /></div>
                                <div className="form-group">
                                    <label>{t('tagLabel')}</label>
                                    <select className="form-input" value={outTag} onChange={e => setOutTag(e.target.value)}>
                                        <option value="">-- {t('noneOption') || 'Ninguno'} --</option>
                                        <option value="ORDINARIA">{t('tagOrdinaria')}</option>
                                        <option value="FOXTROT">{t('tagFoxtrot')}</option>
                                        <option value="MIKE">{t('tagMike')}</option>
                                        <option value="FUERA DE SERVICIO">{t('tagFueraDeServicio')}</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('imagesLabel')}</label>
                                    <label htmlFor="out-edit-upload" className="login-button btn-secondary" style={{ width: 'auto', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                                        {t('uploadImagesBtn')}
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
                                    <button type="button" className="login-button btn-secondary" onClick={() => { setShowEditOutingModal(false); setEditingOuting(null); resetOutingForm(); }} style={{ width: 'auto' }}>{t('cancelBtn')}</button>
                                    <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>{submitting ? '...' : t('updateBtn')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* FULL SCREEN IMAGE VIEWER */}
            {
                expandedImage && (
                    <div onClick={() => setExpandedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={expandedImage} alt="" style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain' }} />
                    </div>
                )
            }
        </div>
    );
}

export default Incidents;

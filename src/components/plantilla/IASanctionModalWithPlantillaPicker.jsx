import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { sendIASanctionToDiscord, getIASanctionBanners } from '../../utils/discordWebhook';

export default function IASanctionModalWithPlantillaPicker({
    initialAgent,
    plantillaAgents = [],
    onClose,
    onSanctionCreated,
    currentUser
}) {
    // Autocomplete & Target Selection
    const [searchTerm, setSearchTerm] = useState(() => {
        if (initialAgent) {
            return `${initialAgent.nombre || ''} ${initialAgent.apellido || ''}`.trim() || initialAgent.no_placa || '';
        }
        return '';
    });
    const [selectedAgent, setSelectedAgent] = useState(initialAgent || null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const autocompleteRef = useRef(null);

    // Form data
    const [formData, setFormData] = useState({
        nombre: initialAgent?.nombre || '',
        apellido: initialAgent?.apellido || '',
        no_placa: initialAgent?.no_placa || '',
        sanctionType: 'Media', // 'Leve', 'Media', 'Grave', 'Despido', 'Leve (Sargentos)'
        reason: '',
        sanctionApplied: 'Amonestación disciplinaria registrada en expediente',
        sanctionDate: new Date().toISOString().split('T')[0],
        sendToDiscord: true,
        evidenceUrl: '',
        notes: ''
    });

    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successNotice, setSuccessNotice] = useState(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredAgents = plantillaAgents.filter(a => {
        if (a.is_divider || a.is_placeholder || (!a.nombre?.trim() && !a.apellido?.trim())) return false;
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const fullName = `${a.nombre || ''} ${a.apellido || ''}`.toLowerCase();
        const badge = (a.no_placa || '').toLowerCase();
        const user = (a.username || '').toLowerCase();
        const rank = (a.rank_name || '').toLowerCase();
        return fullName.includes(term) || badge.includes(term) || user.includes(term) || rank.includes(term);
    });

    const handleSelectAgent = (agent) => {
        setSelectedAgent(agent);
        setSearchTerm(`${agent.nombre || ''} ${agent.apellido || ''}`.trim());
        setFormData(prev => ({
            ...prev,
            nombre: agent.nombre || '',
            apellido: agent.apellido || '',
            no_placa: agent.no_placa || ''
        }));
        setIsDropdownOpen(false);
    };

    const handleClearSelection = () => {
        setSelectedAgent(null);
        setSearchTerm('');
        setFormData(prev => ({
            ...prev,
            nombre: '',
            apellido: '',
            no_placa: ''
        }));
        setIsDropdownOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessNotice(null);

        const nombreVal = selectedAgent ? (selectedAgent.nombre || '') : formData.nombre.trim();
        const apellidoVal = selectedAgent ? (selectedAgent.apellido || '') : formData.apellido.trim();
        const noPlacaVal = selectedAgent ? (selectedAgent.no_placa || 'S/P') : formData.no_placa.trim();

        if (!selectedAgent && !nombreVal && !apellidoVal) {
            setErrorMsg('Debes seleccionar un oficial de la plantilla o escribir su nombre/apellido.');
            return;
        }

        if (!formData.reason.trim()) {
            setErrorMsg('Debes especificar el motivo o falta cometida.');
            return;
        }

        try {
            setSaving(true);

            // 1. Encontrar o crear perfil de sujeto en Asuntos Internos (ia_subject_profiles)
            let subjectProfileId = null;

            // Prioridad absoluta: buscar por plantilla_agent_id
            if (selectedAgent?.id) {
                const { data: existingByAgent } = await supabase
                    .from('ia_subject_profiles')
                    .select('id, plantilla_agent_id, no_placa')
                    .eq('plantilla_agent_id', selectedAgent.id)
                    .maybeSingle();

                if (existingByAgent) {
                    subjectProfileId = existingByAgent.id;
                    // Mantener sincronizada la placa y nombre en el perfil por si cambió en la plantilla
                    await supabase
                        .from('ia_subject_profiles')
                        .update({
                            nombre: selectedAgent.nombre || 'Oficial',
                            apellido: selectedAgent.apellido || '',
                            no_placa: selectedAgent.no_placa || 'S/P'
                        })
                        .eq('id', existingByAgent.id);
                }
            }

            // Si aún no se encontró y hay agente seleccionado o nombre, buscar por nombre
            if (!subjectProfileId && nombreVal && apellidoVal) {
                const { data: existingByName } = await supabase
                    .from('ia_subject_profiles')
                    .select('id, plantilla_agent_id')
                    .ilike('nombre', nombreVal)
                    .ilike('apellido', apellidoVal)
                    .maybeSingle();

                if (existingByName) {
                    subjectProfileId = existingByName.id;
                    if (selectedAgent?.id) {
                        await supabase
                            .from('ia_subject_profiles')
                            .update({
                                plantilla_agent_id: selectedAgent.id,
                                no_placa: selectedAgent.no_placa || 'S/P'
                            })
                            .eq('id', existingByName.id);
                    }
                }
            }

            // Si aún no se encontró, buscar por placa si está disponible
            if (!subjectProfileId && noPlacaVal && noPlacaVal !== 'S/P') {
                const { data: existingByPlaca } = await supabase
                    .from('ia_subject_profiles')
                    .select('id, plantilla_agent_id')
                    .eq('no_placa', noPlacaVal)
                    .maybeSingle();

                if (existingByPlaca) {
                    subjectProfileId = existingByPlaca.id;
                    if (selectedAgent?.id) {
                        await supabase
                            .from('ia_subject_profiles')
                            .update({
                                plantilla_agent_id: selectedAgent.id,
                                no_placa: selectedAgent.no_placa || 'S/P'
                            })
                            .eq('id', existingByPlaca.id);
                    }
                }
            }

            // Si no existe perfil en Asuntos Internos, crearlo
            if (!subjectProfileId) {
                const newProfilePayload = {
                    nombre: nombreVal || 'Oficial',
                    apellido: apellidoVal || 'Sin Apellido',
                    no_placa: noPlacaVal || 'S/P',
                    plantilla_agent_id: selectedAgent?.id || null
                };

                const { data: newProfile, error: profileErr } = await supabase
                    .from('ia_subject_profiles')
                    .insert([newProfilePayload])
                    .select('id')
                    .single();

                if (profileErr) {
                    // Fallback RPC create_ia_subject_profile
                    const { data: rpcId, error: rpcErr } = await supabase.rpc('create_ia_subject_profile', {
                        p_nombre: newProfilePayload.nombre,
                        p_apellido: newProfilePayload.apellido,
                        p_no_placa: newProfilePayload.no_placa
                    });
                    if (rpcErr) throw rpcErr;
                    subjectProfileId = rpcId;

                    if (selectedAgent?.id && subjectProfileId) {
                        await supabase
                            .from('ia_subject_profiles')
                            .update({ plantilla_agent_id: selectedAgent.id })
                            .eq('id', subjectProfileId);
                    }
                } else {
                    subjectProfileId = newProfile.id;
                }
            }

            // 2. Insertar la sanción en ia_sanctions
            const isSargentos = formData.sanctionType === 'Leve (Sargentos)';
            const dbSanctionType = isSargentos ? 'Leve' : formData.sanctionType;

            const sanctionPayload = {
                subject_id: subjectProfileId,
                sanction_type: dbSanctionType,
                description: `[${formData.sanctionType}] ${formData.reason.trim()}${formData.sanctionApplied ? ` • Medida: ${formData.sanctionApplied.trim()}` : ''}`,
                sanction_date: formData.sanctionDate || new Date().toISOString().split('T')[0],
                is_sargentos: isSargentos
            };

            const { error: sanctionErr } = await supabase
                .from('ia_sanctions')
                .insert([sanctionPayload]);

            if (sanctionErr) {
                // Try fallback RPC manage_ia_sanction
                const { error: rpcSanctionErr } = await supabase.rpc('manage_ia_sanction', {
                    p_action: 'create',
                    p_subject_id: subjectProfileId,
                    p_type: formData.sanctionType,
                    p_description: sanctionPayload.description,
                    p_date: sanctionPayload.sanction_date
                });
                if (rpcSanctionErr) throw rpcSanctionErr;
            }

            // 3. Notificación a Discord si está activado
            if (formData.sendToDiscord) {
                try {
                    let bannerKey = 'leves_ia';
                    if (isSargentos) bannerKey = 'leves_sargentos';
                    else if (formData.sanctionType === 'Media') bannerKey = 'medias';
                    else if (formData.sanctionType === 'Grave') bannerKey = 'graves';
                    else if (formData.sanctionType === 'Despido') bannerKey = 'despido';

                    const banners = await getIASanctionBanners();
                    const activeBanner = banners?.[bannerKey] || '';

                    await sendIASanctionToDiscord({
                        sanctionType: bannerKey,
                        officerName: `${nombreVal} ${apellidoVal}`.trim(),
                        officerBadge: noPlacaVal,
                        officerRank: selectedAgent?.rank_name || '',
                        reason: formData.reason.trim(),
                        sanctionApplied: formData.sanctionApplied.trim() || formData.reason.trim(),
                        sanctionerName: currentUser ? `${currentUser.nombre || ''} ${currentUser.apellido || ''} (#${currentUser.no_placa || 'Comandancia'})` : 'Asuntos Internos',
                        sanctionDate: formData.sanctionDate,
                        evidenceUrl: formData.evidenceUrl,
                        notes: formData.notes,
                        customBannerUrl: activeBanner,
                        author: currentUser,
                        forceSend: true
                    });
                } catch (discordErr) {
                    console.warn('Discord send warning:', discordErr);
                }
            }

            setSuccessNotice('¡Sanción registrada correctamente en Asuntos Internos!');
            setTimeout(() => {
                if (onSanctionCreated) onSanctionCreated();
                onClose();
            }, 1000);

        } catch (err) {
            console.error('Error registering sanction:', err);
            setErrorMsg('Error al registrar la sanción: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mac-modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
            <div
                className="mac-modal-card"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '720px',
                    width: '95%',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0f172a',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '20px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem'
                        }}>
                            ⚖️
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
                                Registrar Sanción Disciplinaria (Asuntos Internos)
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Selecciona un agente de la plantilla o crea un perfil independiente en Asuntos Internos
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>

                        {errorMsg && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                color: '#fca5a5',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        {successNotice && (
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.5)',
                                color: '#6ee7b7',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                fontWeight: 700
                            }}>
                                ✅ {successNotice}
                            </div>
                        )}

                        {/* Plantilla Autocomplete Box */}
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            padding: '1.15rem'
                        }} ref={autocompleteRef}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Buscar y Seleccionar Agente de la Plantilla *
                            </label>

                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Escribe el nombre, apellido, placa o rango del agente..."
                                    value={searchTerm}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setIsDropdownOpen(true);
                                        // Auto-split name for manual input if not selecting
                                        const parts = e.target.value.trim().split(' ');
                                        setFormData(prev => ({
                                            ...prev,
                                            nombre: parts[0] || '',
                                            apellido: parts.slice(1).join(' ') || ''
                                        }));
                                    }}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.18)',
                                        borderRadius: '8px',
                                        padding: '0.6rem 2.4rem 0.6rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '0.88rem',
                                        fontWeight: 600
                                    }}
                                />

                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                        title="Limpiar"
                                    >
                                        ✕
                                    </button>
                                )}

                                {/* Autocomplete Dropdown */}
                                {isDropdownOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        top: '100%',
                                        marginTop: '6px',
                                        background: '#1e293b',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '6px',
                                        boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
                                        maxHeight: '220px',
                                        overflowY: 'auto',
                                        zIndex: 300
                                    }}>
                                        {filteredAgents.length > 0 ? (
                                            filteredAgents.map(ag => (
                                                <div
                                                    key={ag.id}
                                                    onClick={() => handleSelectAgent(ag)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '7px 10px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        background: selectedAgent?.id === ag.id ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = selectedAgent?.id === ag.id ? 'rgba(16, 185, 129, 0.2)' : 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            background: 'rgba(255, 255, 255, 0.1)',
                                                            overflow: 'hidden',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.8rem'
                                                        }}>
                                                            {ag.avatar_url ? (
                                                                <img src={ag.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : '👮'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                                                                {ag.nombre} {ag.apellido}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                {ag.rank_name || 'Agente'} {ag.no_placa ? `• #${ag.no_placa}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
                                                        Seleccionar ↵
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                No se encontraron agentes en la plantilla con ese nombre.
                                            </div>
                                        )}

                                        {/* Option to create independent unlinked profile */}
                                        {searchTerm.trim().length > 0 && !selectedAgent && (
                                            <div
                                                onClick={() => {
                                                    setSelectedAgent(null);
                                                    setIsDropdownOpen(false);
                                                }}
                                                style={{
                                                    marginTop: '4px',
                                                    padding: '8px 10px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(234, 179, 8, 0.15)',
                                                    border: '1px dashed rgba(234, 179, 8, 0.4)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fde047' }}>
                                                    ➕ Crear sanción para "{searchTerm.trim()}" (Perfil no vinculado)
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                    Se registrará en Asuntos Internos sin vincularlo a un agente de la plantilla.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Status indicator / Selected Agent Card */}
                            <div style={{ marginTop: '0.75rem' }}>
                                {selectedAgent ? (
                                    <div style={{
                                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
                                        border: '1.5px solid rgba(59, 130, 246, 0.5)',
                                        borderRadius: '12px',
                                        padding: '0.85rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '12px',
                                                background: 'rgba(59, 130, 246, 0.2)',
                                                border: '1.5px solid rgba(59, 130, 246, 0.5)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.25rem',
                                                fontWeight: 800,
                                                color: '#93c5fd',
                                                flexShrink: 0
                                            }}>
                                                🛡️
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                                                        {selectedAgent.nombre} {selectedAgent.apellido}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                                        color: '#fbbf24',
                                                        padding: '1px 7px',
                                                        borderRadius: '4px'
                                                    }}>
                                                        Placa actual: #{selectedAgent.no_placa || 'S/P'}
                                                    </span>
                                                    {selectedAgent.rank_name && (
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                                            color: '#cbd5e1',
                                                            padding: '1px 7px',
                                                            borderRadius: '4px'
                                                        }}>
                                                            {selectedAgent.rank_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#93c5fd', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>🔗</span>
                                                    <span>Vinculado permanentemente por ID. No requiere placa manual; si cambia en la plantilla se actualizará solo.</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleClearSelection}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                color: '#f87171',
                                                borderRadius: '8px',
                                                padding: '6px 12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap'
                                            }}
                                            title="Cambiar oficial seleccionado o escribir manualmente"
                                        >
                                            Cambiar Oficial
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        background: 'rgba(234, 179, 8, 0.1)',
                                        border: '1px solid rgba(234, 179, 8, 0.3)',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ fontSize: '1rem' }}>ℹ️</span>
                                        <span style={{ fontSize: '0.78rem', color: '#fef08a' }}>
                                            {searchTerm.trim() ? (
                                                `Perfil sin vincular: Se creará un expediente en Asuntos Internos para "${searchTerm.trim()}". Para vincularlo a la plantilla, selecciónalo de la lista desplegable superior.`
                                            ) : (
                                                'Selecciona un oficial de la plantilla para vincular la sanción de forma permanente sin depender del número de placa.'
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Officer Personal Data Inputs (Shown ONLY if NOT linked to a roster agent) */}
                        {!selectedAgent && (
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px dashed rgba(255, 255, 255, 0.12)',
                                borderRadius: '10px',
                                padding: '0.85rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '0.85rem'
                            }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        required={!selectedAgent}
                                        placeholder="Nombre del oficial"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Apellido *
                                    </label>
                                    <input
                                        type="text"
                                        required={!selectedAgent}
                                        placeholder="Apellido del oficial"
                                        value={formData.apellido}
                                        onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Nº Placa (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 701 (opcional)"
                                        value={formData.no_placa}
                                        onChange={e => setFormData({ ...formData, no_placa: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Sanction Type and Date */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Gravedad / Tipo de Falta *
                                </label>
                                <select
                                    value={formData.sanctionType}
                                    onChange={e => setFormData({ ...formData, sanctionType: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        borderRadius: '8px',
                                        padding: '0.55rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        fontWeight: 800
                                    }}
                                >
                                    <option value="Leve">🟡 Falta Leve (Régimen General)</option>
                                    <option value="Leve (Sargentos)">🟡 Falta Leve (Sargentos / Mandos)</option>
                                    <option value="Media">🟠 Falta Media</option>
                                    <option value="Grave">🔴 Falta Grave</option>
                                    <option value="Despido">⚫ Despido Disciplinario</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Fecha de la Sanción *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.sanctionDate}
                                    onChange={e => setFormData({ ...formData, sanctionDate: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Motivo / Infracción */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Motivo / Infracción Cometida *
                            </label>
                            <textarea
                                rows={3}
                                required
                                placeholder="Describe con claridad la infracción, reglamento infringido o conducta..."
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '0.55rem 0.75rem',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* Sanción Aplicada */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Medida Correctiva / Sanción Aplicada
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Suspensión de empleo y sueldo 3 días, Amonestación escrita..."
                                value={formData.sanctionApplied}
                                onChange={e => setFormData({ ...formData, sanctionApplied: e.target.value })}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '0.5rem 0.75rem',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        {/* Discord toggle */}
                        <div style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(129, 140, 248, 0.25)',
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={formData.sendToDiscord}
                                    onChange={e => setFormData({ ...formData, sendToDiscord: e.target.checked })}
                                    style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                                />
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#c7d2fe' }}>
                                        Publicar en Canal Oficial de Discord
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        Envía el embed con el banner oficial de Asuntos Internos al webhook configurado
                                    </div>
                                </div>
                            </label>
                            <span style={{ fontSize: '1.2rem' }}>📢</span>
                        </div>

                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.75rem',
                        background: 'rgba(15, 23, 42, 0.95)'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#cbd5e1',
                                padding: '0.55rem 1.1rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '0.55rem 1.4rem',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>⚖️</span>
                            <span>{saving ? 'Registrando...' : 'Emitir y Registrar Sanción'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


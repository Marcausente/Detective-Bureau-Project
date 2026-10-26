import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    getDiscordFeedbackWebhookConfig,
    saveDiscordFeedbackWebhookConfig,
    testDiscordFeedbackWebhook,
    DEFAULT_COMANDANCIA_FEEDBACK_BOT_NAME,
    DEFAULT_COMANDANCIA_FEEDBACK_CUSTOM_MSG,
    sendIASanctionToDiscord,
    getIASanctionBanners
} from '../utils/discordWebhook';
import { uploadImageToStorage } from '../utils/imageStorage';
import '../index.css';

export default function Comandancia() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { isLSSD, branding } = useTheme();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [feedbacks, setFeedbacks] = useState([]);
    const [existingFichas, setExistingFichas] = useState([]);

    // Reactions State (tick, cross, hourglass) per feedback id
    const [feedbackReactions, setFeedbackReactions] = useState({});

    // Feedbacks View State
    const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all'); // 'all' | 'Positivo' | 'Negativo' | 'Mixto'
    const [feedbackSearch, setFeedbackSearch] = useState('');
    const [feedbackSubView, setFeedbackSubView] = useState('audit'); // 'audit' | 'timeline'
    const [copyNotice, setCopyNotice] = useState(false);

    // Discord Webhook State (Feedbacks)
    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [webhookConfig, setWebhookConfig] = useState({
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_COMANDANCIA_FEEDBACK_BOT_NAME,
        botAvatar: '',
        customMsg: DEFAULT_COMANDANCIA_FEEDBACK_CUSTOM_MSG
    });
    const [savingWebhook, setSavingWebhook] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [webhookNotice, setWebhookNotice] = useState(null);
    const [webhookError, setWebhookError] = useState(null);

    // Sanctions State (Falta Leve Sargentos -> Apartado de Sanciones)
    const [showSanctionModal, setShowSanctionModal] = useState(false);
    const [officersList, setOfficersList] = useState([]);
    const [sanctionForm, setSanctionForm] = useState({
        officerName: '',
        officerBadge: '',
        officerRank: '',
        reason: '',
        sanctionApplied: 'Amonestación verbal / Advertencia formal registrada en expediente',
        sanctionDate: new Date().toISOString().split('T')[0],
        evidenceUrl: '',
        notes: '',
        sendToDiscord: true
    });
    const [submittingSanction, setSubmittingSanction] = useState(false);
    const [sanctionNotice, setSanctionNotice] = useState(null);
    const [sanctionError, setSanctionError] = useState(null);

    // Generic Ficha Modal State
    const [selectedFichaAgent, setSelectedFichaAgent] = useState(null);
    const [modalFichaTab, setModalFichaTab] = useState('received'); // 'received' | 'submitted'
    const [expandedFeedbacks, setExpandedFeedbacks] = useState({});

    const toggleFeedbackExpand = (id) => {
        setExpandedFeedbacks(prev => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        loadData();
    }, []);

    const fetchReactions = async () => {
        try {
            const reactionsMap = {};
            let rows = [];

            // 1. Intentar obtener desde RPC batch o tabla
            try {
                const { data: batchData, error: batchErr } = await supabase.rpc('get_feedback_reactions_batch');
                if (!batchErr && batchData) {
                    rows = batchData;
                } else {
                    const { data: rawRows, error: rawErr } = await supabase
                        .from('agent_feedback_reactions')
                        .select('*');
                    if (!rawErr && rawRows) {
                        rows = rawRows;
                    }
                }
            } catch (e) {
                console.warn('Consulta a agent_feedback_reactions:', e);
            }

            if (rows && rows.length > 0) {
                rows.forEach(r => {
                    if (!reactionsMap[r.feedback_id]) {
                        reactionsMap[r.feedback_id] = { check: [], cross: [], hourglass: [] };
                    }
                    if (reactionsMap[r.feedback_id][r.reaction_type]) {
                        reactionsMap[r.feedback_id][r.reaction_type].push(r);
                    }
                });
            }

            // 2. Fusionar con app_settings como fallback / sincronización
            try {
                const { data: settingData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'feedback_reactions_data')
                    .maybeSingle();
                if (settingData?.value) {
                    const parsed = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
                    Object.entries(parsed).forEach(([fbId, list]) => {
                        if (!reactionsMap[fbId]) {
                            reactionsMap[fbId] = { check: [], cross: [], hourglass: [] };
                        }
                        if (Array.isArray(list)) {
                            list.forEach(item => {
                                const type = item.reaction_type;
                                if (reactionsMap[fbId][type]) {
                                    const alreadyPresent = reactionsMap[fbId][type].some(x => x.user_id === item.user_id);
                                    if (!alreadyPresent) {
                                        reactionsMap[fbId][type].push(item);
                                    }
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                console.warn('Fallback reactions app_settings merge:', e);
            }

            setFeedbackReactions(reactionsMap);
        } catch (err) {
            console.error('Error fetching reactions:', err);
        }
    };

    const handleToggleReaction = async (feedbackId, reactionType) => {
        if (!profile?.id) {
            alert('Debes iniciar sesión para reaccionar.');
            return;
        }

        const currentUid = profile.id;
        const currentUserName = (profile.nombre ? `${profile.nombre} ${profile.apellido || ''}` : profile.username || 'Agente').trim();
        const currentUserRank = profile.rango || '';
        const currentUserAvatar = profile.profile_image || '';

        // 1. Optimistic UI update
        setFeedbackReactions(prev => {
            const existingForFb = prev[feedbackId] || { check: [], cross: [], hourglass: [] };
            const newForFb = {
                check: existingForFb.check ? [...existingForFb.check] : [],
                cross: existingForFb.cross ? [...existingForFb.cross] : [],
                hourglass: existingForFb.hourglass ? [...existingForFb.hourglass] : []
            };

            // Comprobar si el usuario ya tenía alguna reacción en este feedback
            const currentType = Object.keys(newForFb).find(type =>
                newForFb[type].some(r => r.user_id === currentUid)
            );

            if (currentType === reactionType) {
                // Mismo tipo -> Quitar (Toggle OFF)
                newForFb[reactionType] = newForFb[reactionType].filter(r => r.user_id !== currentUid);
            } else {
                // Tipo diferente -> Quitar del tipo previo si existía
                if (currentType) {
                    newForFb[currentType] = newForFb[currentType].filter(r => r.user_id !== currentUid);
                }
                // Añadir al nuevo tipo
                newForFb[reactionType].push({
                    user_id: currentUid,
                    user_name: currentUserName,
                    user_rank: currentUserRank,
                    user_avatar: currentUserAvatar,
                    reaction_type: reactionType,
                    created_at: new Date().toISOString()
                });
            }

            return {
                ...prev,
                [feedbackId]: newForFb
            };
        });

        // 2. Persistir en base de datos (RPC / Tabla)
        try {
            let rpcSuccess = false;
            try {
                const { error: rpcErr } = await supabase.rpc('toggle_feedback_reaction', {
                    p_feedback_id: feedbackId,
                    p_reaction_type: reactionType
                });
                if (!rpcErr) {
                    rpcSuccess = true;
                }
            } catch (e) {
                console.warn('RPC toggle_feedback_reaction error, intentando directo en tabla...', e);
            }

            if (!rpcSuccess) {
                const { data: existingRow } = await supabase
                    .from('agent_feedback_reactions')
                    .select('id, reaction_type')
                    .eq('feedback_id', feedbackId)
                    .eq('user_id', currentUid)
                    .maybeSingle();

                if (existingRow) {
                    if (existingRow.reaction_type === reactionType) {
                        await supabase
                            .from('agent_feedback_reactions')
                            .delete()
                            .eq('id', existingRow.id);
                    } else {
                        await supabase
                            .from('agent_feedback_reactions')
                            .update({
                                reaction_type: reactionType,
                                user_name: currentUserName,
                                user_rank: currentUserRank,
                                user_avatar: currentUserAvatar,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingRow.id);
                    }
                } else {
                    await supabase
                        .from('agent_feedback_reactions')
                        .insert({
                            feedback_id: feedbackId,
                            user_id: currentUid,
                            user_name: currentUserName,
                            user_rank: currentUserRank,
                            user_avatar: currentUserAvatar,
                            reaction_type: reactionType
                        });
                }
            }
        } catch (dbErr) {
            console.warn('Fallback a app_settings para feedback_reactions_data:', dbErr);
        }

        // 3. Sincronizar en paralelo con app_settings como respaldo
        try {
            const { data: appSet } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'feedback_reactions_data')
                .maybeSingle();
            let currentStore = {};
            if (appSet?.value) {
                currentStore = typeof appSet.value === 'string' ? JSON.parse(appSet.value) : appSet.value;
            }

            const existingList = Array.isArray(currentStore[feedbackId]) ? currentStore[feedbackId] : [];
            const userExistingIndex = existingList.findIndex(r => r.user_id === currentUid);

            let updatedList;
            if (userExistingIndex >= 0) {
                if (existingList[userExistingIndex].reaction_type === reactionType) {
                    updatedList = existingList.filter((_, idx) => idx !== userExistingIndex);
                } else {
                    updatedList = existingList.map((r, idx) => idx === userExistingIndex ? {
                        ...r,
                        reaction_type: reactionType,
                        user_name: currentUserName,
                        user_rank: currentUserRank,
                        user_avatar: currentUserAvatar,
                        updated_at: new Date().toISOString()
                    } : r);
                }
            } else {
                updatedList = [
                    ...existingList,
                    {
                        user_id: currentUid,
                        user_name: currentUserName,
                        user_rank: currentUserRank,
                        user_avatar: currentUserAvatar,
                        reaction_type: reactionType,
                        created_at: new Date().toISOString()
                    }
                ];
            }

            currentStore[feedbackId] = updatedList;
            await supabase.from('app_settings').upsert({
                key: 'feedback_reactions_data',
                value: currentStore,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch (fallbackErr) {
            console.warn('Error saving reactions fallback to app_settings:', fallbackErr);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            // 1. Load User Profile
            const { data: myProfile } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
            setProfile(myProfile);

            // 2. Load Feedbacks from agent_feedbacks (or fallback to app_settings)
            let loadedFeedbacks = [];
            try {
                const { data: fbData, error: fbErr } = await supabase
                    .from('agent_feedbacks')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!fbErr && fbData) {
                    loadedFeedbacks = fbData;
                } else {
                    const { data: fbSetting } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'agent_feedbacks')
                        .single();
                    if (fbSetting?.value) {
                        loadedFeedbacks = typeof fbSetting.value === 'string'
                            ? JSON.parse(fbSetting.value)
                            : fbSetting.value;
                    }
                }
            } catch (fbE) {
                console.warn('Error fetching feedbacks:', fbE);
            }
            setFeedbacks(loadedFeedbacks || []);

            // 3. Load Fichas from RPC if available
            try {
                const { data: fichasData, error: fichasErr } = await supabase.rpc('get_feedback_fichas');
                if (!fichasErr && fichasData) {
                    setExistingFichas(fichasData);
                }
            } catch (fErr) {
                console.warn('get_feedback_fichas RPC not available:', fErr);
            }

            // 4. Load Reactions
            await fetchReactions();

            // 5. Load Discord Feedback Webhook Config
            try {
                const wConfig = await getDiscordFeedbackWebhookConfig();
                if (wConfig) setWebhookConfig(wConfig);
            } catch (wErr) {
                console.warn('Error loading feedback webhook config:', wErr);
            }

            // 6. Load Officers list for Sanction autocompletion
            try {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, nombre, apellido, rango, no_placa, profile_image')
                    .order('nombre', { ascending: true });
                if (usersData) {
                    setOfficersList(usersData);
                }
            } catch (uErr) {
                console.warn('Error loading officers for sanctions:', uErr);
            }
        } catch (err) {
            console.error('Error loading Comandancia data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Webhook Handlers
    const handleSaveWebhook = async (e) => {
        e.preventDefault();
        setSavingWebhook(true);
        setWebhookNotice(null);
        setWebhookError(null);
        try {
            const res = await saveDiscordFeedbackWebhookConfig(webhookConfig);
            if (res.success) {
                setWebhookNotice('✅ Configuración del Webhook guardada exitosamente.');
                setTimeout(() => setWebhookNotice(null), 4000);
            } else {
                setWebhookError('Error al guardar: ' + res.error);
            }
        } catch (err) {
            setWebhookError(err.message);
        } finally {
            setSavingWebhook(false);
        }
    };

    const handleTestWebhook = async () => {
        setTestingWebhook(true);
        setWebhookNotice(null);
        setWebhookError(null);
        try {
            await testDiscordFeedbackWebhook(webhookConfig);
            setWebhookNotice('✅ ¡Mensaje de prueba enviado con éxito a Discord!');
            setTimeout(() => setWebhookNotice(null), 4500);
        } catch (err) {
            setWebhookError('Fallo en la prueba del webhook: ' + err.message);
        } finally {
            setTestingWebhook(false);
        }
    };

    const handleUploadBotAvatar = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploadingAvatar(true);
            setWebhookError(null);
            const url = await uploadImageToStorage(file, 'system');
            setWebhookConfig(prev => ({ ...prev, botAvatar: url }));
            setWebhookNotice('✅ Avatar subido y aplicado exitosamente.');
            setTimeout(() => setWebhookNotice(null), 4000);
        } catch (err) {
            setWebhookError('Error al subir avatar: ' + err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Sanctions Handlers (Falta Leve Sargentos -> Sanciones)
    const openSanctionModal = (agentName = '') => {
        let matchedBadge = '';
        let matchedRank = '';
        let cleanName = (agentName || '').trim();

        if (cleanName && officersList.length > 0) {
            const found = officersList.find(u => {
                const full = `${u.nombre || ''} ${u.apellido || ''}`.trim().toLowerCase();
                return full === cleanName.toLowerCase();
            });
            if (found) {
                matchedBadge = found.no_placa || '';
                matchedRank = found.rango || '';
            }
        }

        setSanctionForm({
            officerName: cleanName,
            officerBadge: matchedBadge,
            officerRank: matchedRank,
            reason: '',
            sanctionApplied: 'Amonestación verbal / Advertencia formal registrada en expediente',
            sanctionDate: new Date().toISOString().split('T')[0],
            evidenceUrl: '',
            notes: '',
            sendToDiscord: true
        });
        setSanctionNotice(null);
        setSanctionError(null);
        setShowSanctionModal(true);
    };

    const handleSubmitSanction = async (e) => {
        e.preventDefault();
        if (!sanctionForm.officerName.trim()) {
            setSanctionError('Debes indicar o seleccionar el agente sancionado.');
            return;
        }
        if (!sanctionForm.reason.trim()) {
            setSanctionError('Debes ingresar el motivo de la falta leve.');
            return;
        }

        try {
            setSubmittingSanction(true);
            setSanctionNotice(null);
            setSanctionError(null);

            const authorRank = profile?.rango ? `[${profile.rango}]` : '';
            const authorFullName = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
            const authorBadge = profile?.no_placa ? `(#${profile.no_placa})` : '';
            const sanctionerStr = `${authorRank} ${authorFullName} ${authorBadge} (Comandancia)`.trim();

            // 1. Obtener banner oficial de falta leve sargentos si existe
            let activeBanner = '';
            try {
                const banners = await getIASanctionBanners();
                activeBanner = banners?.leves_sargentos || '';
            } catch (e) {
                console.warn('Could not load IA banners:', e);
            }

            // 2. Guardar en Base de Datos de Sanciones (ia_published_sanctions)
            let dbSuccess = false;
            try {
                const { error: rpcErr } = await supabase.rpc('create_ia_published_sanction', {
                    p_sanction_type: 'leves_sargentos',
                    p_officer_name: sanctionForm.officerName.trim(),
                    p_officer_badge: sanctionForm.officerBadge.trim(),
                    p_officer_rank: sanctionForm.officerRank.trim(),
                    p_reason: sanctionForm.reason.trim(),
                    p_sanction_applied: sanctionForm.sanctionApplied.trim(),
                    p_sanctioner_name: sanctionerStr,
                    p_sanction_date: sanctionForm.sanctionDate || new Date().toISOString().split('T')[0],
                    p_evidence_url: sanctionForm.evidenceUrl.trim(),
                    p_notes: sanctionForm.notes.trim(),
                    p_banner_url: activeBanner,
                    p_discord_sent: sanctionForm.sendToDiscord
                });
                if (!rpcErr) dbSuccess = true;
            } catch (rpcE) {
                console.warn('RPC create_ia_published_sanction failed, fallbacking:', rpcE);
            }

            if (!dbSuccess) {
                // Fallback directo a tabla
                const { error: tblErr } = await supabase.from('ia_published_sanctions').insert([{
                    sanction_type: 'leves_sargentos',
                    officer_name: sanctionForm.officerName.trim(),
                    officer_badge: sanctionForm.officerBadge.trim(),
                    officer_rank: sanctionForm.officerRank.trim(),
                    reason: sanctionForm.reason.trim(),
                    sanction_applied: sanctionForm.sanctionApplied.trim(),
                    sanctioner_name: sanctionerStr,
                    sanction_date: sanctionForm.sanctionDate || new Date().toISOString().split('T')[0],
                    evidence_url: sanctionForm.evidenceUrl.trim(),
                    notes: sanctionForm.notes.trim(),
                    banner_url: activeBanner,
                    discord_sent: sanctionForm.sendToDiscord
                }]);
                if (tblErr) console.warn('Direct table insert fallback warning:', tblErr);
            }

            // 3. Enviar a Discord si está marcado
            if (sanctionForm.sendToDiscord) {
                const resDiscord = await sendIASanctionToDiscord({
                    sanctionType: 'leves_sargentos',
                    officerName: sanctionForm.officerName.trim(),
                    officerBadge: sanctionForm.officerBadge.trim(),
                    officerRank: sanctionForm.officerRank.trim(),
                    reason: sanctionForm.reason.trim(),
                    sanctionApplied: sanctionForm.sanctionApplied.trim(),
                    sanctionerName: sanctionerStr,
                    sanctionDate: sanctionForm.sanctionDate,
                    evidenceUrl: sanctionForm.evidenceUrl.trim(),
                    notes: sanctionForm.notes.trim(),
                    customBannerUrl: activeBanner,
                    author: profile,
                    forceSend: false
                });

                if (resDiscord && !resDiscord.success && !resDiscord.skipped) {
                    setSanctionError('Guardado en la base de datos de sanciones, pero falló el envío a Discord: ' + resDiscord.error);
                    return;
                }
            }

            setSanctionNotice('✅ ¡Falta leve de sargentos registrada con éxito en el apartado de sanciones!');
            setTimeout(() => {
                setShowSanctionModal(false);
                setSanctionNotice(null);
            }, 2500);
        } catch (err) {
            console.error('Error submitting sanction from Comandancia:', err);
            setSanctionError('Error al procesar la sanción: ' + err.message);
        } finally {
            setSubmittingSanction(false);
        }
    };

    const hasAccess = useMemo(() => {
        if (!profile) return false;
        const role = (profile.rol || '').trim();
        const roleLower = role.toLowerCase();
        const isAdmin = ['administrador', 'superadmin'].includes(roleLower);
        const isComisionado = roleLower === 'comisionado';
        const hasDivision = (profile.divisions && profile.divisions.includes('Comandancia')) ||
            (profile.subdivisions && profile.subdivisions.includes('Comandancia'));
        return isAdmin || isComisionado || hasDivision;
    }, [profile]);

    const handleDeleteFeedback = async (id) => {
        if (!window.confirm('¿Deseas eliminar definitivamente este registro de feedback?')) return;
        try {
            await supabase
                .from('agent_feedbacks')
                .delete()
                .eq('id', id);

            const filtered = feedbacks.filter(f => f.id !== id);
            setFeedbacks(filtered);

            await supabase.from('app_settings').upsert({
                key: 'agent_feedbacks',
                value: filtered,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

            // If an agent is open in modal, update selectedFichaAgent
            if (selectedFichaAgent) {
                setSelectedFichaAgent(prev => {
                    if (!prev) return null;
                    const cleanTarget = prev.name.trim().toLowerCase();
                    const relevantRec = filtered.filter(f => (f.target_name || f.target_agent_name || '').trim().toLowerCase() === cleanTarget);
                    const activeRec = relevantRec.filter(f => f.status !== 'Invalido');
                    const invalidRec = relevantRec.filter(f => f.status === 'Invalido');
                    const relevantSub = filtered.filter(f => (f.author_name || f.author_agent_name || '').trim().toLowerCase() === cleanTarget);
                    const activeSub = relevantSub.filter(f => f.status !== 'Invalido');

                    const pos = activeRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'positivo').length;
                    const neg = activeRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'negativo').length;
                    const mix = activeRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'mixto').length;

                    return {
                        ...prev,
                        receivedTotal: activeRec.length,
                        positivesReceived: pos,
                        negativesReceived: neg,
                        mixedReceived: mix,
                        netScore: pos - neg,
                        status: activeRec.length === 0 ? 'neutral' : pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral',
                        submittedTotal: activeSub.length,
                        feedbacksReceived: activeRec,
                        feedbacksSubmitted: activeSub,
                        feedbacksInvalid: invalidRec
                    };
                });
            }
        } catch (err) {
            console.error('Error deleting feedback:', err);
        }
    };

    const handleToggleInvalidFeedback = async (id) => {
        const fb = feedbacks.find(f => f.id === id);
        if (!fb) return;

        const isCurrentlyInvalid = fb.status === 'Invalido';
        const newStatus = isCurrentlyInvalid ? 'Activo' : 'Invalido';
        const confirmMsg = isCurrentlyInvalid
            ? '¿Deseas restaurar este feedback? Volverá a contar en el semáforo y estadísticas del agente.'
            : '¿Deseas marcar este feedback como INVÁLIDO?\n\nSe moverá a la carpeta de descarte y NO contará ni como positivo ni como negativo para el agente.';

        if (!window.confirm(confirmMsg)) return;

        try {
            const { error: updErr } = await supabase
                .from('agent_feedbacks')
                .update({ status: newStatus })
                .eq('id', id);

            if (updErr) {
                console.warn('Update status error in agent_feedbacks:', updErr);
            }

            const updatedFeedbacks = feedbacks.map(f => f.id === id ? { ...f, status: newStatus } : f);
            setFeedbacks(updatedFeedbacks);

            await supabase.from('app_settings').upsert({
                key: 'agent_feedbacks',
                value: updatedFeedbacks,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

            if (selectedFichaAgent) {
                setSelectedFichaAgent(prev => {
                    if (!prev) return null;
                    const cleanTarget = prev.name.trim().toLowerCase();
                    const relevantRec = updatedFeedbacks.filter(f => (f.target_name || f.target_agent_name || '').trim().toLowerCase() === cleanTarget);
                    const activeRec = relevantRec.filter(f => f.status !== 'Invalido');
                    const invalidRec = relevantRec.filter(f => f.status === 'Invalido');
                    const relevantSub = updatedFeedbacks.filter(f => (f.author_name || f.author_agent_name || '').trim().toLowerCase() === cleanTarget);
                    const activeSub = relevantSub.filter(f => f.status !== 'Invalido');

                    const pos = activeRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'positivo').length;
                    const neg = activeRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'negativo').length;
                    const mix = activeRec.filter(f => (f.tipo || f.feedback_type || '').toLowerCase() === 'mixto').length;

                    return {
                        ...prev,
                        receivedTotal: activeRec.length,
                        positivesReceived: pos,
                        negativesReceived: neg,
                        mixedReceived: mix,
                        netScore: pos - neg,
                        status: activeRec.length === 0 ? 'neutral' : pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral',
                        submittedTotal: activeSub.length,
                        feedbacksReceived: activeRec,
                        feedbacksSubmitted: activeSub,
                        feedbacksInvalid: invalidRec
                    };
                });
            }
        } catch (err) {
            console.error('Error toggling invalid status:', err);
            alert('Error al modificar estado del feedback: ' + err.message);
        }
    };

    const handleDeleteFicha = async (agentName) => {
        if (!agentName) return;
        const confirmDelete = window.confirm(
            `¿Estás seguro de que deseas eliminar por completo la ficha de "${agentName}"?\n\nEsta acción eliminará todos los feedbacks asociados a este agente y reiniciará su expediente en Comandancia.`
        );
        if (!confirmDelete) return;

        try {
            const cleanName = agentName.trim();
            const cleanNameLower = cleanName.toLowerCase();

            // 1. Delete from agent_feedbacks table where target_name matches
            await supabase
                .from('agent_feedbacks')
                .delete()
                .ilike('target_name', cleanName);

            // 2. Filter local feedbacks
            const updatedFeedbacks = feedbacks.filter(f => {
                const t = (f.target_name || f.target_agent_name || '').trim().toLowerCase();
                return t !== cleanNameLower;
            });
            setFeedbacks(updatedFeedbacks);

            // 3. Filter existingFichas
            const updatedFichas = existingFichas.filter(f => {
                const n = (f.agent_name || f.name || '').trim().toLowerCase();
                return n !== cleanNameLower;
            });
            setExistingFichas(updatedFichas);

            // 4. Update app_settings fallback
            await supabase.from('app_settings').upsert({
                key: 'agent_feedbacks',
                value: updatedFeedbacks,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

            if (selectedFichaAgent && selectedFichaAgent.name.trim().toLowerCase() === cleanNameLower) {
                setSelectedFichaAgent(null);
            }
        } catch (err) {
            console.error('Error deleting ficha:', err);
            alert('Error al eliminar la ficha: ' + err.message);
        }
    };

    const copyPublicFeedbackLink = () => {
        const link = `${window.location.origin}/feedback`;
        navigator.clipboard.writeText(link);
        setCopyNotice(true);
        setTimeout(() => setCopyNotice(false), 2500);
    };

    // Aggregate all agents into generic Fichas Evaluativas
    // REGLA: Los feedbacks con status === 'Invalido' NO cuentan ni como positivos ni como negativos
    const agentFeedbackAudit = useMemo(() => {
        const map = {};

        // Helper to register agent in map
        const ensureAgent = (rawName) => {
            const cleanName = (rawName || '').trim();
            if (!cleanName) return null;
            const key = cleanName.toLowerCase();
            if (!map[key]) {
                map[key] = {
                    id: key,
                    name: cleanName,
                    receivedTotal: 0,
                    positivesReceived: 0,
                    negativesReceived: 0,
                    mixedReceived: 0,
                    submittedTotal: 0,
                    positivesSubmitted: 0,
                    negativesSubmitted: 0,
                    mixedSubmitted: 0,
                    feedbacksReceived: [],
                    feedbacksSubmitted: [],
                    feedbacksInvalid: []
                };
            }
            return key;
        };

        // Populate from existing fichas
        existingFichas.forEach(f => {
            ensureAgent(f.agent_name);
        });

        // Group by feedbacks
        feedbacks.forEach(fb => {
            const rawTarget = fb.target_name || fb.target_agent_name || '';
            const targetKey = ensureAgent(rawTarget);
            const rawAuthor = fb.author_name || fb.author_agent_name || '';
            const authorKey = ensureAgent(rawAuthor);

            const isInvalid = fb.status === 'Invalido';
            const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();

            if (targetKey && map[targetKey]) {
                if (isInvalid) {
                    map[targetKey].feedbacksInvalid.push(fb);
                } else {
                    map[targetKey].receivedTotal += 1;
                    map[targetKey].feedbacksReceived.push(fb);
                    if (fbType === 'positivo') map[targetKey].positivesReceived += 1;
                    else if (fbType === 'negativo') map[targetKey].negativesReceived += 1;
                    else if (fbType === 'mixto') map[targetKey].mixedReceived += 1;
                }
            }

            if (authorKey && map[authorKey] && authorKey !== 'anónimo' && authorKey !== 'anonimo') {
                if (!isInvalid) {
                    map[authorKey].submittedTotal += 1;
                    map[authorKey].feedbacksSubmitted.push(fb);
                    if (fbType === 'positivo') map[authorKey].positivesSubmitted += 1;
                    else if (fbType === 'negativo') map[authorKey].negativesSubmitted += 1;
                    else if (fbType === 'mixto') map[authorKey].mixedSubmitted += 1;
                }
            }
        });

        return Object.values(map).map(entry => {
            const netScore = entry.positivesReceived - entry.negativesReceived;
            let status = 'neutral';
            if (entry.receivedTotal > 0) {
                if (entry.positivesReceived > entry.negativesReceived) status = 'positive';
                else if (entry.negativesReceived > entry.positivesReceived) status = 'negative';
            }

            let submittedTendency = 'Sin feedbacks puestos';
            if (entry.submittedTotal > 0) {
                if (entry.positivesSubmitted > entry.negativesSubmitted) {
                    submittedTendency = `Más positivos (+${entry.positivesSubmitted} vs -${entry.negativesSubmitted})`;
                } else if (entry.negativesSubmitted > entry.positivesSubmitted) {
                    submittedTendency = `Más negativos (-${entry.negativesSubmitted} vs +${entry.positivesSubmitted})`;
                } else {
                    submittedTendency = `Equilibrado (${entry.positivesSubmitted} / ${entry.negativesSubmitted})`;
                }
            }

            return {
                ...entry,
                netScore,
                status,
                submittedTendency
            };
        });
    }, [feedbacks, existingFichas]);

    const filteredAuditList = useMemo(() => {
        return agentFeedbackAudit
            .filter(item => {
                if (feedbackTypeFilter === 'Positivo' && item.positivesReceived === 0) return false;
                if (feedbackTypeFilter === 'Negativo' && item.negativesReceived === 0) return false;
                if (feedbackTypeFilter === 'Mixto' && item.mixedReceived === 0) return false;
                if (!feedbackSearch.trim()) return true;
                const term = feedbackSearch.toLowerCase();
                return item.name.toLowerCase().includes(term);
            })
            .sort((a, b) => (b.receivedTotal - a.receivedTotal) || (b.netScore - a.netScore));
    }, [agentFeedbackAudit, feedbackTypeFilter, feedbackSearch]);

    // Feedbacks activos para la vista Cronología
    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            if (f.status === 'Invalido') return false;
            const fType = (f.tipo || f.feedback_type || '').toLowerCase();
            const matchesType = feedbackTypeFilter === 'all' || fType === feedbackTypeFilter.toLowerCase();
            const matchesSearch = !feedbackSearch.trim() ||
                (f.author_name && f.author_name.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.target_name && f.target_name.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.motivo && f.motivo.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
                (f.reason && f.reason.toLowerCase().includes(feedbackSearch.toLowerCase()));
            return matchesType && matchesSearch;
        });
    }, [feedbacks, feedbackTypeFilter, feedbackSearch]);

    // Feedbacks inválidos para la carpeta separada
    const filteredInvalidFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            if (f.status !== 'Invalido') return false;
            if (!feedbackSearch.trim()) return true;
            const term = feedbackSearch.toLowerCase();
            return (f.author_name && f.author_name.toLowerCase().includes(term)) ||
                (f.target_name && f.target_name.toLowerCase().includes(term)) ||
                (f.motivo && f.motivo.toLowerCase().includes(term)) ||
                (f.reason && f.reason.toLowerCase().includes(term));
        });
    }, [feedbacks, feedbackSearch]);

    // KPIs: Solo cuentan los feedbacks válidos
    const feedbackKPIs = useMemo(() => {
        let positives = 0;
        let negatives = 0;
        let mixed = 0;
        let activeTotal = 0;
        let invalidCount = 0;

        feedbacks.forEach(f => {
            if (f.status === 'Invalido') {
                invalidCount++;
                return;
            }
            activeTotal++;
            const t = (f.tipo || f.feedback_type || '').toLowerCase();
            if (t === 'positivo') positives++;
            else if (t === 'negativo') negatives++;
            else if (t === 'mixto') mixed++;
        });

        return {
            total: activeTotal,
            invalidCount,
            positives,
            negatives,
            mixed,
            netBalance: positives - negatives
        };
    }, [feedbacks]);

    if (loading) {
        return (
            <div className="mac-dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
                <div className="mac-doc-card" style={{ padding: '2.5rem 3.5rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="mac-status-dot" style={{ backgroundColor: '#f59e0b', margin: '0 auto 1.2rem auto', width: '12px', height: '12px', boxShadow: '0 0 12px #f59e0b' }}></div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '-0.01em' }}>Verificando credenciales de Comandancia...</div>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="mac-dashboard-container" style={{ maxWidth: '640px', margin: '3rem auto' }}>
                <div className="mac-command-banner" style={{
                    flexDirection: 'column',
                    textAlign: 'center',
                    padding: '2.5rem',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(15, 23, 42, 0.95))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="mac-status-dot" style={{ backgroundColor: '#ef4444' }}></span>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>Acceso Restringido</h2>
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                        Este módulo está reservado exclusivamente para la <strong>Comandancia</strong>, <strong>Comisionado</strong> y <strong>Administradores</strong> del sistema.
                    </p>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="login-button btn-secondary"
                        style={{ width: 'auto', padding: '0.6rem 1.6rem', margin: '0 auto' }}
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mac-dashboard-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem' }}>
            {/* Header Banner - Apple macOS Style */}
            <div className="mac-command-banner" style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(59, 130, 246, 0.12) 50%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '24px',
                padding: '2rem 2.25rem',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                marginBottom: '1.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '18px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(59, 130, 246, 0.35))',
                            border: '1px solid rgba(16, 185, 129, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)'
                        }}>
                            🏛️
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    color: '#6ee7b7',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(16, 185, 129, 0.35)'
                                }}>
                                    Despacho de Comandancia
                                </span>
                                <span className="mac-status-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Supervisión de Desempeño</span>
                            </div>
                            <h1 style={{ margin: '0.35rem 0 0.2rem 0', fontSize: '1.75rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                Feedbacks de Agentes • Comandancia
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                                Auditoría centralizada de feedbacks, fichas evaluativas y balance de conducta departamental.
                            </p>
                        </div>
                    </div>

                    {/* Active Officer Identity Card */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0.65rem 1.1rem',
                        borderRadius: '14px',
                        backdropFilter: 'blur(16px)'
                    }}>
                        {profile?.profile_image ? (
                            <img
                                src={profile.profile_image}
                                alt="Mando"
                                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(16, 185, 129, 0.5)' }}
                            />
                        ) : (
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyCenter: 'center',
                                fontSize: '1.1rem',
                                color: '#6ee7b7',
                                fontWeight: 800
                            }}>
                                🎖️
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                {profile?.no_placa ? `[#${profile.no_placa}] ` : ''}{profile?.nombre} {profile?.apellido}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600 }}>
                                {profile?.rango || 'Alto Mando'} • {profile?.rol}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* THE ONLY COUNTER: Feedbacks de Agentes & Breakdown */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '20px',
                padding: '1.5rem',
                marginBottom: '1.75rem',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(16px)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem'
                        }}>
                            💬
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#6ee7b7', letterSpacing: '0.08em' }}>
                                Indicador Oficial de Comandancia
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc' }}>
                                Feedbacks de Agentes ({feedbackKPIs.total} Total)
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setShowWebhookModal(true)}
                            style={{
                                background: 'rgba(99, 102, 241, 0.16)',
                                border: '1px solid rgba(129, 140, 248, 0.38)',
                                color: '#c7d2fe',
                                borderRadius: '10px',
                                padding: '0.55rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                transition: 'all 0.15s ease'
                            }}
                            title="Configurar webhook para que los nuevos feedbacks se envíen a un canal de Discord"
                        >
                            <span>🔔</span>
                            <span>Webhook Discord (Feedbacks)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/internal-affairs/sanctions')}
                            style={{
                                background: 'rgba(234, 179, 8, 0.16)',
                                border: '1px solid rgba(250, 204, 21, 0.42)',
                                color: '#fef08a',
                                borderRadius: '10px',
                                padding: '0.55rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                transition: 'all 0.15s ease'
                            }}
                            title="Ir al apartado de sanciones para registrar y consultar faltas de sargentos y expedientes"
                        >
                            <span>⚖️</span>
                            <span>Registrar falta de sargentos</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => window.open('/feedback', '_blank')}
                            className="personnel-add-btn"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 800,
                                gap: '8px',
                                padding: '0.55rem 1.1rem',
                                borderRadius: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            <span>✍️</span>
                            <span>Rellenar Nuevo Feedback ↗</span>
                        </button>

                        <button
                            type="button"
                            onClick={copyPublicFeedbackLink}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.18)',
                                color: '#f8fafc',
                                borderRadius: '10px',
                                padding: '0.55rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>🔗</span>
                            <span>{copyNotice ? '¡Enlace Copiado!' : 'Copiar Formulario'}</span>
                        </button>
                    </div>
                </div>

                {/* Counter Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.28)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase' }}>
                            🌟 Positivos
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4ade80', marginTop: '0.25rem' }}>
                            {feedbackKPIs.positives}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Reconocimientos de labor
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.28)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 800, textTransform: 'uppercase' }}>
                            ⚠️ Negativos
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f87171', marginTop: '0.25rem' }}>
                            {feedbackKPIs.negatives}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Observaciones de conducta
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.28)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 800, textTransform: 'uppercase' }}>
                            ⚖️ Mixtos
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#facc15', marginTop: '0.25rem' }}>
                            {feedbackKPIs.mixed}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Aspectos neutros / mixtos
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '14px',
                        padding: '1rem 1.1rem'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 800, textTransform: 'uppercase' }}>
                            📊 Balance Neto
                        </div>
                        <div style={{
                            fontSize: '1.75rem',
                            fontWeight: 900,
                            color: feedbackKPIs.netBalance >= 0 ? '#4ade80' : '#f87171',
                            marginTop: '0.25rem'
                        }}>
                            {feedbackKPIs.netBalance > 0 ? `+${feedbackKPIs.netBalance}` : feedbackKPIs.netBalance}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            {feedbackKPIs.netBalance >= 0 ? 'Balance positivo' : 'Balance deficitario'}
                        </div>
                    </div>

                    {/* Invalid / Descartados Folder KPI Card */}
                    <div
                        onClick={() => setFeedbackSubView('invalid')}
                        style={{
                            background: feedbackSubView === 'invalid' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.55)',
                            border: feedbackSubView === 'invalid' ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            padding: '1rem 1.1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        title="Click para ver la carpeta de feedbacks descartados/inválidos"
                    >
                        <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            📁 Descartados / Inválidos
                        </div>
                        <div style={{
                            fontSize: '1.75rem',
                            fontWeight: 900,
                            color: feedbackKPIs.invalidCount > 0 ? '#f87171' : '#94a3b8',
                            marginTop: '0.25rem'
                        }}>
                            {feedbackKPIs.invalidCount}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            No computan en estadísticas ↗
                        </div>
                    </div>
                </div>
            </div>

            {/* FEEDBACK CONTROLS & SUB-VIEWS */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '1.5rem',
                backdropFilter: 'blur(20px)'
            }}>
                {/* Subview Selector & Filters */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '1.25rem'
                }}>
                    {/* Subview tabs: Auditoría por Agente vs Cronología vs Carpeta Inválidos */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setFeedbackSubView('audit')}
                            style={{
                                background: feedbackSubView === 'audit' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                                border: feedbackSubView === 'audit' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                                color: feedbackSubView === 'audit' ? '#6ee7b7' : '#94a3b8',
                                borderRadius: '8px',
                                padding: '0.45rem 1rem',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>🚦</span>
                            <span>Auditoría por Agente ({filteredAuditList.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFeedbackSubView('timeline')}
                            style={{
                                background: feedbackSubView === 'timeline' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                                border: feedbackSubView === 'timeline' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                                color: feedbackSubView === 'timeline' ? '#6ee7b7' : '#94a3b8',
                                borderRadius: '8px',
                                padding: '0.45rem 1rem',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>📜</span>
                            <span>Cronología Activa ({filteredFeedbacks.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFeedbackSubView('invalid')}
                            style={{
                                background: feedbackSubView === 'invalid' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                                border: feedbackSubView === 'invalid' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
                                color: feedbackSubView === 'invalid' ? '#fca5a5' : '#94a3b8',
                                borderRadius: '8px',
                                padding: '0.45rem 1rem',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>📁</span>
                            <span>Carpeta de Inválidos ({filteredInvalidFeedbacks.length})</span>
                        </button>
                    </div>

                    {/* Search & Type filter */}
                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', flex: 1, maxWidth: '520px', justifyContent: 'flex-end' }}>
                        <input
                            type="text"
                            placeholder={feedbackSubView === 'audit' ? 'Filtrar por nombre de agente...' : feedbackSubView === 'invalid' ? 'Buscar en feedbacks descartados...' : 'Buscar por agente, emisor o motivo...'}
                            value={feedbackSearch}
                            onChange={(e) => setFeedbackSearch(e.target.value)}
                            className="form-input"
                            style={{
                                flex: 1,
                                minWidth: '180px',
                                background: 'rgba(15, 23, 42, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '10px',
                                padding: '0.45rem 0.85rem',
                                color: '#ffffff',
                                fontSize: '0.82rem'
                            }}
                        />

                        {feedbackSubView !== 'invalid' && (
                            <select
                                value={feedbackTypeFilter}
                                onChange={(e) => setFeedbackTypeFilter(e.target.value)}
                                className="form-input custom-select"
                                style={{
                                    width: 'auto',
                                    background: 'rgba(15, 23, 42, 0.65)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '10px',
                                    padding: '0.45rem 0.85rem',
                                    color: '#ffffff',
                                    fontSize: '0.82rem'
                                }}
                            >
                                <option value="all">Todos los tipos</option>
                                <option value="Positivo">🌟 Solo Positivos</option>
                                <option value="Negativo">⚠️ Solo Negativos</option>
                                <option value="Mixto">⚖️ Solo Mixtos</option>
                            </select>
                        )}
                    </div>
                </div>

                {/* SUBVIEW 1: AUDITORÍA POR AGENTE (GENERIC FICHAS) */}
                {feedbackSubView === 'audit' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredAuditList.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 2rem',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: '16px',
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No se encontraron agentes con feedbacks</div>
                                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Modifica la búsqueda o registra nuevos feedbacks para comenzar la auditoría.</div>
                            </div>
                        ) : (
                            filteredAuditList.map(entry => {
                                const isGreen = entry.status === 'positive';
                                const isRed = entry.status === 'negative';

                                const semaforoBg = isGreen
                                    ? 'rgba(16, 185, 129, 0.08)'
                                    : isRed
                                        ? 'rgba(239, 68, 68, 0.08)'
                                        : 'rgba(30, 41, 59, 0.5)';
                                const semaforoBorder = isGreen
                                    ? 'rgba(16, 185, 129, 0.35)'
                                    : isRed
                                        ? 'rgba(239, 68, 68, 0.35)'
                                        : 'rgba(255, 255, 255, 0.1)';

                                return (
                                    <div
                                        key={entry.id}
                                        style={{
                                            background: semaforoBg,
                                            border: `1px solid ${semaforoBorder}`,
                                            borderRadius: '16px',
                                            padding: '1.1rem 1.35rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '1rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {/* Agent Generic Identity */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                                            <div style={{
                                                width: '46px',
                                                height: '46px',
                                                borderRadius: '14px',
                                                background: isGreen
                                                    ? 'rgba(16, 185, 129, 0.2)'
                                                    : isRed
                                                        ? 'rgba(239, 68, 68, 0.2)'
                                                        : 'rgba(255, 255, 255, 0.08)',
                                                border: `1px solid ${isGreen ? 'rgba(16, 185, 129, 0.4)' : isRed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 900,
                                                fontSize: '1.15rem',
                                                color: isGreen ? '#4ade80' : isRed ? '#f87171' : '#cbd5e1'
                                            }}>
                                                {entry.name.charAt(0).toUpperCase()}
                                            </div>

                                            <div>
                                                <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>
                                                    {entry.name}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        fontSize: '0.7rem',
                                                        color: '#cbd5e1'
                                                    }}>
                                                        Ficha Evaluativa
                                                    </span>
                                                    <span>•</span>
                                                    <span style={{ color: isGreen ? '#4ade80' : isRed ? '#f87171' : '#cbd5e1' }}>
                                                        Balance: {entry.netScore > 0 ? `+${entry.netScore}` : entry.netScore}
                                                    </span>
                                                    {entry.feedbacksInvalid && entry.feedbacksInvalid.length > 0 && (
                                                        <span style={{ color: '#f87171', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.12)', padding: '1px 6px', borderRadius: '4px' }}>
                                                            📁 {entry.feedbacksInvalid.length} descartados
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Feedbacks Recibidos (Semáforo Verde / Rojo) */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ textAlign: 'center', minWidth: '160px' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    Feedbacks Recibidos
                                                </div>
                                                <div style={{
                                                    marginTop: '4px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '3px 10px',
                                                    borderRadius: '8px',
                                                    fontWeight: 800,
                                                    fontSize: '0.82rem',
                                                    background: isGreen ? 'rgba(16, 185, 129, 0.18)' : isRed ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                                                    color: isGreen ? '#4ade80' : isRed ? '#f87171' : '#cbd5e1',
                                                    border: `1px solid ${isGreen ? 'rgba(16, 185, 129, 0.4)' : isRed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`
                                                }}>
                                                    <span>{isGreen ? '🟢' : isRed ? '🔴' : '⚪'}</span>
                                                    <span>{entry.receivedTotal} Válidos ({entry.positivesReceived} pos / {entry.negativesReceived} neg)</span>
                                                </div>
                                            </div>

                                            {/* Feedbacks Puestos (Emisor) */}
                                            <div style={{ textAlign: 'center', minWidth: '150px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '12px' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    Feedbacks Emitidos
                                                </div>
                                                <div style={{
                                                    marginTop: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    color: entry.submittedTotal > 0 ? '#38bdf8' : '#64748b'
                                                }}>
                                                    {entry.submittedTotal} emitidos • {entry.submittedTendency}
                                                </div>
                                            </div>

                                            {/* Action Buttons: Ver Ficha & Borrar Ficha */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedFichaAgent(entry);
                                                        setModalFichaTab('received');
                                                    }}
                                                    style={{
                                                        background: 'rgba(16, 185, 129, 0.18)',
                                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        color: '#6ee7b7',
                                                        borderRadius: '10px',
                                                        padding: '0.55rem 1.1rem',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                                    }}
                                                >
                                                    <span>📋</span>
                                                    <span>Ver Ficha</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteFicha(entry.name)}
                                                    title="Eliminar por completo la ficha y todos sus feedbacks"
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.12)',
                                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                                        color: '#f87171',
                                                        borderRadius: '10px',
                                                        padding: '0.55rem 0.85rem',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}
                                                >
                                                    <span>🗑️</span>
                                                    <span>Borrar Ficha</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* SUBVIEW 2: REGISTRO CRONOLÓGICO ACTIVO */}
                {feedbackSubView === 'timeline' && (
                    <div>
                        {filteredFeedbacks.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 2rem',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: '16px',
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No hay feedbacks activos registrados con esos criterios</div>
                                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Intenta limpiar los filtros o rellenar un nuevo informe de feedback.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredFeedbacks.map(fb => {
                                    const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                    const isPos = fbType === 'positivo';
                                    const isNeg = fbType === 'negativo';
                                    const pillColor = isPos ? '#4ade80' : isNeg ? '#f87171' : '#facc15';
                                    const pillBg = isPos ? 'rgba(16, 185, 129, 0.15)' : isNeg ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                    const pillBorder = isPos ? 'rgba(16, 185, 129, 0.35)' : isNeg ? 'rgba(239, 68, 68, 0.35)' : 'rgba(234, 179, 8, 0.35)';

                                    const targetName = fb.target_name || fb.target_agent_name || 'Agente';
                                    const authorName = fb.author_name || fb.author_agent_name || 'Anónimo';
                                    const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                    const reasonText = fb.motivo || fb.reason || '';

                                    return (
                                        <div
                                            key={fb.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.75)',
                                                border: `1px solid ${pillBorder}`,
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                                                maxWidth: '100%',
                                                overflow: 'hidden',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        color: pillColor,
                                                        background: pillBg,
                                                        padding: '3px 10px',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${pillBorder}`
                                                    }}>
                                                        {isPos ? '🌟 Positivo' : isNeg ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        Fecha: {dateStr}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleInvalidFeedback(fb.id)}
                                                        title="Mover a la carpeta de descartados/inválidos (no cuenta en estadísticas)"
                                                        style={{
                                                            background: 'rgba(234, 179, 8, 0.12)',
                                                            border: '1px solid rgba(234, 179, 8, 0.35)',
                                                            color: '#facc15',
                                                            fontSize: '0.72rem',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <span>📁</span>
                                                        <span>Marcar Inválido</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFeedback(fb.id)}
                                                        title="Eliminar este feedback definitivamente"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.12)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            color: '#f87171',
                                                            fontSize: '0.72rem',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <span>🗑️</span>
                                                        <span>Eliminar</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.85rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                                                <div>
                                                    <span style={{ color: '#94a3b8' }}>Agente Evaluado: </span>
                                                    <strong style={{ color: '#f8fafc' }}>{targetName}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#94a3b8' }}>Emitido por: </span>
                                                    <strong style={{ color: '#cbd5e1' }}>{authorName}</strong>
                                                </div>
                                            </div>

                                            <div style={{
                                                background: 'rgba(0, 0, 0, 0.35)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '10px',
                                                padding: '0.9rem',
                                                color: '#e2e8f0',
                                                fontSize: '0.88rem',
                                                lineHeight: 1.6,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-all',
                                                overflowWrap: 'anywhere',
                                                width: '100%',
                                                minWidth: 0,
                                                maxWidth: '100%',
                                                boxSizing: 'border-box'
                                            }}>
                                                {reasonText}
                                            </div>

                                            <FeedbackReactionsBar
                                                feedbackId={fb.id}
                                                reactions={feedbackReactions[fb.id]}
                                                currentUserId={profile?.id}
                                                onToggle={(type) => handleToggleReaction(fb.id, type)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* SUBVIEW 3: CARPETA DE FEEDBACKS INVÁLIDOS / DESCARTADOS */}
                {feedbackSubView === 'invalid' && (
                    <div>
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '14px',
                            padding: '1rem 1.25rem',
                            marginBottom: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <span>📁</span>
                                    <span>Carpeta de Feedbacks Inválidos y Descartados</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                    Estos informes están apartados: <strong>NO computan como positivos ni negativos</strong> en los semáforos ni en los expedientes de los agentes.
                                </div>
                            </div>

                            <span style={{
                                fontSize: '0.75rem',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#fca5a5',
                                fontWeight: 800
                            }}>
                                {filteredInvalidFeedbacks.length} descartados
                            </span>
                        </div>

                        {filteredInvalidFeedbacks.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 2rem',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: '16px',
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No hay feedbacks marcados como inválidos</div>
                                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                    Cuando marques un feedback como inválido desde la cronología o la ficha de un agente, se archivará aquí automáticamente.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredInvalidFeedbacks.map(fb => {
                                    const targetName = fb.target_name || fb.target_agent_name || 'Agente';
                                    const authorName = fb.author_name || fb.author_agent_name || 'Anónimo';
                                    const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                    const reasonText = fb.motivo || fb.reason || '';

                                    return (
                                        <div
                                            key={fb.id}
                                            style={{
                                                background: 'rgba(30, 41, 59, 0.4)',
                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                                                maxWidth: '100%',
                                                overflow: 'hidden',
                                                boxSizing: 'border-box',
                                                opacity: 0.9
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        color: '#fca5a5',
                                                        background: 'rgba(239, 68, 68, 0.18)',
                                                        padding: '3px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        🚫 Inválido / Neutralizado ({fb.tipo || 'Feedback'})
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        Fecha: {dateStr}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleInvalidFeedback(fb.id)}
                                                        title="Restaurar feedback para que vuelva a contar normalmente"
                                                        style={{
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            border: '1px solid rgba(16, 185, 129, 0.35)',
                                                            color: '#6ee7b7',
                                                            fontSize: '0.72rem',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <span>↩️</span>
                                                        <span>Restaurar Feedback</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteFeedback(fb.id)}
                                                        title="Eliminar este feedback definitivamente"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: '1px solid rgba(239, 68, 68, 0.35)',
                                                            color: '#f87171',
                                                            fontSize: '0.72rem',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <span>🗑️</span>
                                                        <span>Eliminar</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.85rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                                                <div>
                                                    <span style={{ color: '#94a3b8' }}>Agente Afectado: </span>
                                                    <strong style={{ color: '#f8fafc' }}>{targetName}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#94a3b8' }}>Emitido por: </span>
                                                    <strong style={{ color: '#cbd5e1' }}>{authorName}</strong>
                                                </div>
                                            </div>

                                            <div style={{
                                                background: 'rgba(0, 0, 0, 0.25)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                borderRadius: '10px',
                                                padding: '0.9rem',
                                                color: '#cbd5e1',
                                                fontSize: '0.86rem',
                                                lineHeight: 1.55,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-all',
                                                overflowWrap: 'anywhere',
                                                fontStyle: 'italic'
                                            }}>
                                                {reasonText}
                                            </div>

                                            <FeedbackReactionsBar
                                                feedbackId={fb.id}
                                                reactions={feedbackReactions[fb.id]}
                                                currentUserId={profile?.id}
                                                onToggle={(type) => handleToggleReaction(fb.id, type)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GENERIC FICHA EVALUATIVA MODAL (Dedicated Self-Contained Ficha in Comandancia) */}
            {selectedFichaAgent && (
                <div className="mac-modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem'
                }}>
                    <div className="mac-modal-content custom-scrollbar" style={{
                        maxWidth: '1100px',
                        width: '92vw',
                        height: '88vh',
                        maxHeight: '88vh',
                        boxSizing: 'border-box',
                        background: 'rgba(15, 23, 42, 0.98)',
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        borderRadius: '20px',
                        padding: '1.25rem 1.6rem',
                        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(30px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header (Compact) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '12px',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.3rem',
                                    fontWeight: 900,
                                    color: '#4ade80',
                                    flexShrink: 0
                                }}>
                                    {selectedFichaAgent.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#6ee7b7', letterSpacing: '0.08em' }}>
                                        Ficha Evaluativa de Comandancia
                                    </div>
                                    <h2 style={{ margin: '1px 0 0 0', fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>
                                        {selectedFichaAgent.name}
                                    </h2>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedFichaAgent(null)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#94a3b8',
                                    borderRadius: '8px',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    flexShrink: 0
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Semáforo & Metrics Bar (Ultra Compact Single Row) */}
                        <div style={{
                            background: selectedFichaAgent.status === 'positive'
                                ? 'rgba(16, 185, 129, 0.08)'
                                : selectedFichaAgent.status === 'negative'
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : 'rgba(30, 41, 59, 0.45)',
                            border: `1px solid ${selectedFichaAgent.status === 'positive' ? 'rgba(16, 185, 129, 0.3)' : selectedFichaAgent.status === 'negative' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: '12px',
                            padding: '0.55rem 0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                            flexShrink: 0
                        }}>
                            {/* Dictamen */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>
                                    {selectedFichaAgent.status === 'positive' ? '🟢' : selectedFichaAgent.status === 'negative' ? '🔴' : '⚪'}
                                </span>
                                <div>
                                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Dictamen
                                    </div>
                                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>
                                        {selectedFichaAgent.status === 'positive'
                                            ? 'Desempeño Favorable'
                                            : selectedFichaAgent.status === 'negative'
                                                ? 'Atención Requerida'
                                                : 'Neutral / Sin Desviación'}
                                    </div>
                                </div>
                            </div>

                            {/* Metric Badges inline */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#86efac', fontWeight: 800 }}>POSITIVOS</span>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#4ade80' }}>{selectedFichaAgent.positivesReceived}</span>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#fca5a5', fontWeight: 800 }}>NEGATIVOS</span>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f87171' }}>{selectedFichaAgent.negativesReceived}</span>
                                </div>
                                <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#fde047', fontWeight: 800 }}>MIXTOS</span>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#facc15' }}>{selectedFichaAgent.mixedReceived}</span>
                                </div>
                                <div style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '8px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#cbd5e1', fontWeight: 800 }}>TOTAL</span>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f1f5f9' }}>{selectedFichaAgent.receivedTotal}</span>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800 }}>BALANCE</span>
                                    <span style={{
                                        fontSize: '0.92rem',
                                        fontWeight: 900,
                                        color: selectedFichaAgent.netScore >= 0 ? '#4ade80' : '#f87171'
                                    }}>
                                        {selectedFichaAgent.netScore > 0 ? `+${selectedFichaAgent.netScore}` : selectedFichaAgent.netScore}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Tabs: Feedbacks Recibidos vs Feedbacks Emitidos vs Descartados */}
                        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.45rem', flexShrink: 0, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setModalFichaTab('received')}
                                style={{
                                    background: modalFichaTab === 'received' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    border: modalFichaTab === 'received' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                    color: modalFichaTab === 'received' ? '#6ee7b7' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.35rem 0.85rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Informes Recibidos ({selectedFichaAgent.feedbacksReceived.length})
                            </button>

                            <button
                                type="button"
                                onClick={() => setModalFichaTab('submitted')}
                                style={{
                                    background: modalFichaTab === 'submitted' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                    border: modalFichaTab === 'submitted' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                    color: modalFichaTab === 'submitted' ? '#6ee7b7' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.35rem 0.85rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Informes Emitidos ({selectedFichaAgent.feedbacksSubmitted.length})
                            </button>

                            <button
                                type="button"
                                onClick={() => setModalFichaTab('invalid')}
                                style={{
                                    background: modalFichaTab === 'invalid' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                                    border: modalFichaTab === 'invalid' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent',
                                    color: modalFichaTab === 'invalid' ? '#fde047' : '#94a3b8',
                                    borderRadius: '8px',
                                    padding: '0.35rem 0.85rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                📁 Descartados / Inválidos ({(selectedFichaAgent.feedbacksInvalid || []).length})
                            </button>
                        </div>

                        {/* Feedbacks Scrollable List (Flexible 100% Height, Clamped to 4 lines, Click to Expand) */}
                        <div
                            className="custom-scrollbar"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem',
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                width: '100%',
                                minWidth: 0,
                                boxSizing: 'border-box',
                                paddingRight: '8px',
                                overscrollBehavior: 'contain'
                            }}
                        >
                            {modalFichaTab === 'received' ? (
                                selectedFichaAgent.feedbacksReceived.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                        No hay informes de feedback válidos recibidos para este agente.
                                    </div>
                                ) : (
                                    selectedFichaAgent.feedbacksReceived.map(fb => {
                                        const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                        const isP = fbType === 'positivo';
                                        const isN = fbType === 'negativo';
                                        const badgeBg = isP ? 'rgba(34, 197, 94, 0.15)' : isN ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                        const badgeColor = isP ? '#4ade80' : isN ? '#f87171' : '#facc15';
                                        const badgeBorder = isP ? 'rgba(34, 197, 94, 0.3)' : isN ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)';
                                        const authorName = fb.author_name || fb.author_agent_name || 'Anónimo';
                                        const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                        const reason = fb.motivo || fb.reason || '';
                                        const isExpanded = Boolean(expandedFeedbacks[fb.id]);

                                        return (
                                            <div
                                                key={fb.id}
                                                onClick={() => toggleFeedbackExpand(fb.id)}
                                                style={{
                                                    background: isExpanded ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.025)',
                                                    border: isExpanded ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '10px',
                                                    padding: '0.7rem 0.95rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px',
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    flexShrink: 0,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={isExpanded ? 'Click para contraer' : 'Click para expandir'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', width: '100%', minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: badgeBg,
                                                            color: badgeColor,
                                                            border: `1px solid ${badgeBorder}`,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {isP ? '🌟 Positivo' : isN ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                        </span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                            Por: {authorName}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                            {dateStr}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleInvalidFeedback(fb.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(234, 179, 8, 0.15)',
                                                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                color: '#facc15',
                                                                borderRadius: '6px',
                                                                padding: '2px 7px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Marcar como inválido / descartar (no contará en semáforo ni puntuación)"
                                                        >
                                                            📁 Invalidar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteFeedback(fb.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                                color: '#f87171',
                                                                borderRadius: '6px',
                                                                padding: '2px 7px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Eliminar este feedback permanentemente"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                        <span style={{ fontSize: '0.68rem', color: isExpanded ? '#34d399' : '#64748b' }}>
                                                            {isExpanded ? '▲ Contraer' : '▼ Expandir'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.84rem',
                                                    color: '#cbd5e1',
                                                    lineHeight: 1.45,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'anywhere',
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    ...(isExpanded ? {} : {
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 4,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    })
                                                }}>
                                                    {reason}
                                                </div>

                                                <FeedbackReactionsBar
                                                    feedbackId={fb.id}
                                                    reactions={feedbackReactions[fb.id]}
                                                    currentUserId={profile?.id}
                                                    onToggle={(type) => handleToggleReaction(fb.id, type)}
                                                />
                                            </div>
                                        );
                                    })
                                )
                            ) : modalFichaTab === 'submitted' ? (
                                selectedFichaAgent.feedbacksSubmitted.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                        Este oficial no ha emitido ningún feedback a otros compañeros.
                                    </div>
                                ) : (
                                    selectedFichaAgent.feedbacksSubmitted.map(fb => {
                                        const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                        const isP = fbType === 'positivo';
                                        const isN = fbType === 'negativo';
                                        const badgeBg = isP ? 'rgba(34, 197, 94, 0.15)' : isN ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                        const badgeColor = isP ? '#4ade80' : isN ? '#f87171' : '#facc15';
                                        const targetName = fb.target_name || fb.target_agent_name || 'Agente';
                                        const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                        const reason = fb.motivo || fb.reason || '';
                                        const isExpanded = Boolean(expandedFeedbacks[fb.id]);

                                        return (
                                            <div
                                                key={fb.id}
                                                onClick={() => toggleFeedbackExpand(fb.id)}
                                                style={{
                                                    background: isExpanded ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.025)',
                                                    border: isExpanded ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '10px',
                                                    padding: '0.7rem 0.95rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px',
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    flexShrink: 0,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={isExpanded ? 'Click para contraer' : 'Click para expandir'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', width: '100%', minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: badgeBg,
                                                            color: badgeColor
                                                        }}>
                                                            {isP ? '🌟 Positivo' : isN ? '⚠️ Negativo' : '⚖️ Mixto'}
                                                        </span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                            Hacia: {targetName}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                            {dateStr}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleInvalidFeedback(fb.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(234, 179, 8, 0.15)',
                                                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                color: '#facc15',
                                                                borderRadius: '6px',
                                                                padding: '2px 7px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Marcar como inválido / descartar (no contará en semáforo ni puntuación)"
                                                        >
                                                            📁 Invalidar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteFeedback(fb.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                                color: '#f87171',
                                                                borderRadius: '6px',
                                                                padding: '2px 7px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Eliminar este feedback permanentemente"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                        <span style={{ fontSize: '0.68rem', color: isExpanded ? '#34d399' : '#64748b' }}>
                                                            {isExpanded ? '▲ Contraer' : '▼ Expandir'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.84rem',
                                                    color: '#cbd5e1',
                                                    lineHeight: 1.45,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'anywhere',
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    ...(isExpanded ? {} : {
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 4,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    })
                                                }}>
                                                    {reason}
                                                </div>

                                                <FeedbackReactionsBar
                                                    feedbackId={fb.id}
                                                    reactions={feedbackReactions[fb.id]}
                                                    currentUserId={profile?.id}
                                                    onToggle={(type) => handleToggleReaction(fb.id, type)}
                                                />
                                            </div>
                                        );
                                    })
                                )
                            ) : (
                                (selectedFichaAgent.feedbacksInvalid || []).length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                        No hay feedbacks descartados ni inválidos para este agente.
                                    </div>
                                ) : (
                                    (selectedFichaAgent.feedbacksInvalid || []).map(fb => {
                                        const fbType = (fb.tipo || fb.feedback_type || 'Positivo').toLowerCase();
                                        const isP = fbType === 'positivo';
                                        const isN = fbType === 'negativo';
                                        const badgeBg = isP ? 'rgba(34, 197, 94, 0.15)' : isN ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                                        const badgeColor = isP ? '#4ade80' : isN ? '#f87171' : '#facc15';
                                        const authorName = fb.author_name || fb.author_agent_name || 'Anónimo';
                                        const dateStr = fb.fecha || (fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '');
                                        const reason = fb.motivo || fb.reason || '';
                                        const isExpanded = Boolean(expandedFeedbacks[fb.id]);

                                        return (
                                            <div
                                                key={fb.id}
                                                onClick={() => toggleFeedbackExpand(fb.id)}
                                                style={{
                                                    background: 'rgba(234, 179, 8, 0.04)',
                                                    border: '1px dashed rgba(234, 179, 8, 0.35)',
                                                    borderRadius: '10px',
                                                    padding: '0.7rem 0.95rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px',
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    flexShrink: 0,
                                                    cursor: 'pointer',
                                                    opacity: 0.9,
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={isExpanded ? 'Click para contraer' : 'Click para expandir'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', width: '100%', minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: 'rgba(234, 179, 8, 0.2)',
                                                            color: '#facc15',
                                                            border: '1px solid rgba(234, 179, 8, 0.4)'
                                                        }}>
                                                            📁 INVÁLIDO / DESCARTADO
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            fontWeight: 800,
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            background: badgeBg,
                                                            color: badgeColor,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {isP ? 'Positivo' : isN ? 'Negativo' : 'Mixto'}
                                                        </span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                            Por: {authorName}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                            {dateStr}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleInvalidFeedback(fb.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(52, 211, 153, 0.15)',
                                                                border: '1px solid rgba(52, 211, 153, 0.35)',
                                                                color: '#34d399',
                                                                borderRadius: '6px',
                                                                padding: '2px 8px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Restaurar este feedback como válido para que cuente en el semáforo y estadísticas"
                                                        >
                                                            ↩️ Restaurar Válido
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteFeedback(fb.id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                                color: '#f87171',
                                                                borderRadius: '6px',
                                                                padding: '2px 8px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Eliminar este feedback definitivamente"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                        <span style={{ fontSize: '0.68rem', color: isExpanded ? '#34d399' : '#64748b' }}>
                                                            {isExpanded ? '▲ Contraer' : '▼ Expandir'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.84rem',
                                                    color: '#cbd5e1',
                                                    lineHeight: 1.45,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'anywhere',
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    boxSizing: 'border-box',
                                                    ...(isExpanded ? {} : {
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 4,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    })
                                                }}>
                                                    {reason}
                                                </div>

                                                <FeedbackReactionsBar
                                                    feedbackId={fb.id}
                                                    reactions={feedbackReactions[fb.id]}
                                                    currentUserId={profile?.id}
                                                    onToggle={(type) => handleToggleReaction(fb.id, type)}
                                                />
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>

                        {/* Modal Footer (Compact) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.65rem', flexWrap: 'wrap', gap: '10px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.open(`/feedback?target=${encodeURIComponent(selectedFichaAgent.name)}`, '_blank');
                                    }}
                                    style={{
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.35)',
                                        color: '#6ee7b7',
                                        borderRadius: '8px',
                                        padding: '0.45rem 1rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✍️ Rellenar Nuevo Feedback para {selectedFichaAgent.name} ↗
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openSanctionModal(selectedFichaAgent.name)}
                                    style={{
                                        background: 'rgba(234, 179, 8, 0.16)',
                                        border: '1px solid rgba(250, 204, 21, 0.42)',
                                        color: '#fef08a',
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.95rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    title={`Emitir falta leve de sargentos para ${selectedFichaAgent.name}`}
                                >
                                    <span>⚖️</span>
                                    <span>Sancionar (Falta Leve)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteFicha(selectedFichaAgent.name)}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.12)',
                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                        color: '#f87171',
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.9rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                    title="Eliminar la ficha completa de este agente y todos sus registros"
                                >
                                    🗑️ Borrar Ficha Completa
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedFichaAgent(null)}
                                className="login-button btn-secondary"
                                style={{ width: 'auto', padding: '0.45rem 1.2rem', borderRadius: '8px', fontSize: '0.8rem' }}
                            >
                                Cerrar Ficha
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* MODAL: CONFIGURACIÓN WEBHOOK DISCORD (FEEDBACKS)                  */}
            {/* ================================================================= */}
            {showWebhookModal && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowWebhookModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(3, 7, 18, 0.85)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1.25rem'
                    }}
                >
                    <div
                        className="glass-panel"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'rgba(15, 23, 42, 0.96)',
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            borderRadius: '16px',
                            padding: '1.75rem',
                            maxWidth: '650px',
                            width: '100%',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(99, 102, 241, 0.15)',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: 'rgba(99, 102, 241, 0.2)',
                                    border: '1px solid rgba(129, 140, 248, 0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.3rem'
                                }}>
                                    🔔
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#a5b4fc', letterSpacing: '0.08em' }}>
                                        Notificaciones en Tiempo Real
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
                                        Webhook Discord — Feedbacks
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWebhookModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: 'none',
                                    color: '#94a3b8',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Description */}
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                            Configura el webhook del canal de Discord donde se publicará automáticamente cada nuevo feedback (positivo, negativo o mixto) que sea enviado a Comandancia.
                        </p>

                        {/* Alerts */}
                        {webhookNotice && (
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#6ee7b7',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                marginBottom: '1.25rem'
                            }}>
                                {webhookNotice}
                            </div>
                        )}

                        {webhookError && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#fca5a5',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                marginBottom: '1.25rem'
                            }}>
                                ⚠️ {webhookError}
                            </div>
                        )}

                        <form onSubmit={handleSaveWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Enable Switch */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                padding: '0.9rem 1.1rem',
                                borderRadius: '12px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                        Activar Webhook de Discord
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        Si está desactivado, los feedbacks se registrarán en la base de datos sin notificar a Discord.
                                    </div>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={webhookConfig.enabled}
                                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundColor: webhookConfig.enabled ? '#6366f1' : 'rgba(255,255,255,0.2)',
                                        borderRadius: '34px',
                                        transition: '0.2s'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '""',
                                            height: '20px',
                                            width: '20px',
                                            left: webhookConfig.enabled ? '24px' : '3px',
                                            bottom: '3px',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '50%',
                                            transition: '0.2s'
                                        }} />
                                    </span>
                                </label>
                            </div>

                            {/* Webhook URL */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                    URL del Webhook de Discord *
                                </label>
                                <input
                                    type="text"
                                    required={webhookConfig.enabled}
                                    placeholder="https://discord.com/api/webhooks/..."
                                    value={webhookConfig.webhookUrl}
                                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.95rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Role Ping */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                    Mención de Rol o Notificación (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: @here, @everyone o ID del Rol (ej: 112233445566)"
                                    value={webhookConfig.rolePing}
                                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, rolePing: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.95rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Si introduces una ID numérica de rol, se convertirá automáticamente a formato &lt;@&amp;ID&gt;.
                                </span>
                            </div>

                            {/* Bot Name and Bot Avatar Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                        Nombre del Bot
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Comandancia • Feedbacks LSPD"
                                        value={webhookConfig.botName}
                                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, botName: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.35)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.7rem 0.95rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                        Avatar del Bot (Subir archivo o enlace)
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {/* File Upload Button */}
                                            <label style={{
                                                background: uploadingAvatar ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.18)',
                                                border: '1px solid rgba(129, 140, 248, 0.45)',
                                                color: '#c7d2fe',
                                                borderRadius: '10px',
                                                padding: '0.65rem 0.95rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 800,
                                                cursor: uploadingAvatar ? 'wait' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.15s ease'
                                            }}>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    disabled={uploadingAvatar}
                                                    onChange={handleUploadBotAvatar}
                                                    style={{ display: 'none' }}
                                                />
                                                <span>{uploadingAvatar ? '⏳ Subiendo...' : '📁 Subir Imagen'}</span>
                                            </label>

                                            {/* Direct URL Input */}
                                            <input
                                                type="text"
                                                placeholder="O pega una URL: https://..."
                                                value={webhookConfig.botAvatar}
                                                onChange={(e) => setWebhookConfig(prev => ({ ...prev, botAvatar: e.target.value }))}
                                                style={{
                                                    flex: 1,
                                                    background: 'rgba(0, 0, 0, 0.35)',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    borderRadius: '10px',
                                                    padding: '0.7rem 0.95rem',
                                                    color: '#f8fafc',
                                                    fontSize: '0.85rem',
                                                    boxSizing: 'border-box',
                                                    outline: 'none'
                                                }}
                                            />

                                            {/* Avatar Preview */}
                                            {webhookConfig.botAvatar && (
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <img
                                                        src={webhookConfig.botAvatar}
                                                        alt="Avatar preview"
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(129, 140, 248, 0.6)' }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setWebhookConfig(prev => ({ ...prev, botAvatar: '' }))}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-5px',
                                                            right: '-5px',
                                                            background: 'rgba(239, 68, 68, 0.9)',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '18px',
                                                            height: '18px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 900,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        title="Eliminar avatar"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                            Puedes subir una imagen desde tu PC o pegar cualquier URL directa de imagen.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Message Header */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                    Mensaje / Encabezado personalizado
                                </label>
                                <input
                                    type="text"
                                    placeholder="📥 **NUEVO FEEDBACK REGISTRADO EN COMANDANCIA**"
                                    value={webhookConfig.customMsg}
                                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, customMsg: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.95rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={handleTestWebhook}
                                    disabled={testingWebhook || !webhookConfig.webhookUrl}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.18)',
                                        color: '#f8fafc',
                                        padding: '0.65rem 1.2rem',
                                        borderRadius: '10px',
                                        fontSize: '0.84rem',
                                        fontWeight: 800,
                                        cursor: (testingWebhook || !webhookConfig.webhookUrl) ? 'not-allowed' : 'pointer',
                                        opacity: (testingWebhook || !webhookConfig.webhookUrl) ? 0.5 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>🧪</span>
                                    <span>{testingWebhook ? 'Enviando prueba...' : 'Probar Webhook'}</span>
                                </button>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowWebhookModal(false)}
                                        className="login-button btn-secondary"
                                        style={{ width: 'auto', padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.84rem' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingWebhook}
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '0.65rem 1.4rem',
                                            borderRadius: '10px',
                                            fontSize: '0.84rem',
                                            fontWeight: 800,
                                            cursor: savingWebhook ? 'wait' : 'pointer',
                                            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                                        }}
                                    >
                                        {savingWebhook ? 'Guardando...' : '💾 Guardar Configuración'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* MODAL: EMITIR FALTA LEVE (SARGENTOS) HACIA SANCIONES              */}
            {/* ================================================================= */}
            {showSanctionModal && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowSanctionModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(3, 7, 18, 0.88)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1.25rem'
                    }}
                >
                    <div
                        className="glass-panel"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'rgba(15, 23, 42, 0.98)',
                            border: '1px solid rgba(250, 204, 21, 0.4)',
                            borderRadius: '16px',
                            padding: '1.75rem',
                            maxWidth: '700px',
                            width: '100%',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(234, 179, 8, 0.15)',
                            maxHeight: '92vh',
                            overflowY: 'auto'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: 'rgba(234, 179, 8, 0.2)',
                                    border: '1px solid rgba(250, 204, 21, 0.45)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.3rem'
                                }}>
                                    ⚖️
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                        <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 900,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#6ee7b7',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            letterSpacing: '0.06em'
                                        }}>
                                            🟢 SANCIONES — FALTA LEVE (SARGENTOS)
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
                                        Emitir Falta Leve desde Comandancia
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSanctionModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: 'none',
                                    color: '#94a3b8',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Description */}
                        <div style={{
                            background: 'rgba(234, 179, 8, 0.07)',
                            border: '1px solid rgba(250, 204, 21, 0.25)',
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            fontSize: '0.82rem',
                            color: '#fef08a',
                            lineHeight: 1.45,
                            marginBottom: '1.25rem'
                        }}>
                            ℹ️ Esta acción registrará la sanción con tipificación <strong>Falta Leve (Sargentos)</strong> directamente en el registro oficial de <strong>Sanciones</strong> (igual que desde Asuntos Internos) y la publicará en el canal oficial de Discord configurado si se mantiene activado.
                        </div>

                        {/* Alerts */}
                        {sanctionNotice && (
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#6ee7b7',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                marginBottom: '1.25rem'
                            }}>
                                {sanctionNotice}
                            </div>
                        )}

                        {sanctionError && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#fca5a5',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                fontWeight: 700,
                                marginBottom: '1.25rem'
                            }}>
                                ⚠️ {sanctionError}
                            </div>
                        )}

                        <form onSubmit={handleSubmitSanction} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Datalist for autocomplete */}
                            <datalist id="officers-list-sanction">
                                {officersList.map(o => (
                                    <option
                                        key={o.id}
                                        value={`${o.nombre || ''} ${o.apellido || ''}`.trim()}
                                    >
                                        #{o.no_placa || 'S/P'} - {o.rango || 'Oficial'}
                                    </option>
                                ))}
                            </datalist>

                            {/* Officer Selector / Search */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                    Oficial Sancionado *
                                </label>
                                <input
                                    type="text"
                                    required
                                    list="officers-list-sanction"
                                    placeholder="Escribe o selecciona el nombre del oficial..."
                                    value={sanctionForm.officerName}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const found = officersList.find(u => {
                                            const full = `${u.nombre || ''} ${u.apellido || ''}`.trim().toLowerCase();
                                            return full === val.toLowerCase();
                                        });
                                        if (found) {
                                            setSanctionForm(prev => ({
                                                ...prev,
                                                officerName: `${found.nombre || ''} ${found.apellido || ''}`.trim(),
                                                officerBadge: found.no_placa || prev.officerBadge,
                                                officerRank: found.rango || prev.officerRank
                                            }));
                                        } else {
                                            setSanctionForm(prev => ({ ...prev, officerName: val }));
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.95rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Badge and Rank Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                        Placa / Identificación
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 42"
                                        value={sanctionForm.officerBadge}
                                        onChange={(e) => setSanctionForm(prev => ({ ...prev, officerBadge: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.35)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.7rem 0.95rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                        Rango Actual
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Officer II / Sergeant"
                                        value={sanctionForm.officerRank}
                                        onChange={(e) => setSanctionForm(prev => ({ ...prev, officerRank: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.35)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.7rem 0.95rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Motivo de la Sanción */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                    Motivo de la Falta Leve *
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Describe con claridad los hechos que motivan la sanción leve..."
                                    value={sanctionForm.reason}
                                    onChange={(e) => setSanctionForm(prev => ({ ...prev, reason: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.95rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {/* Sanción Aplicada */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                    Sanción Aplicada / Medida Correctiva
                                </label>
                                <input
                                    type="text"
                                    placeholder="Amonestación verbal / Advertencia formal registrada en expediente"
                                    value={sanctionForm.sanctionApplied}
                                    onChange={(e) => setSanctionForm(prev => ({ ...prev, sanctionApplied: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.95rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Fecha y Evidencias */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                        Fecha de la Sanción
                                    </label>
                                    <input
                                        type="date"
                                        value={sanctionForm.sanctionDate}
                                        onChange={(e) => setSanctionForm(prev => ({ ...prev, sanctionDate: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.35)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.7rem 0.95rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>
                                        Evidencias / Enlace (Clip, Grabación, Docs)
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={sanctionForm.evidenceUrl}
                                        onChange={(e) => setSanctionForm(prev => ({ ...prev, evidenceUrl: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.35)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.7rem 0.95rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            boxSizing: 'border-box',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Checkbox Send to Discord */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                border: '1px solid rgba(129, 140, 248, 0.3)',
                                padding: '0.85rem 1rem',
                                borderRadius: '12px',
                                cursor: 'pointer'
                            }}
                            onClick={() => setSanctionForm(prev => ({ ...prev, sendToDiscord: !prev.sendToDiscord }))}
                            >
                                <input
                                    type="checkbox"
                                    id="sendToDiscordCheck"
                                    checked={sanctionForm.sendToDiscord}
                                    onChange={(e) => setSanctionForm(prev => ({ ...prev, sendToDiscord: e.target.checked }))}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="sendToDiscordCheck" style={{ cursor: 'pointer', flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>📢</span>
                                        <span>Publicar en el canal oficial de Discord de Sanciones</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#c7d2fe', marginTop: '2px' }}>
                                        Enviará el embed oficial con el banner de Falta Leve (Sargentos) al canal configurado en el sistema de sanciones.
                                    </div>
                                </label>
                            </div>

                            {/* Sancionador Info Footer */}
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                Emitido por: <strong>{[profile?.rango && `[${profile.rango}]`, profile?.nombre, profile?.apellido, profile?.no_placa && `(#${profile.no_placa})`].filter(Boolean).join(' ')} (Comandancia)</strong>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.8rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowSanctionModal(false)}
                                    className="login-button btn-secondary"
                                    style={{ width: 'auto', padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.84rem' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingSanction}
                                    style={{
                                        background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                        color: '#0f172a',
                                        border: 'none',
                                        padding: '0.65rem 1.4rem',
                                        borderRadius: '10px',
                                        fontSize: '0.84rem',
                                        fontWeight: 900,
                                        cursor: submittingSanction ? 'wait' : 'pointer',
                                        boxShadow: '0 4px 15px rgba(234, 179, 8, 0.35)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>⚖️</span>
                                    <span>{submittingSanction ? 'Registrando Sanción...' : 'Registrar y Emitir Sanción'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// COMPONENTE: FeedbackReactionsBar
// Permite reaccionar con tick (✅), cruz (❌) y reloj de arena (⏳)
// Muestra contador y tooltip/popover de quiénes han reaccionado.
// ----------------------------------------------------------------------
function FeedbackReactionsBar({ feedbackId, reactions, currentUserId, onToggle }) {
    const [hoveredType, setHoveredType] = useState(null);

    const safeReactions = reactions || { check: [], cross: [], hourglass: [] };
    const checkList = safeReactions.check || [];
    const crossList = safeReactions.cross || [];
    const hourglassList = safeReactions.hourglass || [];

    const hasUserReacted = (list) => list.some(r => r.user_id === currentUserId);

    const formatUsersTooltip = (label, list) => {
        if (!list || list.length === 0) return `${label} (0)\nNadie ha reaccionado aún. Haz clic para reaccionar.`;
        const names = list.map(r => `• ${r.user_name || 'Agente'}${r.user_rank ? ` (${r.user_rank})` : ''}`).join('\n');
        return `${label} (${list.length}):\n${names}`;
    };

    const reactionButtons = [
        {
            type: 'check',
            icon: '✅',
            label: 'Conforme / Aprobado',
            count: checkList.length,
            list: checkList,
            isActive: hasUserReacted(checkList),
            activeColor: '#34d399',
            activeBg: 'rgba(16, 185, 129, 0.22)',
            activeBorder: 'rgba(52, 211, 153, 0.65)',
            glow: 'rgba(16, 185, 129, 0.3)'
        },
        {
            type: 'cross',
            icon: '❌',
            label: 'En desacuerdo / Rechazo',
            count: crossList.length,
            list: crossList,
            isActive: hasUserReacted(crossList),
            activeColor: '#f87171',
            activeBg: 'rgba(239, 68, 68, 0.22)',
            activeBorder: 'rgba(248, 113, 113, 0.65)',
            glow: 'rgba(239, 68, 68, 0.3)'
        },
        {
            type: 'hourglass',
            icon: '⏳',
            label: 'En revisión / Pendiente',
            count: hourglassList.length,
            list: hourglassList,
            isActive: hasUserReacted(hourglassList),
            activeColor: '#fbbf24',
            activeBg: 'rgba(245, 158, 11, 0.22)',
            activeBorder: 'rgba(251, 191, 36, 0.65)',
            glow: 'rgba(245, 158, 11, 0.3)'
        }
    ];

    const totalReactionsCount = checkList.length + crossList.length + hourglassList.length;

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            {/* Buttons Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {reactionButtons.map(btn => (
                    <div
                        key={btn.type}
                        style={{ position: 'relative', display: 'inline-block' }}
                        onMouseEnter={() => setHoveredType(btn.type)}
                        onMouseLeave={() => setHoveredType(null)}
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(btn.type);
                            }}
                            title={formatUsersTooltip(btn.label, btn.list)}
                            style={{
                                background: btn.isActive ? btn.activeBg : 'rgba(255, 255, 255, 0.04)',
                                border: `1px solid ${btn.isActive ? btn.activeBorder : 'rgba(255, 255, 255, 0.1)'}`,
                                color: btn.isActive ? btn.activeColor : '#94a3b8',
                                boxShadow: btn.isActive ? `0 0 10px ${btn.glow}` : 'none',
                                borderRadius: '8px',
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.82rem', lineHeight: 1 }}>{btn.icon}</span>
                            <span style={{
                                fontWeight: 800,
                                color: btn.isActive ? btn.activeColor : (btn.count > 0 ? '#e2e8f0' : '#64748b'),
                                minWidth: '10px',
                                textAlign: 'center'
                            }}>
                                {btn.count}
                            </span>
                            {btn.isActive && (
                                <span style={{ fontSize: '0.62rem', color: btn.activeColor, opacity: 0.85 }}>
                                    ✓
                                </span>
                            )}
                        </button>

                        {/* Interactive floating popover showing who reacted on hover */}
                        {hoveredType === btn.type && btn.list.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 8px)',
                                left: 0,
                                transform: 'none',
                                zIndex: 2000,
                                background: 'rgba(15, 23, 42, 0.98)',
                                border: `1px solid ${btn.activeBorder}`,
                                borderRadius: '10px',
                                padding: '8px 12px',
                                boxShadow: `0 12px 32px rgba(0, 0, 0, 0.85), 0 0 15px ${btn.glow}`,
                                backdropFilter: 'blur(16px)',
                                width: 'max-content',
                                minWidth: '210px',
                                maxWidth: '320px',
                                pointerEvents: 'none'
                            }}>
                                <div style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    color: btn.activeColor,
                                    textTransform: 'uppercase',
                                    marginBottom: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}>
                                    <span>{btn.icon}</span>
                                    <span>{btn.label} ({btn.list.length})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {btn.list.map((u, idx) => (
                                        <div
                                            key={u.user_id || idx}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '6px',
                                                fontSize: '0.72rem',
                                                color: '#e2e8f0'
                                            }}
                                        >
                                            <span style={{ fontWeight: 600 }}>
                                                {u.user_name || 'Agente'}
                                                {u.user_id === currentUserId && ' (Tú)'}
                                            </span>
                                            {u.user_rank && (
                                                <span style={{
                                                    fontSize: '0.62rem',
                                                    color: '#94a3b8',
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    padding: '1px 5px',
                                                    borderRadius: '4px'
                                                }}>
                                                    {u.user_rank}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Quick Summary Pill if there are reactions */}
            {totalReactionsCount > 0 && (
                <div style={{
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                    <span>👥</span>
                    <span>{totalReactionsCount} {totalReactionsCount === 1 ? 'reacción' : 'reacciones'}</span>
                </div>
            )}
        </div>
    );
}

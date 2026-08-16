import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const texts = {
    es: {
        title: "Votación de Sanciones",
        loading: "Cargando sistema de votación...",
        noTargets: "No hay personas registradas para votar sanciones en este caso.",
        noTargetsPrompt: "Añade una persona investigada arriba para comenzar a registrar y votar las faltas o sanciones propuestas.",
        addPerson: "Añadir persona investigada",
        addPersonPlaceholder: "Nombre y Apellido del investigado...",
        addPersonBtn: "Añadir Investigado",
        addOptionPlaceholder: "Añadir falta o sanción propuesta (ej: Falta Grave - Suspensión 3 días)...",
        addOptionBtn: "Añadir Sanción",
        noOptions: "Sin sanciones propuestas aún. Añade una propuesta abajo para comenzar la votación.",
        voteCount: "voto",
        votesCount: "votos",
        votedBy: "Votado por",
        deleteTargetConfirm: "¿Está seguro de que desea eliminar a esta persona y todas sus sanciones y votos asociados?",
        deleteOptionConfirm: "¿Está seguro de que desea eliminar esta sanción propuesta?",
        noPermission: "No tienes permisos para votar o realizar esta acción.",
        addPersonSuccess: "Persona añadida correctamente.",
        addOptionSuccess: "Sanción propuesta añadida correctamente.",
        totalVotes: "Votos Totales"
    },
    en: {
        title: "Sanction Voting",
        loading: "Loading voting system...",
        noTargets: "No people registered for sanction voting in this case.",
        noTargetsPrompt: "Add an investigated person above to begin registering and voting on proposed offenses or sanctions.",
        addPerson: "Add investigated person",
        addPersonPlaceholder: "Investigated Person's First & Last Name...",
        addPersonBtn: "Add Person",
        addOptionPlaceholder: "Add proposed offense or sanction (e.g. Major Offense - 3 days suspension)...",
        addOptionBtn: "Add Sanction",
        noOptions: "No proposed sanctions yet. Add a proposal below to begin voting.",
        voteCount: "vote",
        votesCount: "votes",
        votedBy: "Voted by",
        deleteTargetConfirm: "Are you sure you want to delete this person and all associated sanctions and votes?",
        deleteOptionConfirm: "Are you sure you want to delete this proposed sanction?",
        noPermission: "You do not have permission to vote or perform this action.",
        addPersonSuccess: "Person added successfully.",
        addOptionSuccess: "Proposed sanction added successfully.",
        totalVotes: "Total Votes"
    }
};

function IASanctionVoting({ caseId, currentUser: initialUser, userIsIAUser: initialIsIA, canEditCase: initialCanEdit }) {
    const { language } = useLanguage();
    const t = texts[language === 'es' ? 'es' : 'en'];

    const [currentUser, setCurrentUser] = useState(initialUser || null);
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form inputs
    const [newPersonName, setNewPersonName] = useState('');
    const [newOptionTexts, setNewOptionTexts] = useState({}); // Map of targetId -> optionText
    const [submittingPerson, setSubmittingPerson] = useState(false);
    const [submittingOption, setSubmittingOption] = useState({});

    // Fallback user loader if not provided via props
    useEffect(() => {
        if (initialUser) {
            setCurrentUser(initialUser);
        } else {
            supabase.auth.getUser().then(async ({ data: { user } }) => {
                if (user) {
                    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
                    if (profile) setCurrentUser(profile);
                }
            });
        }
    }, [initialUser]);

    const userIsIA = initialIsIA !== undefined 
        ? initialIsIA 
        : currentUser && (
            (currentUser.divisions && currentUser.divisions.includes('Internal Affairs')) ||
            currentUser.rol === 'Administrador'
        );

    const canEdit = initialCanEdit !== undefined 
        ? initialCanEdit 
        : Boolean(userIsIA);

    useEffect(() => {
        if (caseId) {
            loadTargets();
        }
    }, [caseId]);

    const loadTargets = async () => {
        try {
            const { data, error } = await supabase
                .from('ia_case_sanction_targets')
                .select(`
                    id,
                    full_name,
                    created_at,
                    created_by,
                    ia_case_sanction_options (
                        id,
                        sanction_name,
                        ia_case_sanction_votes (
                            user_id,
                            created_at,
                            users (
                                id,
                                nombre,
                                apellido,
                                rango,
                                profile_image
                            )
                        )
                    )
                `)
                .eq('case_id', caseId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setTargets(data || []);
        } catch (err) {
            console.error("Error loading sanction targets:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPerson = async (e) => {
        e.preventDefault();
        if (!canEdit) return alert(t.noPermission);
        if (!newPersonName.trim()) return;

        setSubmittingPerson(true);
        try {
            const { error } = await supabase
                .from('ia_case_sanction_targets')
                .insert({
                    case_id: caseId,
                    full_name: newPersonName.trim(),
                    created_by: currentUser?.id
                });

            if (error) throw error;
            setNewPersonName('');
            await loadTargets();
        } catch (err) {
            alert("Error al añadir persona: " + err.message);
        } finally {
            setSubmittingPerson(false);
        }
    };

    const handleAddOption = async (targetId) => {
        if (!canEdit) return alert(t.noPermission);
        const optionName = newOptionTexts[targetId];
        if (!optionName || !optionName.trim()) return;

        setSubmittingOption(prev => ({ ...prev, [targetId]: true }));
        try {
            const { error } = await supabase
                .from('ia_case_sanction_options')
                .insert({
                    target_id: targetId,
                    sanction_name: optionName.trim()
                });

            if (error) throw error;
            setNewOptionTexts(prev => ({ ...prev, [targetId]: '' }));
            await loadTargets();
        } catch (err) {
            alert("Error al añadir sanción: " + err.message);
        } finally {
            setSubmittingOption(prev => ({ ...prev, [targetId]: false }));
        }
    };

    const handleVote = async (targetId, optionId, alreadyVotedForThis) => {
        if (!userIsIA || !currentUser) {
            alert(t.noPermission);
            return;
        }

        try {
            if (alreadyVotedForThis) {
                // If clicked on current voted option, remove the vote
                const { error } = await supabase
                    .from('ia_case_sanction_votes')
                    .delete()
                    .eq('target_id', targetId)
                    .eq('user_id', currentUser.id);

                if (error) throw error;
            } else {
                // Upsert vote for this target
                const { error } = await supabase
                    .from('ia_case_sanction_votes')
                    .upsert({
                        target_id: targetId,
                        user_id: currentUser.id,
                        option_id: optionId
                    });

                if (error) throw error;
            }
            await loadTargets();
        } catch (err) {
            alert("Error al votar: " + err.message);
        }
    };

    const handleDeleteTarget = async (targetId) => {
        if (!canEdit) return alert(t.noPermission);
        if (!window.confirm(t.deleteTargetConfirm)) return;

        try {
            const { error } = await supabase
                .from('ia_case_sanction_targets')
                .delete()
                .eq('id', targetId);

            if (error) throw error;
            await loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleDeleteOption = async (optionId) => {
        if (!canEdit) return alert(t.noPermission);
        if (!window.confirm(t.deleteOptionConfirm)) return;

        try {
            const { error } = await supabase
                .from('ia_case_sanction_options')
                .delete()
                .eq('id', optionId);

            if (error) throw error;
            await loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    if (loading) {
        return (
            <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                {t.loading}
            </div>
        );
    }

    return (
        <div className="sanction-voting-system" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Add Target Section */}
            {canEdit && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚖️</span>
                        <h4 style={{ margin: 0, color: 'var(--accent-gold, #f59e0b)', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                            {t.addPerson}
                        </h4>
                    </div>
                    <form onSubmit={handleAddPerson} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            className="form-input"
                            style={{
                                flex: '1',
                                minWidth: '240px',
                                margin: 0,
                                background: 'rgba(0, 0, 0, 0.35)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '8px',
                                color: '#ffffff',
                                padding: '0.6rem 1rem',
                                fontSize: '0.88rem'
                            }}
                            placeholder={t.addPersonPlaceholder}
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                            disabled={submittingPerson}
                        />
                        <button 
                            type="submit" 
                            className="mac-btn mac-btn-primary" 
                            style={{ 
                                margin: 0, 
                                padding: '0.6rem 1.25rem', 
                                fontSize: '0.85rem', 
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            disabled={submittingPerson || !newPersonName.trim()}
                        >
                            <span>+</span>
                            <span>{submittingPerson ? '...' : t.addPersonBtn}</span>
                        </button>
                    </form>
                </div>
            )}

            {/* List of Targets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {targets.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 2rem',
                        background: 'rgba(15, 23, 42, 0.4)',
                        borderRadius: '12px',
                        border: '1px dashed rgba(255, 255, 255, 0.12)',
                        color: 'var(--text-secondary, #94a3b8)'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚖️</div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0', fontSize: '1.05rem', fontWeight: 600 }}>
                            {t.noTargets}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '500px', marginInline: 'auto' }}>
                            {t.noTargetsPrompt}
                        </p>
                    </div>
                ) : (
                    targets.map(target => {
                        const allOptions = target.ia_case_sanction_options || [];
                        const totalVotes = allOptions.reduce((acc, opt) => acc + (opt.ia_case_sanction_votes?.length || 0), 0);

                        return (
                            <div key={target.id} style={{
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '1.25rem 1.5rem',
                                position: 'relative',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                            }}>
                                {/* Target Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                                    paddingBottom: '0.75rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#f87171',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1rem',
                                            border: '1px solid rgba(239, 68, 68, 0.3)'
                                        }}>
                                            👤
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.05rem', fontWeight: 700 }}>
                                                {target.full_name}
                                            </h3>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                {totalVotes} {totalVotes === 1 ? t.voteCount : t.votesCount} emitidos en total
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {canEdit && (
                                        <button
                                            onClick={() => handleDeleteTarget(target.id)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Eliminar investigado"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    )}
                                </div>

                                {/* Options List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {allOptions.length === 0 ? (
                                        <div style={{
                                            padding: '1rem',
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: '8px',
                                            border: '1px dashed rgba(255,255,255,0.06)',
                                            textAlign: 'center'
                                        }}>
                                            <p style={{ margin: 0, color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                {t.noOptions}
                                            </p>
                                        </div>
                                    ) : (
                                        allOptions.map(option => {
                                            const optionVotes = option.ia_case_sanction_votes || [];
                                            const voteCount = optionVotes.length;
                                            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                                            const hasVotedForThis = optionVotes.some(v => v.user_id === currentUser?.id);

                                            return (
                                                <div
                                                    key={option.id}
                                                    onClick={() => handleVote(target.id, option.id, hasVotedForThis)}
                                                    style={{
                                                        position: 'relative',
                                                        background: hasVotedForThis ? 'rgba(212, 175, 55, 0.08)' : 'rgba(0, 0, 0, 0.3)',
                                                        border: hasVotedForThis 
                                                            ? '1.5px solid var(--accent-gold, #f59e0b)' 
                                                            : '1px solid rgba(255, 255, 255, 0.08)',
                                                        borderRadius: '8px',
                                                        padding: '0.75rem 1rem',
                                                        cursor: userIsIA ? 'pointer' : 'default',
                                                        overflow: 'hidden',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }}
                                                    className="sanction-option-card"
                                                >
                                                    {/* Progress bar background */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        height: '100%',
                                                        width: `${percentage}%`,
                                                        background: hasVotedForThis 
                                                            ? 'rgba(245, 158, 11, 0.18)' 
                                                            : 'rgba(255, 255, 255, 0.05)',
                                                        zIndex: 0,
                                                        transition: 'width 0.3s ease-out'
                                                    }} />

                                                    {/* Option content */}
                                                    <div style={{
                                                        position: 'relative',
                                                        zIndex: 1,
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: voteCount > 0 ? '0.5rem' : '0'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '50%',
                                                                border: hasVotedForThis ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.3)',
                                                                background: hasVotedForThis ? '#f59e0b' : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '10px',
                                                                color: '#000',
                                                                fontWeight: 'bold',
                                                                flexShrink: 0
                                                            }}>
                                                                {hasVotedForThis ? '✓' : ''}
                                                            </div>
                                                            <span style={{ 
                                                                fontWeight: 600, 
                                                                color: hasVotedForThis ? '#ffffff' : '#e2e8f0',
                                                                fontSize: '0.9rem'
                                                            }}>
                                                                {option.sanction_name}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{
                                                                fontSize: '0.78rem',
                                                                background: hasVotedForThis ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                                                color: hasVotedForThis ? '#fbbf24' : '#94a3b8',
                                                                padding: '2px 8px',
                                                                borderRadius: '12px',
                                                                fontWeight: 700,
                                                                border: hasVotedForThis ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255,255,255,0.05)'
                                                            }}>
                                                                {voteCount} {voteCount === 1 ? t.voteCount : t.votesCount} ({percentage.toFixed(0)}%)
                                                            </span>

                                                            {canEdit && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteOption(option.id);
                                                                    }}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#ef4444',
                                                                        cursor: 'pointer',
                                                                        fontSize: '1.1rem',
                                                                        opacity: 0.7,
                                                                        padding: '0 4px',
                                                                        lineHeight: 1
                                                                    }}
                                                                    title="Eliminar sanción"
                                                                >
                                                                    &times;
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Voter Avatars / Names list */}
                                                    {voteCount > 0 && (
                                                        <div style={{
                                                            position: 'relative',
                                                            zIndex: 1,
                                                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                            paddingTop: '0.45rem',
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}>
                                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '2px' }}>
                                                                {t.votedBy}:
                                                            </span>
                                                            {optionVotes.map(vote => (
                                                                <div
                                                                    key={vote.user_id}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                        borderRadius: '16px',
                                                                        padding: '2px 8px 2px 4px',
                                                                        fontSize: '0.72rem',
                                                                        color: '#cbd5e1'
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={vote.users?.profile_image || '/logowebp/anon.webp'}
                                                                        alt=""
                                                                        style={{
                                                                            width: '16px',
                                                                            height: '16px',
                                                                            borderRadius: '50%',
                                                                            marginRight: '5px',
                                                                            objectFit: 'cover'
                                                                        }}
                                                                    />
                                                                    <span>{vote.users ? `${vote.users.rango ? `${vote.users.rango} ` : ''}${vote.users.nombre} ${vote.users.apellido}` : 'Usuario'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add proposed sanction input */}
                                {canEdit && (
                                    <div style={{
                                        marginTop: '1rem',
                                        paddingTop: '0.85rem',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                        display: 'flex',
                                        gap: '0.5rem'
                                    }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{
                                                flex: 1,
                                                margin: 0,
                                                padding: '0.45rem 0.85rem',
                                                fontSize: '0.82rem',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '6px',
                                                color: '#ffffff'
                                            }}
                                            placeholder={t.addOptionPlaceholder}
                                            value={newOptionTexts[target.id] || ''}
                                            onChange={(e) => setNewOptionTexts(prev => ({ ...prev, [target.id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddOption(target.id);
                                                }
                                            }}
                                            disabled={submittingOption[target.id]}
                                        />
                                        <button
                                            type="button"
                                            className="mac-btn mac-btn-secondary"
                                            style={{
                                                width: 'auto',
                                                margin: 0,
                                                padding: '0.45rem 0.9rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                            onClick={() => handleAddOption(target.id)}
                                            disabled={submittingOption[target.id] || !newOptionTexts[target.id]?.trim()}
                                        >
                                            <span>+</span>
                                            <span>{submittingOption[target.id] ? '...' : t.addOptionBtn}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default IASanctionVoting;

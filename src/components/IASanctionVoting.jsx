import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const texts = {
    es: {
        title: "Votación de Sanciones",
        loading: "Cargando sistema de votación...",
        noTargets: "No hay personas registradas para votar sanciones en este caso.",
        addPerson: "Añadir persona al expediente",
        addPersonPlaceholder: "Nombre y Apellido...",
        addPersonBtn: "Añadir Persona",
        addOptionPlaceholder: "Añadir sanción propuesta (ej: Falta grave)...",
        noOptions: "Sin sanciones propuestas aún.",
        voteCount: "voto",
        votesCount: "votos",
        votedBy: "Votado por",
        deleteTargetConfirm: "¿Está seguro de que desea eliminar a esta persona y todos sus votos asociados?",
        deleteOptionConfirm: "¿Está seguro de que desea eliminar esta sanción propuesta?",
        noPermission: "No tienes permisos para votar o realizar esta acción.",
        addPersonSuccess: "Persona añadida correctamente.",
        addOptionSuccess: "Sanción propuesta añadida correctamente."
    },
    en: {
        title: "Sanction Voting",
        loading: "Loading voting system...",
        noTargets: "No people registered for sanction voting in this case.",
        addPerson: "Add person to case file",
        addPersonPlaceholder: "First and Last Name...",
        addPersonBtn: "Add Person",
        addOptionPlaceholder: "Add proposed sanction (e.g., Major offense)...",
        noOptions: "No proposed sanctions yet.",
        voteCount: "vote",
        votesCount: "votes",
        votedBy: "Voted by",
        deleteTargetConfirm: "Are you sure you want to delete this person and all associated votes?",
        deleteOptionConfirm: "Are you sure you want to delete this proposed sanction?",
        noPermission: "You do not have permission to vote or perform this action.",
        addPersonSuccess: "Person added successfully.",
        addOptionSuccess: "Proposed sanction added successfully."
    }
};

function IASanctionVoting({ caseId, currentUser, userIsIAUser, canEditCase }) {
    const { language } = useLanguage();
    const t = texts[language === 'es' ? 'es' : 'en'];

    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form inputs
    const [newPersonName, setNewPersonName] = useState('');
    const [newOptionTexts, setNewOptionTexts] = useState({}); // Map of targetId -> optionText

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
        if (!canEditCase) return alert(t.noPermission);
        if (!newPersonName.trim()) return;

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
            loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleAddOption = async (targetId) => {
        if (!canEditCase) return alert(t.noPermission);
        const optionName = newOptionTexts[targetId];
        if (!optionName || !optionName.trim()) return;

        try {
            const { error } = await supabase
                .from('ia_case_sanction_options')
                .insert({
                    target_id: targetId,
                    sanction_name: optionName.trim()
                });

            if (error) throw error;
            setNewOptionTexts(prev => ({ ...prev, [targetId]: '' }));
            loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleVote = async (targetId, optionId, alreadyVotedForThis) => {
        if (!userIsIAUser) {
            alert(t.noPermission);
            return;
        }

        try {
            if (alreadyVotedForThis) {
                // If they click on their already voted option, retract/delete the vote
                const { error } = await supabase
                    .from('ia_case_sanction_votes')
                    .delete()
                    .eq('target_id', targetId)
                    .eq('user_id', currentUser.id);

                if (error) throw error;
            } else {
                // Upsert handles moving/setting vote to this option since primary key is (target_id, user_id)
                const { error } = await supabase
                    .from('ia_case_sanction_votes')
                    .upsert({
                        target_id: targetId,
                        user_id: currentUser.id,
                        option_id: optionId
                    });

                if (error) throw error;
            }
            loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleDeleteTarget = async (targetId) => {
        if (!canEditCase) return alert(t.noPermission);
        if (!window.confirm(t.deleteTargetConfirm)) return;

        try {
            const { error } = await supabase
                .from('ia_case_sanction_targets')
                .delete()
                .eq('id', targetId);

            if (error) throw error;
            loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleDeleteOption = async (optionId) => {
        if (!canEditCase) return alert(t.noPermission);
        if (!window.confirm(t.deleteOptionConfirm)) return;

        try {
            const { error } = await supabase
                .from('ia_case_sanction_options')
                .delete()
                .eq('id', optionId);

            if (error) throw error;
            loadTargets();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    if (loading) {
        return <div style={{ color: 'var(--text-secondary)', padding: '1rem' }}>{t.loading}</div>;
    }

    return (
        <div className="sanction-voting-system" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Add Target Section */}
            {canEditCase && (
                <div style={{
                    background: 'var(--glass-bg)',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)', fontSize: '1.1rem' }}>
                        ⚖️ {t.addPerson}
                    </h4>
                    <form onSubmit={handleAddPerson} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            className="form-input"
                            style={{ flex: '1', minWidth: '200px', margin: 0 }}
                            placeholder={t.addPersonPlaceholder}
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                        />
                        <button type="submit" className="login-button" style={{ width: 'auto', margin: 0 }}>
                            {t.addPersonBtn}
                        </button>
                    </form>
                </div>
            )}

            {/* List of Targets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {targets.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        border: '1px dashed var(--glass-border)',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚖️</div>
                        <p>{t.noTargets}</p>
                    </div>
                ) : (
                    targets.map(target => {
                        // Calculate total votes for this target to compute percentages
                        const allOptions = target.ia_case_sanction_options || [];
                        const totalVotes = allOptions.reduce((acc, opt) => acc + (opt.ia_case_sanction_votes?.length || 0), 0);

                        return (
                            <div key={target.id} style={{
                                background: 'rgba(var(--secondary-rgb), 0.4)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '1.5rem',
                                position: 'relative'
                            }}>
                                {/* Target Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    paddingBottom: '0.8rem',
                                    marginBottom: '1.2rem'
                                }}>
                                    <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        👤 {target.full_name}
                                    </h3>
                                    
                                    {canEditCase && (
                                        <button
                                            onClick={() => handleDeleteTarget(target.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                opacity: 0.8,
                                                padding: '4px'
                                            }}
                                            title="Eliminar investigado"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>

                                {/* Options List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {allOptions.length === 0 ? (
                                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                            {t.noOptions}
                                        </p>
                                    ) : (
                                        allOptions.map(option => {
                                            const optionVotes = option.ia_case_sanction_votes || [];
                                            const voteCount = optionVotes.length;
                                            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                                            
                                            // Check if current user has voted for this option
                                            const hasVotedForThis = optionVotes.some(v => v.user_id === currentUser?.id);

                                            return (
                                                <div
                                                    key={option.id}
                                                    onClick={() => handleVote(target.id, option.id, hasVotedForThis)}
                                                    style={{
                                                        position: 'relative',
                                                        background: 'rgba(0, 0, 0, 0.25)',
                                                        border: hasVotedForThis 
                                                            ? '1.5px solid var(--accent-gold)' 
                                                            : '1px solid var(--glass-border)',
                                                        borderRadius: '6px',
                                                        padding: '0.8rem 1rem',
                                                        cursor: userIsIAUser ? 'pointer' : 'default',
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
                                                            ? 'rgba(212, 175, 55, 0.15)' 
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
                                                        marginBottom: voteCount > 0 ? '0.6rem' : '0'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {hasVotedForThis && <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>✓</span>}
                                                            <span style={{ fontWeight: '500', color: hasVotedForThis ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                                {option.sanction_name}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{
                                                                fontSize: '0.8rem',
                                                                background: hasVotedForThis ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.08)',
                                                                color: hasVotedForThis ? 'var(--accent-gold)' : 'var(--text-primary)',
                                                                padding: '2px 8px',
                                                                borderRadius: '12px',
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {voteCount} {voteCount === 1 ? t.voteCount : t.votesCount} ({percentage.toFixed(0)}%)
                                                            </span>

                                                            {canEditCase && (
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
                                                                        fontSize: '0.8rem',
                                                                        opacity: 0.6,
                                                                        padding: '2px'
                                                                    }}
                                                                    title="Eliminar opción"
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
                                                            borderTop: '1px solid rgba(255,255,255,0.05)',
                                                            paddingTop: '0.5rem',
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: '6px'
                                                        }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '4px' }}>
                                                                {t.votedBy}:
                                                            </span>
                                                            {optionVotes.map(vote => (
                                                                <div
                                                                    key={vote.user_id}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        background: 'rgba(255,255,255,0.06)',
                                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                                        borderRadius: '16px',
                                                                        padding: '2px 8px 2px 4px',
                                                                        fontSize: '0.75rem',
                                                                        color: 'var(--text-secondary)'
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={vote.users?.profile_image || '/anon.png'}
                                                                        alt=""
                                                                        style={{
                                                                            width: '16px',
                                                                            height: '16px',
                                                                            borderRadius: '50%',
                                                                            marginRight: '6px',
                                                                            objectFit: 'cover'
                                                                        }}
                                                                    />
                                                                    <span>{vote.users ? `${vote.users.rango} ${vote.users.nombre} ${vote.users.apellido}` : 'Usuario'}</span>
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
                                {canEditCase && (
                                    <div style={{
                                        marginTop: '1.2rem',
                                        paddingTop: '1rem',
                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        gap: '0.5rem'
                                    }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ flex: 1, margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                            placeholder={t.addOptionPlaceholder}
                                            value={newOptionTexts[target.id] || ''}
                                            onChange={(e) => setNewOptionTexts(prev => ({ ...prev, [target.id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddOption(target.id);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="login-button btn-secondary"
                                            style={{ width: 'auto', margin: 0, padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                            onClick={() => handleAddOption(target.id)}
                                        >
                                            ➕
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

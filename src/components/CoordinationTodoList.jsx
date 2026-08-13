import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

function CoordinationTodoList() {
    const { t } = useLanguage();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // New List Form State
    const [newListTitle, setNewListTitle] = useState('');
    const [newListDesc, setNewListDesc] = useState('');
    const [creatingList, setCreatingList] = useState(false);

    // Edit List State
    const [editingListId, setEditingListId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');

    // New Task State (map of listId -> content)
    const [newTaskInputs, setNewTaskInputs] = useState({});

    // Edit Task State
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editTaskContent, setEditTaskContent] = useState('');

    useEffect(() => {
        loadCoordinationTodos();
    }, []);

    const loadCoordinationTodos = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_coordination_todos');
            if (error) throw error;
            setLists(data || []);
        } catch (err) {
            console.error('Error loading coordination todos:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- List Handlers ---

    const handleCreateList = async (e) => {
        e.preventDefault();
        if (!newListTitle.trim()) {
            alert('Por favor introduce el nombre o título de la lista To-Do.');
            return;
        }

        setCreatingList(true);
        try {
            const { error } = await supabase.rpc('create_coordination_todo_list', {
                p_title: newListTitle.trim(),
                p_description: newListDesc.trim() || null
            });
            if (error) throw error;
            setNewListTitle('');
            setNewListDesc('');
            loadCoordinationTodos();
        } catch (err) {
            alert('Error al crear la lista: ' + err.message);
        } finally {
            setCreatingList(false);
        }
    };

    const handleDeleteList = async (listId) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta lista de tareas y todo su contenido?')) return;
        try {
            const { error } = await supabase.rpc('delete_coordination_todo_list', { p_list_id: listId });
            if (error) throw error;
            loadCoordinationTodos();
        } catch (err) {
            alert('Error al eliminar la lista: ' + err.message);
        }
    };

    const startEditList = (list) => {
        setEditingListId(list.id);
        setEditTitle(list.title);
        setEditDesc(list.description || '');
    };

    const handleSaveEditList = async (listId) => {
        if (!editTitle.trim()) return;
        try {
            const { error } = await supabase.rpc('update_coordination_todo_list', {
                p_list_id: listId,
                p_title: editTitle.trim(),
                p_description: editDesc.trim() || null
            });
            if (error) throw error;
            setEditingListId(null);
            loadCoordinationTodos();
        } catch (err) {
            alert('Error al actualizar la lista: ' + err.message);
        }
    };

    // --- Task Handlers ---

    const handleAddTask = async (e, listId) => {
        e.preventDefault();
        const content = newTaskInputs[listId];
        if (!content || !content.trim()) return;

        try {
            const { error } = await supabase.rpc('create_coordination_todo_task', {
                p_list_id: listId,
                p_content: content.trim()
            });
            if (error) throw error;
            
            setNewTaskInputs(prev => ({ ...prev, [listId]: '' }));
            loadCoordinationTodos();
        } catch (err) {
            alert('Error al añadir la tarea: ' + err.message);
        }
    };

    const handleToggleTask = async (taskId, currentStatus) => {
        // Optimistic update
        setLists(prevLists => prevLists.map(list => ({
            ...list,
            tasks: list.tasks.map(task => 
                task.id === taskId ? { ...task, is_completed: !currentStatus } : task
            )
        })));

        try {
            const { error } = await supabase.rpc('toggle_coordination_todo_task', {
                p_task_id: taskId,
                p_completed: !currentStatus
            });
            if (error) throw error;
        } catch (err) {
            console.error('Error toggling task:', err);
            loadCoordinationTodos();
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('¿Deseas eliminar esta tarea?')) return;
        try {
            const { error } = await supabase.rpc('delete_coordination_todo_task', { p_task_id: taskId });
            if (error) throw error;
            loadCoordinationTodos();
        } catch (err) {
            alert('Error al eliminar la tarea: ' + err.message);
        }
    };

    const startEditTask = (task) => {
        setEditingTaskId(task.id);
        setEditTaskContent(task.content);
    };

    const handleSaveEditTask = async (taskId) => {
        if (!editTaskContent.trim()) return;
        try {
            const { error } = await supabase.rpc('update_coordination_todo_task', {
                p_task_id: taskId,
                p_content: editTaskContent.trim()
            });
            if (error) throw error;
            setEditingTaskId(null);
            loadCoordinationTodos();
        } catch (err) {
            alert('Error al editar la tarea: ' + err.message);
        }
    };

    if (loading && lists.length === 0) {
        return (
            <div className="mac-doc-card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)' }}>
                <div className="mac-status-dot" style={{ backgroundColor: '#f59e0b', margin: '0 auto 1rem auto', width: '12px', height: '12px' }}></div>
                <div>Cargando listas de planificación de Coordinación...</div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%' }}>
            {/* Create New List Form Panel */}
            <div className="mac-profile-panel" style={{
                marginBottom: '2.5rem',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                borderRadius: '20px',
                padding: '1.75rem',
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fbbf24'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20"/><path d="M17 5H7a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>
                        </svg>
                    </div>
                    <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                        Crear Nueva Lista de Tareas
                    </h3>
                </div>

                <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        <div className="mac-form-group" style={{ marginBottom: 0 }}>
                            <label className="mac-form-label">
                                Título de la Lista *
                            </label>
                            <input
                                type="text"
                                className="mac-form-input"
                                placeholder="Ej: Planificación Semanal - Revisiones"
                                value={newListTitle}
                                onChange={(e) => setNewListTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mac-form-group" style={{ marginBottom: 0 }}>
                            <label className="mac-form-label">
                                Descripción u Objetivos (Opcional)
                            </label>
                            <input
                                type="text"
                                className="mac-form-input"
                                placeholder="Ej: Auditoría de expedientes y reuniones"
                                value={newListDesc}
                                onChange={(e) => setNewListDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button
                            type="submit"
                            className="mac-btn mac-btn-primary"
                            disabled={creatingList}
                            style={{
                                background: 'linear-gradient(135deg, #d97706, #b45309)',
                                border: '1px solid rgba(251, 191, 36, 0.4)',
                                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                                padding: '0.65rem 1.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>{creatingList ? 'Creando...' : 'Crear Lista'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* To-Do Lists Display */}
            {lists.length === 0 ? (
                <div className="mac-doc-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', borderRadius: '20px' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                        No hay listas de tareas creadas.
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0, maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Utiliza el formulario superior para crear la primera lista de tareas de la división.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {lists.map(list => {
                        const tasks = list.tasks || [];
                        const completedCount = tasks.filter(t => t.is_completed).length;
                        const totalCount = tasks.length;
                        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                        const isEditingThisList = editingListId === list.id;

                        return (
                            <div key={list.id} className="mac-doc-card" style={{
                                position: 'relative',
                                background: 'rgba(15, 23, 42, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '20px',
                                padding: '1.75rem',
                                backdropFilter: 'blur(20px)'
                            }}>
                                {/* List Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        {isEditingThisList ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem', maxWidth: '600px' }}>
                                                <input
                                                    type="text"
                                                    className="mac-form-input"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    style={{ fontSize: '1.1rem', fontWeight: 700, borderColor: '#fbbf24' }}
                                                />
                                                <input
                                                    type="text"
                                                    className="mac-form-input"
                                                    value={editDesc}
                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                    placeholder="Descripción"
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                    <button onClick={() => handleSaveEditList(list.id)} className="mac-btn mac-btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Guardar</button>
                                                    <button onClick={() => setEditingListId(null)} className="mac-btn mac-btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                                                    <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#ffffff', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                                        {list.title}
                                                    </h3>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        color: '#fbbf24',
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '20px',
                                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                                        fontWeight: 700,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem'
                                                    }}>
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                                        </svg>
                                                        {new Date(list.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                {list.description && (
                                                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: 0, lineHeight: '1.5' }}>
                                                        {list.description}
                                                    </p>
                                                )}
                                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: 500 }}>
                                                    Creado por: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{list.author_name}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {!isEditingThisList && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                onClick={() => startEditList(list)}
                                                className="mac-btn mac-btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                title="Editar Lista"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteList(list.id)}
                                                className="mac-btn mac-btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                title="Eliminar Lista"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                </svg>
                                                <span>Eliminar</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* macOS Progress Bar Track */}
                                <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.9rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>Progreso de la Lista</span>
                                        <span style={{ fontWeight: 800, color: percent === 100 ? '#34d399' : '#fbbf24' }}>
                                            {completedCount} de {totalCount} tareas completadas ({percent}%)
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${percent}%`,
                                                height: '100%',
                                                background: percent === 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)',
                                                borderRadius: '9999px',
                                                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Tasks List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                                    {tasks.length === 0 ? (
                                        <div style={{ color: '#64748b', fontSize: '0.88rem', fontStyle: 'italic', padding: '0.85rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                                            No hay tareas registradas en esta lista todavía.
                                        </div>
                                    ) : (
                                        tasks.map(task => {
                                            const isEditingTask = editingTaskId === task.id;
                                            return (
                                                <div
                                                    key={task.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.85rem',
                                                        background: task.is_completed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                                                        border: task.is_completed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '12px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={task.is_completed}
                                                        onChange={() => handleToggleTask(task.id, task.is_completed)}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#f59e0b' }}
                                                    />

                                                    {isEditingTask ? (
                                                        <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                className="mac-form-input"
                                                                value={editTaskContent}
                                                                onChange={(e) => setEditTaskContent(e.target.value)}
                                                                style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}
                                                            />
                                                            <button onClick={() => handleSaveEditTask(task.id)} className="mac-btn mac-btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Guardar</button>
                                                            <button onClick={() => setEditingTaskId(null)} className="mac-btn mac-btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleToggleTask(task.id, task.is_completed)}
                                                            style={{
                                                                flex: 1,
                                                                fontSize: '0.92rem',
                                                                color: task.is_completed ? '#64748b' : '#f1f5f9',
                                                                textDecoration: task.is_completed ? 'line-through' : 'none',
                                                                cursor: 'pointer',
                                                                wordBreak: 'break-word',
                                                                fontWeight: task.is_completed ? '400' : '500'
                                                            }}
                                                        >
                                                            {task.content}
                                                        </span>
                                                    )}

                                                    {!isEditingTask && (
                                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                            <button
                                                                onClick={() => startEditTask(task)}
                                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                                                                title="Editar Tarea"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                                                                title="Eliminar Tarea"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="3 6 5 6 21 6"/>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add Task Form Input */}
                                <form onSubmit={(e) => handleAddTask(e, list.id)} style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="+ Añadir una nueva tarea a esta lista..."
                                        value={newTaskInputs[list.id] || ''}
                                        onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                                        style={{ borderStyle: 'dashed' }}
                                    />
                                    <button
                                        type="submit"
                                        className="mac-btn mac-btn-secondary"
                                        style={{
                                            background: 'rgba(245, 158, 11, 0.15)',
                                            border: '1px solid rgba(245, 158, 11, 0.35)',
                                            color: '#fbbf24',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                        </svg>
                                        <span>Añadir</span>
                                    </button>
                                </form>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default CoordinationTodoList;

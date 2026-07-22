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
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                ⏳ Cargando Tareas Pendientes de Coordinación...
            </div>
        );
    }

    return (
        <div className="coordination-todo-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Create New List Header Card */}
            <div className="dashboard-card" style={{ marginBottom: '2rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: '12px', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-gold)', fontSize: '1.2rem' }}>
                    📌 Crear Nueva Lista de Tareas Pendientes
                </h3>
                <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Nombre de la lista (ej: Pendientes Semana 30 - Julio)"
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                            style={{
                                flex: 2,
                                minWidth: '260px',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Descripción u observaciones (opcional)"
                            value={newListDesc}
                            onChange={(e) => setNewListDesc(e.target.value)}
                            style={{
                                flex: 3,
                                minWidth: '260px',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={creatingList}
                            style={{
                                background: 'linear-gradient(135deg, #d97706, #b45309)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {creatingList ? 'Creando...' : '➕ Crear Lista'}
                        </button>
                    </div>
                </form>
            </div>

            {/* To-Do Lists Display (Ordered Newest First) */}
            {lists.length === 0 ? (
                <div className="dashboard-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📝</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                        No hay listas de tareas de coordinación creadas.
                    </div>
                    <div>Crea una nueva lista arriba para empezar a organizar los pendientes de coordinación.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
                    {lists.map(list => {
                        const tasks = list.tasks || [];
                        const completedCount = tasks.filter(t => t.is_completed).length;
                        const totalCount = tasks.length;
                        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                        const isEditingThisList = editingListId === list.id;

                        return (
                            <div
                                key={list.id}
                                className="dashboard-card"
                                style={{
                                    background: 'rgba(15, 23, 42, 0.65)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                    position: 'relative'
                                }}
                            >
                                {/* List Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        {isEditingThisList ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.6)',
                                                        border: '1px solid var(--accent-gold)',
                                                        color: '#fff',
                                                        padding: '0.5rem',
                                                        borderRadius: '6px',
                                                        fontSize: '1.1rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    value={editDesc}
                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                    placeholder="Descripción"
                                                    style={{
                                                        background: 'rgba(0,0,0,0.6)',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        color: '#94a3b8',
                                                        padding: '0.4rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.85rem'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    <button onClick={() => handleSaveEditList(list.id)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Guardar</button>
                                                    <button onClick={() => setEditingListId(null)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                    <h4 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: '700' }}>
                                                        {list.title}
                                                    </h4>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', background: 'rgba(217, 119, 6, 0.15)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
                                                        {new Date(list.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                {list.description && (
                                                    <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.3rem' }}>
                                                        {list.description}
                                                    </div>
                                                )}
                                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                                                    Creado por: <span style={{ color: '#cbd5e1' }}>{list.author_name}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {!isEditingThisList && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                onClick={() => startEditList(list)}
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
                                                title="Editar Lista"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDeleteList(list.id)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
                                                title="Eliminar Lista"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div style={{ marginBottom: '1.2rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                                        <span style={{ color: '#94a3b8' }}>Progreso de la lista</span>
                                        <span style={{ fontWeight: 'bold', color: percent === 100 ? '#4ade80' : 'var(--accent-gold)' }}>
                                            {completedCount} / {totalCount} completadas ({percent}%)
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${percent}%`,
                                                height: '100%',
                                                background: percent === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #d97706, #fbbf24)',
                                                transition: 'width 0.4s ease'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Tasks List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.2rem' }}>
                                    {tasks.length === 0 ? (
                                        <div style={{ color: '#64748b', fontSize: '0.88rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                            No hay tareas en esta lista. Añade la primera tarea abajo.
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
                                                        gap: '0.75rem',
                                                        background: task.is_completed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                                                        border: task.is_completed ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                        padding: '0.6rem 0.8rem',
                                                        borderRadius: '6px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={task.is_completed}
                                                        onChange={() => handleToggleTask(task.id, task.is_completed)}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-gold)' }}
                                                    />

                                                    {isEditingTask ? (
                                                        <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                value={editTaskContent}
                                                                onChange={(e) => setEditTaskContent(e.target.value)}
                                                                style={{
                                                                    flex: 1,
                                                                    background: 'rgba(0,0,0,0.6)',
                                                                    border: '1px solid var(--accent-gold)',
                                                                    color: '#fff',
                                                                    padding: '0.3rem 0.5rem',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.9rem'
                                                                }}
                                                            />
                                                            <button onClick={() => handleSaveEditTask(task.id)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Guardar</button>
                                                            <button onClick={() => setEditingTaskId(null)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleToggleTask(task.id, task.is_completed)}
                                                            style={{
                                                                flex: 1,
                                                                fontSize: '0.92rem',
                                                                color: task.is_completed ? '#94a3b8' : '#f1f5f9',
                                                                textDecoration: task.is_completed ? 'line-through' : 'none',
                                                                cursor: 'pointer',
                                                                wordBreak: 'break-word'
                                                            }}
                                                        >
                                                            {task.content}
                                                        </span>
                                                    )}

                                                    {!isEditingTask && (
                                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                            <button
                                                                onClick={() => startEditTask(task)}
                                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', padding: '2px' }}
                                                                title="Editar Tarea"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', padding: '2px' }}
                                                                title="Eliminar Tarea"
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add Task Input */}
                                <form onSubmit={(e) => handleAddTask(e, list.id)} style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        placeholder="+ Añadir una nueva tarea a esta lista..."
                                        value={newTaskInputs[list.id] || ''}
                                        onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px dashed rgba(255,255,255,0.2)',
                                            color: '#fff',
                                            padding: '0.5rem 0.8rem',
                                            borderRadius: '6px',
                                            fontSize: '0.88rem',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        style={{
                                            background: 'rgba(217, 119, 6, 0.2)',
                                            border: '1px solid rgba(217, 119, 6, 0.4)',
                                            color: 'var(--accent-gold)',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '6px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Añadir
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

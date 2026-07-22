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
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                ⏳ Cargando Tareas Pendientes de Coordinación...
            </div>
        );
    }

    return (
        <div style={{ width: '100%' }}>
            {/* Create New List Header Card */}
            <div className="coordination-card" style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-gold)', fontSize: '1.2rem', fontWeight: '700' }}>
                    📌 Crear Nueva Lista de Tareas Pendientes
                </h3>
                <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                                Nombre / Título de la Lista *
                            </label>
                            <input
                                type="text"
                                className="coordination-input"
                                placeholder="Ej: Pendientes Semana 30 - Julio"
                                value={newListTitle}
                                onChange={(e) => setNewListTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                                Descripción u Observaciones
                            </label>
                            <input
                                type="text"
                                className="coordination-input"
                                placeholder="Ej: Revisión de expedientes, denuncias e informes"
                                value={newListDesc}
                                onChange={(e) => setNewListDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button
                            type="submit"
                            disabled={creatingList}
                            style={{
                                background: 'linear-gradient(135deg, var(--accent-gold), #b45309)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.75rem 1.8rem',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
                            }}
                        >
                            {creatingList ? 'Creando...' : '➕ Crear Lista'}
                        </button>
                    </div>
                </form>
            </div>

            {/* To-Do Lists Display (Ordered Newest First) */}
            {lists.length === 0 ? (
                <div className="coordination-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        No hay listas de tareas de coordinación creadas.
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                        Crea una nueva lista en el formulario de arriba para empezar a organizar los pendientes.
                    </div>
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
                            <div key={list.id} className="coordination-card" style={{ position: 'relative' }}>
                                {/* List Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        {isEditingThisList ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.5rem', maxWidth: '600px' }}>
                                                <input
                                                    type="text"
                                                    className="coordination-input"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    style={{ fontSize: '1.1rem', fontWeight: 'bold', borderColor: 'var(--accent-gold)' }}
                                                />
                                                <input
                                                    type="text"
                                                    className="coordination-input"
                                                    value={editDesc}
                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                    placeholder="Descripción"
                                                    style={{ fontSize: '0.88rem' }}
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                                                    <button onClick={() => handleSaveEditList(list.id)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>Guardar</button>
                                                    <button onClick={() => setEditingListId(null)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                                                        {list.title}
                                                    </h3>
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', background: 'rgba(217, 119, 6, 0.15)', padding: '3px 10px', borderRadius: '12px', border: '1px solid var(--accent-gold)', fontWeight: '600' }}>
                                                        📅 {new Date(list.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                {list.description && (
                                                    <div style={{ color: 'var(--text-primary)', fontSize: '0.92rem', marginTop: '0.4rem', opacity: 0.9 }}>
                                                        {list.description}
                                                    </div>
                                                )}
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
                                                    Creado por: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{list.author_name}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {!isEditingThisList && (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                onClick={() => startEditList(list)}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.9rem' }}
                                                title="Editar Lista"
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteList(list.id)}
                                                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.9rem' }}
                                                title="Eliminar Lista"
                                            >
                                                🗑️ Eliminar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.25)', padding: '0.9rem 1.1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Estado de avance</span>
                                        <span style={{ fontWeight: 'bold', color: percent === 100 ? '#4ade80' : 'var(--accent-gold)' }}>
                                            {completedCount} de {totalCount} tareas completadas ({percent}%)
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${percent}%`,
                                                height: '100%',
                                                background: percent === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, var(--accent-gold), #fbbf24)',
                                                transition: 'width 0.4s ease'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Tasks List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                                    {tasks.length === 0 ? (
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                            No hay tareas en esta lista. Añade la primera tarea a continuación.
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
                                                        background: task.is_completed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                                                        border: task.is_completed ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--glass-border)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '8px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={task.is_completed}
                                                        onChange={() => handleToggleTask(task.id, task.is_completed)}
                                                        style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent-gold)' }}
                                                    />

                                                    {isEditingTask ? (
                                                        <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                className="coordination-input"
                                                                value={editTaskContent}
                                                                onChange={(e) => setEditTaskContent(e.target.value)}
                                                                style={{ fontSize: '0.92rem', padding: '0.4rem 0.6rem', borderColor: 'var(--accent-gold)' }}
                                                            />
                                                            <button onClick={() => handleSaveEditTask(task.id)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Guardar</button>
                                                            <button onClick={() => setEditingTaskId(null)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            onClick={() => handleToggleTask(task.id, task.is_completed)}
                                                            style={{
                                                                flex: 1,
                                                                fontSize: '0.95rem',
                                                                color: task.is_completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                                                                textDecoration: task.is_completed ? 'line-through' : 'none',
                                                                cursor: 'pointer',
                                                                wordBreak: 'break-word',
                                                                fontWeight: task.is_completed ? 'normal' : '500'
                                                            }}
                                                        >
                                                            {task.content}
                                                        </span>
                                                    )}

                                                    {!isEditingTask && (
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button
                                                                onClick={() => startEditTask(task)}
                                                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', padding: '4px' }}
                                                                title="Editar Tarea"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: '4px' }}
                                                                title="Eliminar Tarea"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add Task Form */}
                                <form onSubmit={(e) => handleAddTask(e, list.id)} style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                        type="text"
                                        className="coordination-input"
                                        placeholder="+ Añadir una nueva tarea a esta lista..."
                                        value={newTaskInputs[list.id] || ''}
                                        onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                                        style={{ borderStyle: 'dashed' }}
                                    />
                                    <button
                                        type="submit"
                                        style={{
                                            background: 'rgba(217, 119, 6, 0.2)',
                                            border: '1px solid var(--accent-gold)',
                                            color: 'var(--accent-gold)',
                                            padding: '0.65rem 1.25rem',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        ➕ Añadir
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

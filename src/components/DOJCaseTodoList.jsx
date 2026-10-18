import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

function DOJCaseTodoList({ caseId }) {
    const { language } = useLanguage();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Edit Category State
    const [editingCatId, setEditingCatId] = useState(null);
    const [editCatName, setEditCatName] = useState('');

    // New Task State (Map of categoryId -> taskContent)
    const [newTaskInputs, setNewTaskInputs] = useState({});

    useEffect(() => {
        loadTodos();
    }, [caseId]);

    const loadTodos = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_doj_case_todos', { p_case_id: caseId });
            if (error) throw error;
            setCategories(data || []);
        } catch (err) {
            console.error("Error loading todos:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) {
            alert(language === 'es' ? "Por favor ingrese un nombre para la nueva lista." : "Please enter a name for the new list first.");
            return;
        }

        try {
            const { error } = await supabase.rpc('create_doj_todo_category', {
                p_case_id: caseId,
                p_name: newCategoryName
            });

            if (error) throw error;
            setNewCategoryName('');
            loadTodos();
        } catch (err) {
            alert("Error adding category: " + err.message);
        }
    };

    const handleDeleteCategory = async (catId) => {
        if (!window.confirm(language === 'es' ? "¿Eliminar esta categoría y todas sus tareas?" : "Delete this category and all its tasks?")) return;
        try {
            const { error } = await supabase.rpc('delete_doj_todo_category', { p_category_id: catId });
            if (error) throw error;
            loadTodos();
        } catch (err) {
            alert("Error deleting category: " + err.message);
        }
    };

    const startEditCategory = (cat) => {
        setEditingCatId(cat.id);
        setEditCatName(cat.name);
    };

    const saveEditCategory = async () => {
        try {
            const { error } = await supabase.rpc('update_doj_todo_category', {
                p_category_id: editingCatId,
                p_name: editCatName
            });
            if (error) throw error;
            setEditingCatId(null);
            loadTodos();
        } catch (err) {
            alert("Error renaming category: " + err.message);
        }
    };

    // --- Task Handlers ---

    const handleAddTask = async (e, catId) => {
        e.preventDefault();
        const content = newTaskInputs[catId];
        if (!content || !content.trim()) return;

        try {
            const { error } = await supabase.rpc('create_doj_todo_task', {
                p_category_id: catId,
                p_content: content
            });
            if (error) throw error;

            setNewTaskInputs(prev => ({ ...prev, [catId]: '' }));
            loadTodos();
        } catch (err) {
            alert("Error adding task: " + err.message);
        }
    };

    const handleToggleTask = async (taskId, currentStatus) => {
        try {
            const { error } = await supabase.rpc('toggle_doj_todo_task', {
                p_task_id: taskId,
                p_is_completed: !currentStatus
            });
            if (error) throw error;
            loadTodos();
        } catch (err) {
            alert("Error toggling task: " + err.message);
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            const { error } = await supabase.rpc('delete_doj_todo_task', { p_task_id: taskId });
            if (error) throw error;
            loadTodos();
        } catch (err) {
            alert("Error deleting task: " + err.message);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#3b82f6', display: 'inline-block', marginBottom: '0.5rem' }}></span>
                <div>{language === 'es' ? 'Cargando tareas del sumario...' : 'Loading case tasks...'}</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header: Add Category Bar */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0.85rem 1.25rem',
                borderRadius: '16px',
                backdropFilter: 'blur(12px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#60a5fa'
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 11 12 14 22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                            {language === 'es' ? 'Listas de Diligencias & Tareas' : 'Task Lists & Action Items'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {categories.length} {language === 'es' ? 'listas registradas' : 'categories active'}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleAddCategory} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder={language === 'es' ? 'Nombre de nueva lista...' : 'New list title...'}
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        className="mac-form-input"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', width: '220px', borderRadius: '10px' }}
                    />
                    <button
                        type="submit"
                        className="mac-btn mac-btn-primary"
                        style={{
                            padding: '0.45rem 0.95rem',
                            fontSize: '0.82rem',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.25)',
                            borderColor: 'rgba(59, 130, 246, 0.5)',
                            color: '#93c5fd',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        {language === 'es' ? '+ Crear Lista' : '+ Add List'}
                    </button>
                </form>
            </div>

            {/* Columns Grid */}
            {categories.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '3rem 1.5rem',
                    background: 'rgba(15, 23, 42, 0.45)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                    borderRadius: '20px',
                    color: '#94a3b8'
                }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="9" y1="9" x2="15" y2="9"/>
                        <line x1="9" y1="13" x2="15" y2="13"/>
                        <line x1="9" y1="17" x2="13" y2="17"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                        {language === 'es' ? 'No hay listas de tareas creadas' : 'No task lists created yet'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Crea una categoría arriba para registrar diligencias y seguimiento del caso.' : 'Create a category above to start organizing case milestones.'}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'start'
                }}>
                    {categories.map(cat => {
                        const totalTasks = cat.tasks ? cat.tasks.length : 0;
                        const completedTasks = cat.tasks ? cat.tasks.filter(t => t.is_completed).length : 0;
                        const isEditing = editingCatId === cat.id;

                        return (
                            <div
                                key={cat.id}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '18px',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.4)'
                                }}
                            >
                                {/* Column Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingBottom: '0.75rem',
                                    marginBottom: '0.75rem',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                                }}>
                                    {isEditing ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1 }}>
                                            <input
                                                type="text"
                                                value={editCatName}
                                                onChange={e => setEditCatName(e.target.value)}
                                                className="mac-form-input"
                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                                autoFocus
                                            />
                                            <button 
                                                onClick={saveEditCategory} 
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', fontSize: '1rem' }}
                                                title="Guardar"
                                            >
                                                ✓
                                            </button>
                                            <button 
                                                onClick={() => setEditingCatId(null)} 
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                                                title="Cancelar"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
                                                    {cat.name}
                                                </h4>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    padding: '0.15rem 0.45rem',
                                                    borderRadius: '6px',
                                                    background: completedTasks === totalTasks && totalTasks > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                                    color: completedTasks === totalTasks && totalTasks > 0 ? '#34d399' : '#94a3b8'
                                                }}>
                                                    {completedTasks}/{totalTasks}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <button
                                                    onClick={() => startEditCategory(cat)}
                                                    title={language === 'es' ? 'Renombrar lista' : 'Rename list'}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(cat.id)}
                                                    title={language === 'es' ? 'Eliminar lista' : 'Delete list'}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Tasks Items */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.85rem' }}>
                                    {(!cat.tasks || cat.tasks.length === 0) ? (
                                        <div style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                            {language === 'es' ? 'Sin tareas pendientes' : 'No tasks pending'}
                                        </div>
                                    ) : (
                                        cat.tasks.map(task => (
                                            <div
                                                key={task.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.65rem',
                                                    background: task.is_completed ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                                    borderLeft: task.is_completed ? '3px solid #10b981' : '3px solid #3b82f6',
                                                    borderRadius: '10px',
                                                    padding: '0.55rem 0.75rem',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={task.is_completed}
                                                    onChange={() => handleToggleTask(task.id, task.is_completed)}
                                                    style={{ accentColor: '#10b981', cursor: 'pointer', width: '15px', height: '15px' }}
                                                />
                                                <span style={{
                                                    flex: 1,
                                                    fontSize: '0.84rem',
                                                    color: task.is_completed ? '#64748b' : '#f1f5f9',
                                                    textDecoration: task.is_completed ? 'line-through' : 'none',
                                                    lineHeight: 1.35
                                                }}>
                                                    {task.content}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#64748b',
                                                        cursor: 'pointer',
                                                        padding: '0.1rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        opacity: 0.6
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Add Task Input */}
                                <form onSubmit={(e) => handleAddTask(e, cat.id)}>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            placeholder={language === 'es' ? "+ Añadir diligencia / tarea..." : "+ Add action item..."}
                                            value={newTaskInputs[cat.id] || ''}
                                            onChange={e => setNewTaskInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                            className="mac-form-input"
                                            style={{
                                                padding: '0.45rem 2rem 0.45rem 0.75rem',
                                                fontSize: '0.82rem',
                                                borderRadius: '10px',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                border: '1px dashed rgba(255, 255, 255, 0.15)'
                                            }}
                                        />
                                        {newTaskInputs[cat.id] && (
                                            <button
                                                type="submit"
                                                style={{
                                                    position: 'absolute',
                                                    right: '6px',
                                                    background: '#3b82f6',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '2px 7px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ↵
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default DOJCaseTodoList;

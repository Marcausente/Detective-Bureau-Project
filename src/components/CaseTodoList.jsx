import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function CaseTodoList({ caseId }) {
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
            const { data, error } = await supabase.rpc('get_case_todos', { p_case_id: caseId });
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
            alert("Please enter a name for the new list first.");
            return;
        }

        try {
            const { error } = await supabase.rpc('create_todo_category', {
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
        if (!window.confirm("Delete this category and all its tasks?")) return;
        try {
            const { error } = await supabase.rpc('delete_todo_category', { p_category_id: catId });
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
            const { error } = await supabase.rpc('update_todo_category', {
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
            const { error } = await supabase.rpc('create_todo_task', {
                p_category_id: catId,
                p_content: content
            });
            if (error) throw error;

            // Clear input for this category
            setNewTaskInputs(prev => ({ ...prev, [catId]: '' }));
            loadTodos();
        } catch (err) {
            alert("Error adding task: " + err.message);
        }
    };

    const handleToggleTask = async (taskId, currentStatus) => {
        try {
            // Optimistic update (optional, but let's just reload for safety first)
            const { error } = await supabase.rpc('toggle_todo_task', {
                p_task_id: taskId,
                p_status: !currentStatus
            });
            if (error) throw error;
            loadTodos();
        } catch (err) {
            console.error("Error toggling task:", err);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Remove this task?")) return;
        try {
            const { error } = await supabase.rpc('delete_todo_task', { p_task_id: taskId });
            if (error) throw error;
            loadTodos();
        } catch (err) {
            alert("Error deleting task: " + err.message);
        }
    };

    if (loading) return <div style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading Tasks...</div>;

    return (
        <div className="todo-board">
            {/* Header: Add Category */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ margin: 0 }}>Project Tasks</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder="New Category Name..."
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(e); }}
                        className="form-input"
                        style={{ padding: '0.4rem', fontSize: '0.9rem', width: '200px' }}
                    />
                    <button
                        type="button"
                        onClick={handleAddCategory}
                        className="login-button"
                        style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.9rem' }}
                    >
                        + Add List
                    </button>
                </div>
            </div>

            {/* Board Columns */}
            <div className="todo-columns" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '1rem' }}>
                {categories.map(cat => (
                    <div key={cat.id} className="todo-column" style={{
                        width: '100%',
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Column Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                            {editingCatId === cat.id ? (
                                <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                                    <input
                                        type="text"
                                        value={editCatName}
                                        onChange={e => setEditCatName(e.target.value)}
                                        className="form-input"
                                        style={{ padding: '2px 5px', fontSize: '0.9rem' }}
                                        autoFocus
                                    />
                                    <button onClick={saveEditCategory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80' }}>✓</button>
                                    <button onClick={() => setEditingCatId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}>✗</button>
                                </div>
                            ) : (
                                <>
                                    <h4 style={{ margin: 0, color: 'var(--accent-gold)', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>{cat.name}</h4>
                                    <div className="column-actions">
                                        <button onClick={() => startEditCategory(cat)} title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, marginRight: '5px' }}>✎</button>
                                        <button onClick={() => handleDeleteCategory(cat.id)} title="Delete List" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, color: '#f87171' }}>🗑️</button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Tasks List */}
                        <div className="tasks-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {cat.tasks && cat.tasks.map(task => (
                                <div key={task.id} style={{
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    padding: '0.8rem',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    opacity: task.is_completed ? 0.6 : 1,
                                    borderLeft: task.is_completed ? '2px solid #4ade80' : '2px solid var(--text-secondary)'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={task.is_completed}
                                        onChange={() => handleToggleTask(task.id, task.is_completed)}
                                        style={{ marginTop: '4px', cursor: 'pointer', accentColor: 'var(--accent-gold)' }}
                                    />
                                    <span style={{
                                        flex: 1,
                                        fontSize: '0.9rem',
                                        textDecoration: task.is_completed ? 'line-through' : 'none',
                                        color: task.is_completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                                        wordBreak: 'break-word'
                                    }}>
                                        {task.content}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', opacity: 0.5, fontSize: '0.8rem' }}
                                        title="Delete Task"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Task Form */}
                        <form onSubmit={(e) => handleAddTask(e, cat.id)}>
                            <input
                                type="text"
                                placeholder="+ Add a task"
                                value={newTaskInputs[cat.id] || ''}
                                onChange={e => setNewTaskInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                className="form-input"
                                style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--glass-border)' }}
                            />
                        </form>
                    </div>
                ))}
            </div>

            {categories.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem', border: '2px dashed var(--glass-border)', borderRadius: '8px' }}>
                    <p>No To-Do lists created yet.</p>
                    <p style={{ fontSize: '0.9rem' }}>Create a category above to start tracking tasks.</p>
                </div>
            )}
        </div>
    );
}

export default CaseTodoList;

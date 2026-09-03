import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

function CaseTodoList({ caseId }) {
    const { t, language } = useLanguage();
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
            alert(t('alertCategoryNameRequired'));
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
        if (!window.confirm(t('confirmDeleteCategory'))) return;
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
        if (!window.confirm(t('confirmDeleteTask'))) return;
        try {
            const { error } = await supabase.rpc('delete_todo_task', { p_task_id: taskId });
            if (error) throw error;
            loadTodos();
        } catch (err) {
            alert("Error deleting task: " + err.message);
        }
    };

    // Helper: Find existing block on whiteboard for category
    const handleSendTaskToBoard = async (task, catName) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: existingNodes } = await supabase
                .from('case_board_nodes')
                .select('*')
                .eq('case_id', caseId)
                .eq('category', 'todo');

            const existingBlock = (existingNodes || []).find(n => {
                try {
                    const parsed = JSON.parse(n.content);
                    if (parsed.todo_category_id === task.category_id || parsed.category_name === catName) return true;
                } catch { }
                return n.title === catName;
            });

            if (existingBlock) {
                let extra = {};
                try { extra = JSON.parse(existingBlock.content); } catch { }
                const currentTasks = Array.isArray(extra.tasks) ? extra.tasks : [];
                const taskIdx = currentTasks.findIndex(t => t.id === task.id);
                if (taskIdx >= 0) {
                    currentTasks[taskIdx] = { id: task.id, content: task.content, is_completed: task.is_completed };
                } else {
                    currentTasks.push({ id: task.id, content: task.content, is_completed: task.is_completed });
                }
                extra.tasks = currentTasks;
                extra.todo_category_id = task.category_id || extra.todo_category_id;
                extra.category_name = catName;

                await supabase.from('case_board_nodes').update({
                    content: JSON.stringify(extra),
                    title: catName
                }).eq('id', existingBlock.id);
            } else {
                const payload = {
                    case_id: caseId,
                    title: catName || 'To-Do',
                    content: JSON.stringify({
                        todo_category_id: task.category_id || null,
                        category_name: catName || 'To-Do',
                        tasks: [{ id: task.id, content: task.content, is_completed: task.is_completed }]
                    }),
                    category: 'todo',
                    color: 'blue',
                    width: 320,
                    pos_x: 120 + Math.floor(Math.random() * 120),
                    pos_y: 120 + Math.floor(Math.random() * 120),
                    created_by: user ? user.id : null
                };
                await supabase.from('case_board_nodes').insert([payload]);
            }

            alert(t('taskAddedToBoard') || '¡Tarea añadida a la pizarra!');
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleSendCategoryToBoard = async (cat) => {
        if (!cat.tasks || cat.tasks.length === 0) {
            alert(language === 'es' ? 'La lista no tiene tareas para enviar.' : 'This list has no tasks to send.');
            return;
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: existingNodes } = await supabase
                .from('case_board_nodes')
                .select('*')
                .eq('case_id', caseId)
                .eq('category', 'todo');

            const existingBlock = (existingNodes || []).find(n => {
                try {
                    const parsed = JSON.parse(n.content);
                    if (parsed.todo_category_id === cat.id || parsed.category_name === cat.name) return true;
                } catch { }
                return n.title === cat.name;
            });

            const updatedTasks = cat.tasks.map(t => ({ id: t.id, content: t.content, is_completed: t.is_completed }));

            if (existingBlock) {
                let extra = {};
                try { extra = JSON.parse(existingBlock.content); } catch { }
                extra.todo_category_id = cat.id;
                extra.category_name = cat.name;
                extra.tasks = updatedTasks;

                await supabase.from('case_board_nodes').update({
                    content: JSON.stringify(extra),
                    title: cat.name
                }).eq('id', existingBlock.id);
            } else {
                const payload = {
                    case_id: caseId,
                    title: cat.name,
                    content: JSON.stringify({
                        todo_category_id: cat.id,
                        category_name: cat.name,
                        tasks: updatedTasks
                    }),
                    category: 'todo',
                    color: 'blue',
                    width: 340,
                    pos_x: 120 + Math.floor(Math.random() * 120),
                    pos_y: 120 + Math.floor(Math.random() * 120),
                    created_by: user ? user.id : null
                };
                await supabase.from('case_board_nodes').insert([payload]);
            }

            alert(t('categoryAddedToBoard') || '¡Lista de tareas añadida a la pizarra!');
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    if (loading) return (
        <div className="mac-doc-empty">
            <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite' }}></span>
            <span>{t('loadingTasks') || 'Cargando lista de tareas...'}</span>
        </div>
    );

    return (
        <div className="todo-board">
            {/* Header: Add Category */}
            <div className="mac-widget-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff' }}>{t('projectTasksTitle') || 'Lista de Tareas del Proyecto'}</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder={t('newCategoryPlaceholder') || 'Nueva Categoría / Lista...'}
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(e); }}
                        className="mac-form-input"
                        style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', width: '220px' }}
                    />
                    <button
                        type="button"
                        onClick={handleAddCategory}
                        className="mac-btn mac-btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                        {t('addListBtn') || '+ Añadir Lista'}
                    </button>
                </div>
            </div>

            {/* Board Columns */}
            <div className="todo-columns" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>
                {categories.map(cat => (
                    <div key={cat.id} className="mac-widget-card" style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '1.25rem'
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
                                    <div className="column-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            onClick={() => handleSendCategoryToBoard(cat)}
                                            title={language === 'es' ? 'Enviar toda la lista a la Pizarra' : 'Send all tasks to Whiteboard'}
                                            style={{ background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.4)', borderRadius: '4px', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: '0.75rem', padding: '2px 8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-2l-2-2V5h1V3H6v2h1v8l-2 2v2z" /></svg>
                                            <span>{t('addToBoardBtn') || 'A Pizarra'}</span>
                                        </button>
                                        <button 
                                            onClick={() => { startEditCategory(cat); }} 
                                            title={t('renameTooltip')} 
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCategory(cat.id)} 
                                            title={t('deleteListTooltip')} 
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '2px', opacity: 0.7 }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                        </button>
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
                                        onClick={() => handleSendTaskToBoard(task, cat.name)}
                                        style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '3px', color: 'var(--text-primary)', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center' }}
                                        title={language === 'es' ? 'Enviar tarea individual a la Pizarra' : 'Send task to Whiteboard'}
                                    >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-2l-2-2V5h1V3H6v2h1v8l-2 2v2z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', opacity: 0.5, padding: '2px', display: 'flex', alignItems: 'center' }}
                                        title={t('deleteTaskTooltip')}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Task Form */}
                        <form onSubmit={(e) => handleAddTask(e, cat.id)}>
                            <input
                                type="text"
                                placeholder={t('addTaskPlaceholder')}
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
                    <p>{t('noTodoLists')}</p>
                    <p style={{ fontSize: '0.9rem' }}>{t('createCategoryPrompt')}</p>
                </div>
            )}
        </div>
    );
}

export default CaseTodoList;

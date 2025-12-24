import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

function Personnel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*');

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching personnel:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Rank Priorities (Higher number = Higher Rank)
    const rankPriority = {
        'Capitan': 100,
        'Teniente': 90,
        'Detective III': 80,
        'Detective II': 70,
        'Detective I': 60,
        'Oficial III+': 50,
        'Oficial III': 40,
        'Oficial II': 30
    };

    const getRankPriority = (rank) => rankPriority[rank] || 0;

    const sortUsers = (a, b) => getRankPriority(b.rango) - getRankPriority(a.rango);

    const detectives = users
        .filter(u => ['Detective I', 'Detective II', 'Detective III'].includes(u.rango))
        .sort(sortUsers);

    const helpers = users
        .filter(u => ['Oficial II', 'Oficial III', 'Oficial III+'].includes(u.rango))
        .sort(sortUsers);

    const command = users
        .filter(u => ['Capitan', 'Teniente'].includes(u.rango))
        .sort(sortUsers);

    const UserCard = ({ user }) => (
        <div className="personnel-card">
            <div className="personnel-image-container">
                {user.profile_image ? (
                    <img src={user.profile_image} alt={`${user.nombre} ${user.apellido}`} className="personnel-image" />
                ) : (
                    <div className="personnel-placeholder-image" />
                )}
            </div>
            <div className="personnel-info">
                <div className="personnel-rank">{user.rango}</div>
                <div className="personnel-name">{user.nombre} {user.apellido}</div>
                <div className="personnel-badge">#{user.no_placa || '---'}</div>
            </div>
        </div>
    );

    if (loading) return <div className="loading-container">Loading Personnel...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="personnel-container">
            <h2 className="page-title">Bureau Personnel</h2>

            <div className="personnel-grid">
                {/* Detectives Column */}
                <div className="personnel-column">
                    <h3 className="column-title">Detectives</h3>
                    <div className="personnel-list">
                        {detectives.length > 0 ? (
                            detectives.map(user => <UserCard key={user.id} user={user} />)
                        ) : (
                            <div className="empty-list">No detectives found</div>
                        )}
                    </div>
                </div>

                {/* Helpers (Ayudantes) Column */}
                <div className="personnel-column">
                    <h3 className="column-title">Ayudantes</h3>
                    <div className="personnel-list">
                        {helpers.length > 0 ? (
                            helpers.map(user => <UserCard key={user.id} user={user} />)
                        ) : (
                            <div className="empty-list">No oficiales found</div>
                        )}
                    </div>
                </div>

                {/* Command Column */}
                <div className="personnel-column">
                    <h3 className="column-title">Comisionado</h3>
                    <div className="personnel-list">
                        {command.length > 0 ? (
                            command.map(user => <UserCard key={user.id} user={user} />)
                        ) : (
                            <div className="empty-list">No command staff found</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Personnel;

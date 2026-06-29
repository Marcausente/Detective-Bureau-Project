import { useNavigate } from 'react-router-dom';
import '../index.css';

function IAReceptorDenuncias() {
    const navigate = useNavigate();

    const optionCards = [
        {
            title: "Opción A: Tabla Compartida (denuncias)",
            icon: "🔀",
            description: "Integrar las denuncias de IA en la tabla general agregando una columna `is_ia` (booleano). Se aplican políticas RLS de Supabase para asegurar que solo el personal de Asuntos Internos pueda consultarlas o modificarlas.",
            badge: "Recomendado para simplicidad"
        },
        {
            title: "Opción B: Tabla Independiente (ia_denuncias)",
            icon: "🛡️",
            description: "Crear una tabla de base de datos dedicada exclusivamente a denuncias de Asuntos Internos. Esto permite campos totalmente personalizados como agente investigado, nivel de urgencia/confidencialidad y notas cifradas.",
            badge: "Máxima Confidencialidad"
        },
        {
            title: "Opción C: Integración Externa (Discord Webhook)",
            icon: "🔔",
            description: "Enviar notificaciones automatizadas directamente a un canal privado de Discord/Slack mediante webhooks cuando se reciba una denuncia, facilitando el seguimiento rápido por parte de los supervisores.",
            badge: "Notificaciones en Tiempo Real"
        }
    ];

    return (
        <div className="documentation-container" style={{
            padding: '2rem',
            maxWidth: '1200px',
            margin: '0 auto',
            minHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Back Button */}
            <div style={{ marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
                <button
                    onClick={() => navigate('/internal-affairs')}
                    className="login-button btn-secondary"
                    style={{
                        width: 'auto',
                        padding: '0.6rem 1.2rem',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#ef4444';
                        e.currentTarget.style.color = '#f8fafc';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                    }}
                >
                    ← Volver a Asuntos Internos
                </button>
            </div>

            {/* Header */}
            <div className="doc-header" style={{
                marginBottom: '3rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                paddingBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '12px',
                        width: '60px',
                        height: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3b82f6',
                        fontSize: '1.8rem',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                        📥
                    </div>
                    <div>
                        <h2 className="page-title" style={{ margin: 0, color: '#f8fafc', fontSize: '2rem', letterSpacing: '1px' }}>
                            Receptor de Denuncias
                        </h2>
                        <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                            Módulo de Asuntos Internos para la recepción y gestión de reportes confidenciales.
                        </p>
                    </div>
                </div>
            </div>

            {/* Welcome & Instruction Box */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.8))',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '16px',
                padding: '2.5rem',
                marginBottom: '3rem',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                animation: 'fadeIn 0.8s ease-out'
            }}>
                <h3 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: '600' }}>
                    🚀 ¡Módulo preparado con éxito!
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: '1.7', maxWidth: '800px', margin: '0 auto 1.5rem' }}>
                    El acceso y la interfaz del **Receptor de Denuncias** ya están integrados en el sistema de Asuntos Internos.
                    Por favor, indícanos qué campos específicos, base de datos o lógica deseas agregar a continuación (por ejemplo, formulario de registro, bandeja de entrada, filtros de estado).
                </p>
                <div style={{
                    display: 'inline-block',
                    padding: '0.5rem 1.5rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '9999px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    Esperando tus especificaciones
                </div>
            </div>

            {/* Design Options Grid */}
            <h4 style={{ color: '#f8fafc', fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                Opciones sugeridas para el flujo de datos:
            </h4>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '2rem',
                marginBottom: '3rem'
            }}>
                {optionCards.map((card, idx) => (
                    <div
                        key={idx}
                        style={{
                            background: 'rgba(30, 41, 59, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '12px',
                            padding: '1.8rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'all 0.3s ease',
                            position: 'relative'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
                            e.currentTarget.style.transform = 'translateY(-3px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.3)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div>
                            <div style={{
                                width: '45px',
                                height: '45px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.4rem',
                                marginBottom: '1.2rem'
                            }}>
                                {card.icon}
                            </div>
                            <h5 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '0.8rem', fontWeight: '600' }}>
                                {card.title}
                            </h5>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                                {card.description}
                            </p>
                        </div>
                        <div style={{ marginTop: '1.5rem' }}>
                            <span style={{
                                display: 'inline-block',
                                fontSize: '0.75rem',
                                color: '#94a3b8',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontWeight: '500'
                            }}>
                                {card.badge}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default IAReceptorDenuncias;

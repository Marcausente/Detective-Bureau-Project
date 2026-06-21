import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Ballistics() {
    const { t } = useLanguage();

    return (
        <div className="documentation-container" style={{ padding: '2rem' }}>
            <div className="doc-section">
                <div className="doc-header" style={{ marginBottom: '2rem' }}>
                    <h2 className="page-title">{t('ballistics')}</h2>
                </div>
                <div 
                    className="empty-list" 
                    style={{ 
                        textAlign: 'center', 
                        padding: '4rem 2rem', 
                        background: 'rgba(0,0,0,0.2)', 
                        borderRadius: '12px', 
                        border: '1px dashed rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px'
                    }}
                >
                    <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🔫</div>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {t('ballistics_module_desc') || 'Módulo de Balística de la División de Detective Bureau.'}
                    </p>
                    <div 
                        className="construction-line" 
                        style={{ 
                            marginTop: '2rem', 
                            width: '120px', 
                            height: '4px', 
                            background: 'var(--accent-color, #3b82f6)', 
                            borderRadius: '2px' 
                        }}
                    ></div>
                </div>
            </div>
        </div>
    );
}

export default Ballistics;

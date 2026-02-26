import React, { useState } from 'react';
import PracticeArchive from '../../components/Training/PracticeArchive';
import PracticeSchedule from '../../components/Training/PracticeSchedule';
import '../../index.css';

function TrainingBase() {
    const [activeTab, setActiveTab] = useState('archive');

    return (
        <div className="section-container training-base">
            <header className="section-header">
                <h2>Detective Training Program</h2>
            </header>
            
            <div className="custom-tabs">
                <button 
                    className={`custom-tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('archive')}
                >
                    Archivo de Prácticas
                </button>
                <button 
                    className={`custom-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    Programación de Prácticas
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'archive' && <PracticeArchive />}
                {activeTab === 'schedule' && <PracticeSchedule />}
            </div>
        </div>
    );
}

export default TrainingBase;

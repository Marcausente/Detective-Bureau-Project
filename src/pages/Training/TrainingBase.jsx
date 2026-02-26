import React, { useState } from 'react';
import PracticeArchive from '../../components/Training/PracticeArchive';
import PracticeSchedule from '../../components/Training/PracticeSchedule';
import './Training.css'; // Import the new CSS file

function TrainingBase() {
    const [activeTab, setActiveTab] = useState('archive');

    return (
        <div className="dtp-container">
            <header className="dtp-header">
                <img src="/DTP%20logo.png" alt="DTP Logo" className="dtp-logo" />
                <div className="dtp-title-wrapper">
                    <h1>Detective Training Program</h1>
                    <p>Departamento de Instrucción y Capacitación Continua</p>
                </div>
            </header>
            
            <div className="dtp-tabs">
                <button 
                    className={`dtp-tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('archive')}
                >
                    <i className="fas fa-folder-open" style={{marginRight: '8px'}}></i> Archive
                </button>
                <button 
                    className={`dtp-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    <i className="fas fa-calendar-alt" style={{marginRight: '8px'}}></i> Schedule
                </button>
            </div>

            <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {activeTab === 'archive' && <PracticeArchive />}
                {activeTab === 'schedule' && <PracticeSchedule />}
            </div>
        </div>
    );
}

export default TrainingBase;

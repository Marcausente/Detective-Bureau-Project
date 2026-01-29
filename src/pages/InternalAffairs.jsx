import { useState, useEffect } from 'react';
import '../index.css';

function InternalAffairs() {
    return (
        <div className="dashboard-container">
            <h1 className="page-title">Internal Affairs Division</h1>
            <div className="dashboard-grid">
                <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
                    <h3>Restricted Access Area</h3>
                    <p>Welcome to the Internal Affairs Division portal. This section is strictly confidential.</p>
                </div>
                {/* Future modules can be added here */}
                <div className="dashboard-card">
                    <h4>Active Investigations</h4>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>0</div>
                    <p style={{ color: 'var(--text-secondary)' }}>Ongoing internal inquiries</p>
                </div>
                <div className="dashboard-card">
                    <h4>Review Queue</h4>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>0</div>
                    <p style={{ color: 'var(--text-secondary)' }}>Reports pending review</p>
                </div>
            </div>
        </div>
    );
}

export default InternalAffairs;

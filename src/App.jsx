import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PlaceholderPage from './pages/PlaceholderPage';
import Welcome from './pages/Welcome';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail'; // Import
import Gangs from './pages/Gangs'; // Import
import Incidents from './pages/Incidents'; // Import
import Personnel from './pages/Personnel';
import PersonnelDetail from './pages/PersonnelDetail';
import Documentation from './pages/Documentation';
import Interrogations from './pages/Interrogations';
import CrimeMap from './pages/CrimeMap'; // Import
import PublicGangMap from './pages/PublicGangMap'; // Import
import InternalAffairs from './pages/InternalAffairs'; // Import
import IACases from './pages/IACases';
import IACaseDetail from './pages/IACaseDetail';
import IADocumentation from './pages/IADocumentation';
import IAInterrogations from './pages/IAInterrogations';
import IASanctions from './pages/IASanctions';
import IASanctionProfile from './pages/IASanctionProfile';
import MainLayout from './components/MainLayout';
import { PresenceProvider } from './contexts/PresenceContext';
import './index.css';

function App() {
  // Main Entry Point
  return (
    <PresenceProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />
          <Route path="/public-map" element={<PublicGangMap />} />

          {/* Interstitial Route */}
          <Route path="/welcome" element={<Welcome />} />

          {/* Protected Routes (wrapped in MainLayout) */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/:id" element={<CaseDetail />} /> {/* New Route */}
            <Route path="/gangs" element={<Gangs />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/interrogations" element={<Interrogations />} />
            <Route path="/crimemap" element={<CrimeMap />} />
            <Route path="/personnel" element={<Personnel />} />
            <Route path="/personnel/:id" element={<PersonnelDetail />} />
            <Route path="/internal-affairs" element={<InternalAffairs />} />
            <Route path="/internal-affairs/cases" element={<IACases />} />
            <Route path="/internal-affairs/cases/:id" element={<IACaseDetail />} />
            <Route path="/internal-affairs/docs" element={<IADocumentation />} />
            <Route path="/internal-affairs/interrogations" element={<IAInterrogations />} />
            <Route path="/internal-affairs/sanctions" element={<IASanctions />} />
            <Route path="/internal-affairs/sanctions/:id" element={<IASanctionProfile />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </PresenceProvider>
  );
}

export default App;

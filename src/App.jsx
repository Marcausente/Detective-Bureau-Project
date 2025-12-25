import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PlaceholderPage from './pages/PlaceholderPage';
import Welcome from './pages/Welcome';
import Personnel from './pages/Personnel';
import PersonnelDetail from './pages/PersonnelDetail';
import Documentation from './pages/Documentation';
import Interrogations from './pages/Interrogations';
import MainLayout from './components/MainLayout';
import { PresenceProvider } from './contexts/PresenceContext';
import './index.css';

function App() {
  return (
    <PresenceProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* Interstitial Route */}
          <Route path="/welcome" element={<Welcome />} />

          {/* Protected Routes (wrapped in MainLayout) */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/cases" element={<PlaceholderPage title="Criminal Cases" />} />
            <Route path="/gangs" element={<PlaceholderPage title="Gang Intelligence" />} />
            <Route path="/interrogations" element={<Interrogations />} />
            <Route path="/personnel" element={<Personnel />} />
            <Route path="/personnel/:id" element={<PersonnelDetail />} />
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

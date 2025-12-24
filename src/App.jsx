import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PlaceholderPage from './pages/PlaceholderPage';

import MainLayout from './components/MainLayout';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Protected Routes (wrapped in MainLayout) */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documentation" element={<PlaceholderPage title="Documentation" />} />
          <Route path="/cases" element={<PlaceholderPage title="Criminal Cases" />} />
          <Route path="/gangs" element={<PlaceholderPage title="Gang Intelligence" />} />
          <Route path="/interrogations" element={<PlaceholderPage title="Interrogations" />} />
          <Route path="/personnel" element={<PlaceholderPage title="Bureau Personnel" />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App

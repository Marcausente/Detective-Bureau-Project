import { useState } from 'react'
import './index.css' // Ensure we are using the global styles (or keep imports as is if global)
// Assuming styles are in index.css as rewritten
import './App.css' // We might not need this if we put everything in index.css, but keeping for safety or deleting content later.

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    console.log("Login attempt:", username);
    // Future login logic here
  };

  return (
    <div className="app-container">
      {/* Background */}
      <div className="background-container">
        <img src="/indeximage.png" alt="Background" className="background-image" />
      </div>

      {/* Header */}
      <header className="header">
        <img src="/LOGO_SAPD.png" alt="SAPD Logo" className="header-logo" />
        <div className="header-title-container">
          <h1 className="header-title">Los Santos Police Department</h1>
          <div className="header-subtitle">Detective Bureau</div>
        </div>
        <img src="/dblogo.png" alt="Detective Bureau Logo" className="header-logo" />
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="login-card">
          <div className="login-header">
            <h2>Authorized Access</h2>
            <p>Please identify yourself, Detective.</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Badge Number / Username</label>
              <input 
                type="text" 
                className="form-input" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: 4284"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="login-button">
              Access System
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default App

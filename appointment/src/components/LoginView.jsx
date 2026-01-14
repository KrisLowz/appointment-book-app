import { useState } from 'react';
import { signIn, signUp } from '../auth/authApi';

export default function LoginView() {
  const [authMode, setAuthMode] = useState('login');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  const handleSupabaseSubmit = async (event) => {
    event.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        await signUp({ email: authEmail, password: authPassword, fullName: authFullName });
      } else {
        await signIn({ email: authEmail, password: authPassword });
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/assets/Mr_Bur_Logo-01.png" alt="MR.BUR" />
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to access your appointments</p>
        <div className="login-sample-accounts">
          <div className="login-sample-title">Sample Dentist account:</div>
          <div className="login-sample-item">Email: mrbur123@gmail.com</div>
          <div className="login-sample-item">Password: mrbur@123</div>
          <div className="login-sample-title" style={{ marginTop: 10 }}>Sample Admin account:</div>
          <div className="login-sample-item">Email: adminbur@gmail.com</div>
          <div className="login-sample-item">Password: bur@123</div>
        </div>
        <form className="login-form" onSubmit={handleSupabaseSubmit}>
          {authMode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={authFullName}
                onChange={(e) => setAuthFullName(e.target.value)}
                placeholder="Full name"
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          {authError && <div className="form-error">{authError}</div>}
          <button className="btn btn-primary login-submit" type="submit">
            {authMode === 'signup' ? 'Create Account' : 'Login'}
          </button>
        </form>
        <div className="login-hint">
          Use your Supabase account email and password to sign in.
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { signIn, signOut, signUp } from '../auth/authApi';

export default function LoginView() {
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [supabaseProfile, setSupabaseProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSupabaseSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSupabaseSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabaseSession?.user) {
        setSupabaseProfile(null);
        return;
      }
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseSession.user.id)
        .single();
      if (!profileError) setSupabaseProfile(data);
    })();
  }, [supabaseSession]);

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
          <div className="login-sample-item">Email: admin123@gmail.com</div>
          <div className="login-sample-item">Password: admin@123</div>
        </div>
        {/* <div className="login-divider">Supabase Login</div> */}
        {!supabaseSession && (
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
            {/* <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
            >
              Switch to {authMode === 'signup' ? 'Login' : 'Sign Up'}
            </button> */}
          </form>
        )}
        {supabaseSession && (
          <div className="login-supabase-session">
            <div className="form-hint">Logged in. {supabaseSession.user.email}</div>
            <pre>{JSON.stringify(supabaseProfile, null, 2)}</pre>
            <button className="btn btn-secondary" type="button" onClick={signOut}>
              Logout
            </button>
          </div>
        )}
        <div className="login-hint">
          Use your Supabase account email and password to sign in.
        </div>
      </div>
    </div>
  );
}

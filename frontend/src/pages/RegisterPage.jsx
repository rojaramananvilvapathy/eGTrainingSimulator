// RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(form);
    if (result.success) { toast.success('Account created!'); navigate('/dashboard'); }
    else toast.error(result.error || 'Registration failed');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={28} color="#3fb950" />
            <span style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3' }}>eG Sim Platform</span>
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '2rem' }}>
          <h1 style={{ color: '#e6edf3', fontSize: 20, fontWeight: 600, marginBottom: '1.5rem' }}>Create account</h1>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { key: 'display_name', label: 'Display name',  type: 'text',     placeholder: 'Your name' },
              { key: 'username',     label: 'Username',       type: 'text',     placeholder: 'eg. roja_eg' },
              { key: 'email',        label: 'Email',          type: 'email',    placeholder: 'you@example.com' },
              { key: 'password',     label: 'Password',       type: 'password', placeholder: 'Min 8 chars, upper+lower+number' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 13, color: '#8b949e', marginBottom: 6 }}>{label}</label>
                <input type={type} required value={form[key]} placeholder={placeholder}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', fontSize: 14, outline: 'none' }} />
              </div>
            ))}
            <button type="submit" disabled={isLoading}
              style={{ padding: '0.65rem', background: '#238636', border: 'none', borderRadius: 6, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: 14, color: '#8b949e' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#58a6ff', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ProfilePage.jsx stub
export function ProfilePage() {
  return (
    <div style={{ padding: '2rem', color: '#e6edf3' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '0.5rem' }}>Profile</h1>
      <p style={{ color: '#8b949e' }}>Badges, progress history, and stats — coming in Phase 7.</p>
    </div>
  );
}

// AdminPage.jsx stub
export function AdminPage() {
  return (
    <div style={{ padding: '2rem', color: '#e6edf3' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '0.5rem' }}>Admin</h1>
      <p style={{ color: '#8b949e' }}>Room editor, user management, analytics — coming in Phase 8.</p>
    </div>
  );
}

export default RegisterPage;

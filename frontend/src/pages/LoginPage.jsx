import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [form, setForm]   = useState({ email: '', password: '' });
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Terminal size={28} color="#3fb950" />
            <span style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3' }}>eG Sim Platform</span>
          </div>
          <p style={{ color: '#8b949e', fontSize: 14 }}>eG Enterprise Simulation Labs</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#161b22', border: '1px solid #30363d',
          borderRadius: 12, padding: '2rem',
        }}>
          <h1 style={{ color: '#e6edf3', fontSize: 20, fontWeight: 600, marginBottom: '1.5rem' }}>
            Sign in
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" required autoFocus
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password" required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={isLoading} style={btnStyle}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: 14, color: '#8b949e' }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#58a6ff', textDecoration: 'none' }}>
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, color: '#8b949e', marginBottom: 6 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.6rem 0.75rem', background: '#0d1117',
  border: '1px solid #30363d', borderRadius: 6,
  color: '#e6edf3', fontSize: 14, outline: 'none',
};
const btnStyle = {
  padding: '0.65rem', background: '#238636',
  border: 'none', borderRadius: 6,
  color: '#fff', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', marginTop: 4,
};

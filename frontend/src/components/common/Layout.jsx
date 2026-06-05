import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Trophy, User, LogOut, Shield, Terminal } from 'lucide-react';
import useAuthStore from '../../store/authStore';

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Labs'        },
  { to: '/leaderboard', icon: Trophy,           label: 'Leaderboard' },
  { to: '/profile',     icon: User,             label: 'Profile'     },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#e6edf3' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#161b22',
        borderRight: '1px solid #30363d', display: 'flex',
        flexDirection: 'column', padding: '1.5rem 0',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 1.25rem 1.5rem', borderBottom: '1px solid #30363d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={20} color="#3fb950" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#e6edf3' }}>eG Sim</span>
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
            Enterprise Training Platform
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.55rem 0.75rem', borderRadius: 6,
              textDecoration: 'none', fontSize: 14,
              background: isActive ? '#1f2937' : 'transparent',
              color:      isActive ? '#e6edf3' : '#8b949e',
              transition: 'all 0.15s',
            })}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <NavLink to="/admin" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.55rem 0.75rem', borderRadius: 6,
              textDecoration: 'none', fontSize: 14,
              background: isActive ? '#1f2937' : 'transparent',
              color:      isActive ? '#e6edf3' : '#8b949e',
            })}>
              <Shield size={16} />
              Admin
            </NavLink>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '0 0.75rem', borderTop: '1px solid #30363d', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#1f6feb', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#fff',
            }}>
              {user?.display_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 500 }}>
                {user?.display_name || user?.username}
              </div>
              <div style={{ fontSize: 11, color: '#3fb950' }}>
                {user?.total_points?.toLocaleString() || 0} XP
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '0.45rem 0.75rem', borderRadius: 6, border: 'none',
              background: 'transparent', color: '#8b949e', fontSize: 13,
              cursor: 'pointer', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f85149'}
            onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

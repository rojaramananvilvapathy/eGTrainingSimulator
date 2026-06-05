import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const ROLE_OPTIONS   = ['learner', 'admin', 'superadmin'];
const ROLE_COLORS    = { learner: '#8b949e', admin: '#58a6ff', superadmin: '#bc8cff' };

export default function UserManagement() {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const debounce  = useRef(null);

  const fetchUsers = (s = search, p = page) => {
    setLoading(true);
    api.get('/admin/users', { params: { search: s || undefined, page: p, limit: 20 } })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); })
      .catch(() => toast.error('Failed to fetch users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchUsers(val, 1); }, 400);
  };

  const updateUser = async (userId, changes) => {
    try {
      const { data } = await api.patch(`/admin/users/${userId}`, changes);
      setUsers(u => u.map(usr => usr.id === userId ? { ...usr, ...data.user } : usr));
      toast.success('User updated');
    } catch {
      toast.error('Failed to update user');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
        <input
          value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search by username, email, or name..."
          style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 80px 90px 90px 120px',
                      padding: '0.6rem 1rem', borderBottom: '1px solid #30363d',
                      fontSize: 11, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase' }}>
          {['User', 'Email', 'Flags', 'Rooms', 'XP', 'Role', 'Actions'].map(h => (
            <span key={h}>{h}</span>
          ))}
        </div>

        {loading && <p style={{ padding: '1rem', color: '#8b949e', fontSize: 13 }}>Loading...</p>}

        {!loading && users.map(u => (
          <div key={u.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 80px 80px 90px 90px 120px',
            padding: '0.7rem 1rem', borderTop: '1px solid #21262d',
            alignItems: 'center', fontSize: 13,
            opacity: u.is_active ? 1 : 0.5,
          }}>
            <div>
              <div style={{ color: '#e6edf3', fontWeight: 500 }}>{u.display_name || u.username}</div>
              <div style={{ color: '#8b949e', fontSize: 11 }}>@{u.username}</div>
            </div>
            <div style={{ color: '#8b949e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.email}
            </div>
            <div style={{ color: '#8b949e', textAlign: 'right' }}>{u.flags_captured || 0}</div>
            <div style={{ color: '#8b949e', textAlign: 'right' }}>{u.rooms_completed || 0}</div>
            <div style={{ color: '#3fb950', fontWeight: 600, textAlign: 'right' }}>
              {Number(u.total_points).toLocaleString()}
            </div>

            {/* Role selector */}
            <div style={{ position: 'relative' }}>
              <select value={u.role}
                onChange={e => updateUser(u.id, { role: e.target.value })}
                style={{ ...inputStyle, fontSize: 11, padding: '3px 6px',
                         color: ROLE_COLORS[u.role] || '#8b949e', cursor: 'pointer' }}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                style={{ ...miniBtn, color: u.is_active ? '#f85149' : '#3fb950',
                         borderColor: u.is_active ? '#f8514933' : '#3fb95033' }}>
                {u.is_active ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '1rem' }}>
          <button disabled={page === 1} onClick={() => { setPage(p => p - 1); fetchUsers(search, page - 1); }} style={miniBtn}>
            ← Prev
          </button>
          <span style={{ color: '#8b949e', fontSize: 13, padding: '0.3rem 0.5rem' }}>
            {page} / {totalPages} ({total} users)
          </span>
          <button disabled={page === totalPages} onClick={() => { setPage(p => p + 1); fetchUsers(search, page + 1); }} style={miniBtn}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle = { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '0.5rem 0.65rem', fontSize: 13, outline: 'none' };
const miniBtn    = { padding: '4px 10px', border: '1px solid #30363d', borderRadius: 6, background: 'transparent', color: '#8b949e', fontSize: 11, cursor: 'pointer' };

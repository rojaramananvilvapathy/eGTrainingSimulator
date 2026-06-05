import { useState, useEffect } from 'react';
import { Play, Archive, RefreshCw, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import AnalyticsDashboard   from '../components/admin/AnalyticsDashboard';
import UserManagement       from '../components/admin/UserManagement';
import ScreenshotLabGenerator from '../components/admin/ScreenshotLabGenerator';

const SCENARIO_TYPES = [
  { value: 'agent_manager_disconnect', label: 'Agent–Manager Disconnect' },
  { value: 'db_auth_failure',          label: 'DB Authentication Failure' },
  { value: 'ssl_cert_expired',         label: 'SSL Certificate Expired' },
  { value: 'log_analysis',             label: 'Log Analysis Challenge' },
  { value: 'custom',                   label: 'Custom (provide YAML)' },
];

const TABS = [
  { key: 'analytics',   label: '📊 Analytics' },
  { key: 'rooms',       label: '🗂 Rooms' },
  { key: 'users',       label: '👥 Users' },
  { key: 'generate',    label: '⚡ Generate Lab' },
  { key: 'screenshot',  label: '📸 Screenshot → Lab' },
];

export default function AdminPage() {
  const [tab,     setTab]     = useState('analytics');
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [genForm, setGenForm] = useState({ scenario_type: 'agent_manager_disconnect', os: 'linux', difficulty: 'medium', component_type: 'eG Manager', manager_host: '192.168.1.100', estimated_minutes: 45, title: '', description: '' });
  const [generating, setGenerating] = useState(false);
  const [lastGen,    setLastGen]    = useState(null);

  useEffect(() => {
    if (tab === 'rooms') {
      setLoading(true);
      api.get('/rooms', { params: {} }).then(r => setRooms(r.data.rooms || [])).finally(() => setLoading(false));
    }
  }, [tab]);

  const publishRoom = async (id, status) => {
    try {
      await api.patch(`/rooms/${id}/publish`, { status });
      setRooms(r => r.map(room => room.id === id ? { ...room, status } : room));
      toast.success(`Room ${status}`);
    } catch { toast.error('Failed'); }
  };

  const generateLab = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/admin/generate-lab', genForm);
      setLastGen(data); toast.success(`Lab generated: ${data.room.slug}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      <h1 style={{ color: '#e6edf3', fontSize: 22, fontWeight: 700, marginBottom: '0.5rem' }}>Admin</h1>

      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid #30363d', overflowX: 'auto' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '0.5rem 1rem', border: 'none', background: 'transparent', whiteSpace: 'nowrap',
            color: tab === key ? '#e6edf3' : '#8b949e', cursor: 'pointer', fontSize: 13,
            borderBottom: tab === key ? '2px solid #58a6ff' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'analytics'  && <AnalyticsDashboard />}
      {tab === 'users'      && <UserManagement />}
      {tab === 'screenshot' && <ScreenshotLabGenerator />}

      {/* ── ROOMS TAB ── */}
      {tab === 'rooms' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 60px 110px', gap: '0 1rem',
                        padding: '0.6rem 1rem', borderBottom: '1px solid #30363d',
                        fontSize: 11, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase' }}>
            {['Room', 'Category', 'Difficulty', 'Ph', 'Status / Action'].map(h => <span key={h}>{h}</span>)}
          </div>
          {loading && <p style={{ padding: '1rem', color: '#8b949e', fontSize: 13 }}>Loading...</p>}
          {!loading && rooms.map(room => (
            <div key={room.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 60px 110px',
                                        gap: '0 1rem', padding: '0.7rem 1rem', borderTop: '1px solid #21262d', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 500 }}>{room.title}</div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>{room.slug}</div>
              </div>
              <span style={{ fontSize: 12, color: '#8b949e', textTransform: 'capitalize' }}>{room.category}</span>
              <span style={{ fontSize: 12, color: '#8b949e', textTransform: 'capitalize' }}>{room.difficulty}</span>
              <span style={{ fontSize: 12, color: '#8b949e', textAlign: 'center' }}>{room.phase}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12,
                               background: room.status === 'published' ? '#1a2f1a' : '#1a1a1a',
                               color: room.status === 'published' ? '#3fb950' : '#8b949e' }}>
                  {room.status}
                </span>
                {room.status !== 'published'
                  ? <button onClick={() => publishRoom(room.id, 'published')} title="Publish" style={iconMiniBtn}><Play size={12} /></button>
                  : <button onClick={() => publishRoom(room.id, 'draft')}     title="Unpublish" style={iconMiniBtn}><Archive size={12} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── GENERATE LAB TAB ── */}
      {tab === 'generate' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '1.5rem' }}>
            <h2 style={{ color: '#e6edf3', fontSize: 15, fontWeight: 600, marginBottom: '1.25rem' }}>
              Dynamic Troubleshooting Lab Generator
            </h2>
            {[
              { key: 'scenario_type', label: 'Scenario Type', type: 'select', options: SCENARIO_TYPES },
              { key: 'os',            label: 'Target OS',     type: 'select', options: [{ value: 'linux', label: 'Linux' }, { value: 'windows', label: 'Windows' }] },
              { key: 'difficulty',    label: 'Difficulty',    type: 'select', options: ['easy','medium','hard','expert'].map(v => ({ value: v, label: v })) },
              { key: 'component_type',label: 'Component Type',type: 'text',   placeholder: 'eG Manager' },
              { key: 'manager_host',  label: 'Manager Host IP',type:'text',   placeholder: '192.168.1.100' },
              { key: 'title',         label: 'Custom Title (opt)', type: 'text', placeholder: 'Leave blank for auto' },
            ].map(({ key, label, type, options, placeholder }) => (
              <div key={key} style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }}>{label}</label>
                {type === 'select'
                  ? <select value={genForm[key]} onChange={e => setGenForm(f => ({ ...f, [key]: e.target.value }))} style={inputSt}>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  : <input type={type} value={genForm[key]} onChange={e => setGenForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={inputSt} />
                }
              </div>
            ))}
            <button onClick={generateLab} disabled={generating} style={{ width: '100%', padding: '0.65rem', background: '#1f6feb', border: 'none', borderRadius: 6, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              {generating ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />Generating...</> : <><Plus size={14} />Generate Lab</>}
            </button>
          </div>
          <div>
            {lastGen ? (
              <div style={{ background: '#0d2818', border: '1px solid #3fb950', borderRadius: 12, padding: '1.5rem' }}>
                <div style={{ color: '#3fb950', fontWeight: 600, fontSize: 14, marginBottom: '0.75rem' }}>✓ Lab Generated</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', background: '#0d1117', padding: '0.5rem', borderRadius: 6, marginBottom: '0.75rem' }}>{lastGen.room?.slug}</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{lastGen.taskCount} tasks · Status: draft — publish in Rooms tab</div>
              </div>
            ) : (
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '1.5rem', color: '#8b949e', fontSize: 13, lineHeight: 1.6 }}>
                <p><strong style={{ color: '#e6edf3' }}>How this works:</strong></p>
                <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  <li>Choose a scenario type and OS</li><li>Set difficulty and context</li>
                  <li>Click Generate — full lab with tasks, hints, and flags is created</li>
                  <li>Review in Rooms tab → publish</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputSt   = { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '0.5rem 0.65rem', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
const iconMiniBtn = { background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 2 };

import { useState, useEffect } from 'react';
import { Users, Flag, BookOpen, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState(null);
  const [rooms,    setRooms]    = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/rooms'),
      api.get('/analytics/tasks'),
      api.get('/analytics/activity'),
    ]).then(([ov, rm, tk, ac]) => {
      setOverview(ov.data);
      setRooms(rm.data.rooms);
      setTasks(tk.data.tasks);
      setActivity(ac.data.activity);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#8b949e', padding: '1rem' }}>Loading analytics...</p>;

  const maxActivity = Math.max(...activity.map(d => d.flags_captured), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Overview stat cards */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {[
            { icon: Users,    label: 'Total learners',   value: overview.users.total,          sub: `${overview.users.active_today} active today`, color: '#58a6ff' },
            { icon: BookOpen, label: 'Rooms published',  value: overview.rooms.published,       sub: `${overview.rooms.total} total`,               color: '#3fb950' },
            { icon: Flag,     label: 'Flags captured',   value: overview.flags.total_captured,  sub: `${overview.flags.today} today`,               color: '#d29922' },
            { icon: Activity, label: 'Active labs now',  value: overview.activeLabs,            sub: 'running containers',                           color: '#bc8cff' },
            { icon: TrendingUp,label:'New this week',    value: overview.users.new_this_week,   sub: 'new learner signups',                          color: '#39c5cf' },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={16} color={color} />
                <span style={{ fontSize: 12, color: '#8b949e' }}>{label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#e6edf3', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Activity chart — 30-day flag captures */}
      {activity.length > 0 && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '1.25rem' }}>
          <h3 style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>
            Flag Captures — Last 30 Days
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {activity.map((d, i) => (
              <div key={i} title={`${d.day}: ${d.flags_captured} flags`} style={{
                flex: 1, background: '#1f6feb',
                height: `${Math.round((d.flags_captured / maxActivity) * 100)}%`,
                minHeight: 2, borderRadius: '2px 2px 0 0',
                opacity: 0.7 + (d.flags_captured / maxActivity) * 0.3,
                cursor: 'default', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = String(0.7 + (d.flags_captured / maxActivity) * 0.3)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#8b949e' }}>
            <span>{activity[0]?.day}</span>
            <span>{activity[activity.length - 1]?.day}</span>
          </div>
        </div>
      )}

      {/* Room completion table */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #30363d' }}>
          <h3 style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600, margin: 0 }}>Room Completion Rates</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0d1117' }}>
                {['Room', 'Category', 'Diff', 'Started', 'Completed', 'Rate', 'Avg Time', 'Fastest', 'Avg Hints'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#8b949e', fontSize: 11,
                                       fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => {
                const rate = parseFloat(room.completion_rate_pct) || 0;
                const rateColor = rate >= 70 ? '#3fb950' : rate >= 40 ? '#d29922' : '#f85149';
                return (
                  <tr key={room.id} style={{ borderTop: '1px solid #21262d' }}>
                    <td style={{ padding: '0.7rem 1rem', color: '#e6edf3', fontWeight: 500, maxWidth: 200 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.title}</div>
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#8b949e', textTransform: 'capitalize' }}>{room.category}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#8b949e', textTransform: 'capitalize' }}>{room.difficulty}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#8b949e', textAlign: 'right' }}>{room.started_count}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#8b949e', textAlign: 'right' }}>{room.completed_count}</td>
                    <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                      <span style={{ color: rateColor, fontWeight: 600 }}>{rate}%</span>
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#8b949e', textAlign: 'right' }}>
                      {room.avg_completion_minutes ? `${room.avg_completion_minutes}m` : '—'}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#3fb950', textAlign: 'right' }}>
                      {room.fastest_minutes ? `${room.fastest_minutes}m` : '—'}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#8b949e', textAlign: 'right' }}>
                      {room.avg_hints_used ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most-failed tasks */}
      {tasks.length > 0 && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="#f85149" />
            <h3 style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600, margin: 0 }}>Hardest Tasks (lowest capture rate)</h3>
          </div>
          {tasks.slice(0, 10).map((task, i) => (
            <div key={task.id} style={{ padding: '0.75rem 1.25rem', borderTop: i === 0 ? 'none' : '1px solid #21262d',
                                        display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: 12, color: '#8b949e', width: 24, textAlign: 'center', flexShrink: 0 }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 500,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>{task.room_title} · Task {task.sequence}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600,
                              color: parseFloat(task.capture_rate_pct) < 30 ? '#f85149' : '#d29922' }}>
                  {task.capture_rate_pct ?? 0}% captured
                </div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>{task.avg_attempts_per_user} avg attempts</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

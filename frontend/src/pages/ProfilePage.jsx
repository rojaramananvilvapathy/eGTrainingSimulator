import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Flag, BookOpen, Clock } from 'lucide-react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import BadgeDisplay from '../components/gamification/BadgeDisplay';

export default function ProfilePage() {
  const { id }   = useParams();
  const { user: me } = useAuthStore();
  const userId   = id || me?.id;
  const isMe     = !id || id === me?.id;

  const [profile,  setProfile]  = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/users/${userId}/profile`),
      isMe ? api.get('/users/me/progress') : Promise.resolve({ data: { progress: [] } }),
    ]).then(([profileRes, progressRes]) => {
      setProfile(profileRes.data.user);
      setProgress(progressRes.data.progress || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div style={{ padding: '2rem', color: '#8b949e' }}>Loading...</div>;
  if (!profile) return <div style={{ padding: '2rem', color: '#8b949e' }}>Profile not found.</div>;

  const completed  = progress.filter(p => p.is_completed).length;
  const inProgress = progress.filter(p => !p.is_completed).length;

  return (
    <div style={{ padding: '2rem', maxWidth: 900 }}>
      {/* Profile header */}
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1.5rem',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#1f6feb', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {profile.display_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: '#e6edf3', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {profile.display_name || profile.username}
          </h1>
          <div style={{ color: '#8b949e', fontSize: 13, marginTop: 4 }}>
            @{profile.username} · Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[
            { icon: Star,     label: 'XP',        value: Number(profile.total_points).toLocaleString(), color: '#3fb950' },
            { icon: Flag,     label: 'Flags',      value: profile.flags_captured || 0,               color: '#58a6ff' },
            { icon: BookOpen, label: 'Rooms',      value: profile.rooms_completed || 0,               color: '#d29922' },
            { icon: Clock,    label: 'Global Rank', value: profile.global_rank ? `#${profile.global_rank}` : '—', color: '#bc8cff' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <Icon size={18} color={color} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8b949e' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <BadgeDisplay userId={userId} />
      </div>

      {/* Room progress */}
      {isMe && progress.length > 0 && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '1.5rem' }}>
          <h3 style={{ color: '#e6edf3', fontSize: 15, fontWeight: 600, marginBottom: '1rem' }}>
            Lab Progress ({completed} completed, {inProgress} in progress)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {progress.map(p => (
              <div key={p.room_id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.75rem', background: '#0d1117',
                border: '1px solid #21262d', borderRadius: 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 500 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'capitalize' }}>
                    {p.category} · {p.difficulty}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#3fb950', fontWeight: 600 }}>
                  {p.points_earned} XP
                </div>
                <div style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 12,
                  background: p.is_completed ? '#1a2f1a' : '#1a2233',
                  color:      p.is_completed ? '#3fb950' : '#58a6ff',
                }}>
                  {p.is_completed ? '✓ Complete' : 'In Progress'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

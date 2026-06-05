import { useState, useEffect } from 'react';
import { Trophy, Crown, Medal } from 'lucide-react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [myEntry, setMyEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    api.get('/leaderboard/global')
      .then(r => { setEntries(r.data.leaderboard); setMyEntry(r.data.myEntry); })
      .finally(() => setLoading(false));
  }, []);

  const RankIcon = ({ rank }) => {
    if (rank === 1) return <Crown  size={16} color="#FFD700" />;
    if (rank === 2) return <Medal  size={16} color="#C0C0C0" />;
    if (rank === 3) return <Medal  size={16} color="#CD7F32" />;
    return <span style={{ fontSize: 13, color: '#8b949e', width: 16, textAlign: 'center' }}>{rank}</span>;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.5rem' }}>
        <Trophy size={20} color="#d29922" />
        <h1 style={{ color: '#e6edf3', fontSize: 22, fontWeight: 700 }}>Global Leaderboard</h1>
      </div>
      <p style={{ color: '#8b949e', fontSize: 14, marginBottom: '1.5rem' }}>Top learners across all eG Enterprise labs</p>

      {loading ? (
        <p style={{ color: '#8b949e' }}>Loading...</p>
      ) : (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 80px', gap: '0 1rem',
                        padding: '0.6rem 1rem', borderBottom: '1px solid #30363d',
                        fontSize: 12, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <span>#</span><span>User</span><span style={{ textAlign: 'right' }}>XP</span><span style={{ textAlign: 'right' }}>Flags</span>
          </div>

          {entries.map((entry, idx) => {
            const isMe = entry.id === user?.id;
            return (
              <div key={entry.id} style={{
                display: 'grid', gridTemplateColumns: '48px 1fr 100px 80px', gap: '0 1rem',
                padding: '0.8rem 1rem', borderBottom: '1px solid #21262d',
                background: isMe ? '#1a2a1a' : 'transparent',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RankIcon rank={idx + 1} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isMe ? '#1f6feb' : '#21262d',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: '#e6edf3',
                  }}>
                    {(entry.display_name || entry.username)?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: '#e6edf3', fontWeight: isMe ? 600 : 400 }}>
                      {entry.display_name || entry.username}
                      {isMe && <span style={{ fontSize: 11, color: '#58a6ff', marginLeft: 6 }}>you</span>}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#3fb950', fontWeight: 600, textAlign: 'right' }}>
                  {Number(entry.total_points).toLocaleString()}
                </div>
                <div style={{ fontSize: 14, color: '#8b949e', textAlign: 'right' }}>
                  {entry.flags_captured ?? 0}
                </div>
              </div>
            );
          })}

          {/* My entry if outside top 50 */}
          {myEntry && !entries.find(e => e.id === user?.id) && (
            <>
              <div style={{ padding: '0.4rem 1rem', textAlign: 'center', color: '#8b949e', fontSize: 12 }}>• • •</div>
              <div style={{
                display: 'grid', gridTemplateColumns: '48px 1fr 100px 80px', gap: '0 1rem',
                padding: '0.8rem 1rem', background: '#1a2a1a', alignItems: 'center',
              }}>
                <div style={{ textAlign: 'center', fontSize: 13, color: '#8b949e' }}>{myEntry.global_rank || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1f6feb',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 600, color: '#fff' }}>
                    {user?.display_name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, color: '#e6edf3', fontWeight: 600 }}>
                    {user?.display_name} <span style={{ fontSize: 11, color: '#58a6ff' }}>you</span>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#3fb950', fontWeight: 600, textAlign: 'right' }}>
                  {Number(myEntry.total_points).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

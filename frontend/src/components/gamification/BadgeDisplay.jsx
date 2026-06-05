import { useState, useEffect } from 'react';
import { Shield, Lock } from 'lucide-react';
import api from '../../utils/api';

const ALL_BADGES = [
  { slug: 'first-flag',    name: 'First Flag',    description: 'Captured your very first flag',                        color: '#3fb950' },
  { slug: 'first-install', name: 'First Install', description: 'Completed an eG Manager installation lab',              color: '#58a6ff' },
  { slug: 'prereq-pro',    name: 'Prereq Pro',    description: 'Passed all prerequisite labs without using hints',      color: '#d29922' },
  { slug: 'log-whisperer', name: 'Log Whisperer', description: 'Solved a log analysis challenge on the first attempt',  color: '#bc8cff' },
  { slug: 'speed-demon',   name: 'Speed Demon',   description: 'Completed a room in under half the estimated time',     color: '#f78166' },
  { slug: 'first-blood',   name: 'First Blood',   description: 'First globally to capture a flag in a room',            color: '#f85149' },
  { slug: 'troubleshooter',name: 'Troubleshooter',description: 'Completed all troubleshooting labs',                    color: '#39c5cf' },
  { slug: 'eG-master',     name: 'eG Master',     description: 'Completed every room in the platform',                  color: '#FFD700' },
];

export default function BadgeDisplay({ userId }) {
  const [earned, setEarned] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = userId ? `/users/${userId}/profile` : '/users/me/badges';
    api.get(url)
      .then(r => setEarned(r.data.badges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const earnedSlugs = new Set(earned.map(b => b.slug));

  return (
    <div>
      <h3 style={{ color: '#e6edf3', fontSize: 15, fontWeight: 600, marginBottom: '1rem' }}>
        Badges ({earned.length}/{ALL_BADGES.length})
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {ALL_BADGES.map(badge => {
          const isEarned  = earnedSlugs.has(badge.slug);
          const earnedData = earned.find(b => b.slug === badge.slug);
          return (
            <div key={badge.slug} style={{
              background:   isEarned ? '#161b22' : '#0d1117',
              border:       `1px solid ${isEarned ? badge.color + '66' : '#21262d'}`,
              borderRadius: 10, padding: '0.9rem',
              textAlign:    'center', opacity: isEarned ? 1 : 0.5,
              transition:   'transform 0.15s',
              cursor:       'default',
            }}
            onMouseEnter={e => { if (isEarned) e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            title={badge.description}
            >
              <div style={{ marginBottom: 8 }}>
                {isEarned
                  ? <Shield size={28} color={badge.color} style={{ filter: `drop-shadow(0 0 6px ${badge.color}88)` }} />
                  : <Lock   size={24} color="#30363d" />
                }
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: isEarned ? badge.color : '#8b949e', lineHeight: 1.3, marginBottom: isEarned ? 4 : 0 }}>
                {badge.name}
              </div>
              {isEarned && earnedData?.awarded_at && (
                <div style={{ fontSize: 10, color: '#8b949e' }}>
                  {new Date(earnedData.awarded_at).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

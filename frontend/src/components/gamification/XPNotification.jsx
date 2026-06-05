import { useEffect, useRef } from 'react';
import { Star, Shield } from 'lucide-react';

/**
 * XPNotification
 * Shows an animated XP award popup after a successful flag capture.
 * Usage: <XPNotification result={flagResult} onDone={() => setResult(null)} />
 */
export default function XPNotification({ result, onDone }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!result?.success) return;
    timerRef.current = setTimeout(() => { if (onDone) onDone(); }, 4000);
    return () => clearTimeout(timerRef.current);
  }, [result]);

  if (!result?.success) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {/* Main XP card */}
      <div style={{
        background: result.firstBlood ? '#1a0a2e' : '#0d2818',
        border: `1px solid ${result.firstBlood ? '#bc8cff' : '#3fb950'}`,
        borderRadius: 12, padding: '1rem 1.25rem',
        animation: 'slideUp 0.35s ease-out',
        boxShadow: `0 4px 24px ${result.firstBlood ? '#bc8cff33' : '#3fb95033'}`,
        minWidth: 240,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Star size={20} color={result.firstBlood ? '#bc8cff' : '#3fb950'} fill="currentColor" />
          <span style={{ fontSize: 15, fontWeight: 700, color: result.firstBlood ? '#bc8cff' : '#3fb950' }}>
            {result.firstBlood ? '🩸 FIRST BLOOD!' : '✓ Flag Captured!'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#e6edf3', lineHeight: 1 }}>
            +{result.points}
          </span>
          <span style={{ fontSize: 14, color: '#8b949e' }}>XP</span>
        </div>

        {result.firstBlood && result.bonusPoints > 0 && (
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
            {result.basePoints} base + {result.bonusPoints} first-blood bonus
          </div>
        )}
      </div>

      {/* New badges */}
      {result.newBadges?.map(badge => (
        <div key={badge.slug} style={{
          background: '#1a1a0d', border: '1px solid #d29922',
          borderRadius: 10, padding: '0.75rem 1rem',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'slideUp 0.45s ease-out',
        }}>
          <Shield size={18} color="#d29922" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#d29922' }}>
              Badge Unlocked!
            </div>
            <div style={{ fontSize: 12, color: '#e6edf3' }}>{badge.name}</div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

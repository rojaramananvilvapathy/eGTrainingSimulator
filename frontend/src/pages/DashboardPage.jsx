import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Server, CheckCircle, Clock, Star, Lock } from 'lucide-react';
import api from '../utils/api';

const CATEGORIES = ['All', 'prerequisites', 'installation', 'configuration', 'troubleshooting'];
const OS_TYPES   = ['All', 'linux', 'windows', 'both'];
const DIFF_COLOR = { easy: '#3fb950', medium: '#d29922', hard: '#f85149', expert: '#bc8cff' };

export default function DashboardPage() {
  const [rooms,    setRooms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState('All');
  const [os,       setOs]       = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const params = {};
    if (category !== 'All') params.category = category;
    if (os !== 'All')       params.os = os;
    api.get('/rooms', { params })
      .then(r => setRooms(r.data.rooms))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, os]);

  const grouped = rooms.reduce((acc, room) => {
    const phase = `Phase ${room.phase}`;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(room);
    return acc;
  }, {});

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      <h1 style={{ color: '#e6edf3', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Labs
      </h1>
      <p style={{ color: '#8b949e', fontSize: 14, marginBottom: '1.5rem' }}>
        Complete labs in order to build your eG Enterprise expertise.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <FilterGroup label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
        <FilterGroup label="OS"       options={OS_TYPES}   value={os}       onChange={setOs}       />
      </div>

      {loading ? (
        <p style={{ color: '#8b949e' }}>Loading labs...</p>
      ) : (
        Object.entries(grouped).sort().map(([phase, phaseRooms]) => (
          <div key={phase} style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#8b949e', fontSize: 13, fontWeight: 600,
                         textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.75rem' }}>
              {phase}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
              {phaseRooms.map(room => (
                <RoomCard key={room.id} room={room} onClick={() => navigate(`/room/${room.slug}`)} />
              ))}
            </div>
          </div>
        ))
      )}

      {!loading && rooms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#8b949e' }}>
          No labs published yet.
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onClick }) {
  const OSIcon = room.os === 'windows' ? Monitor : Server;
  return (
    <div onClick={onClick} style={{
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: 10, padding: '1.1rem', cursor: 'pointer',
      transition: 'border-color 0.15s, transform 0.1s',
      position: 'relative',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#58a6ff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.transform = 'none'; }}
    >
      {room.completed && (
        <CheckCircle size={16} color="#3fb950" style={{ position: 'absolute', top: 12, right: 12 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <OSIcon size={14} color="#8b949e" />
        <span style={{ fontSize: 11, color: '#8b949e', textTransform: 'capitalize' }}>{room.os}</span>
        <span style={{ fontSize: 11, color: DIFF_COLOR[room.difficulty] || '#8b949e',
                       marginLeft: 'auto', textTransform: 'capitalize' }}>
          {room.difficulty}
        </span>
      </div>

      <h3 style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
        {room.title}
      </h3>

      <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.5, marginBottom: 10,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {room.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: 12, color: '#8b949e' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={12} color="#d29922" />
          {room.points_total} XP
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} />
          ~{room.estimated_minutes}m
        </span>
        <span style={{ fontSize: 11, background: '#21262d', padding: '2px 8px',
                       borderRadius: 12, marginLeft: 'auto', textTransform: 'capitalize' }}>
          {room.category}
        </span>
      </div>

      {room.completed && (
        <div style={{ marginTop: 8, height: 3, background: '#21262d', borderRadius: 2 }}>
          <div style={{ height: '100%', background: '#3fb950', borderRadius: 2,
                        width: `${Math.round((room.points_earned / room.points_total) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#8b949e' }}>{label}:</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
            background: value === opt ? '#1f6feb' : '#21262d',
            color:      value === opt ? '#fff'    : '#8b949e',
            transition: 'all 0.15s',
          }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

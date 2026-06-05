import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate }  from 'react-router-dom';
import { ChevronLeft, Flag, Lightbulb, CheckCircle, Terminal, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import api         from '../utils/api';
import LabTerminal from '../components/terminal/LabTerminal';
import XPNotification from '../components/gamification/XPNotification';
import DocPanel from '../components/lab/DocPanel';
import useAuthStore from '../store/authStore';

export default function LabRoomPage() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuthStore();

  const [room,        setRoom]        = useState(null);
  const [tasks,       setTasks]       = useState([]);
  const [session,     setSession]     = useState(null);  // { sessionId, containerId }
  const [activeTask,  setActiveTask]  = useState(0);
  const [flagInput,   setFlagInput]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [starting,    setStarting]    = useState(false);
  const [showHint,    setShowHint]    = useState(null);
  const [xpResult,    setXpResult]    = useState(null);

  // Load room details
  useEffect(() => {
    api.get(`/rooms/${slug}`)
      .then(r => { setRoom(r.data.room); setTasks(r.data.tasks); })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [slug]);

  const startLab = async () => {
    setStarting(true);
    try {
      const { data } = await api.post('/containers/start', { roomId: room.id });
      setSession({ sessionId: data.sessionId, containerId: data.containerId });
      toast.success('Lab environment started!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start lab');
    } finally {
      setStarting(false);
    }
  };

  const stopLab = async () => {
    if (!session) return;
    try {
      await api.post('/containers/stop', { sessionId: session.sessionId, containerId: session.containerId });
      setSession(null);
      toast('Lab stopped');
    } catch {}
  };

  const submitFlag = async () => {
    if (!flagInput.trim() || !session) return;
    const task = tasks[activeTask];
    if (!task) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/flags/submit', {
        taskId:    task.id,
        flag:      flagInput.trim(),
        sessionId: session.sessionId,
      });
      if (data.success) {
        toast.success(data.message);
        setXpResult(data);
        setFlagInput('');
        // Refresh tasks
        const r = await api.get(`/rooms/${slug}`);
        setTasks(r.data.tasks);
        if (activeTask + 1 < tasks.length) {
          setTimeout(() => setActiveTask(i => i + 1), 800);
        }
      } else {
        toast.error(data.message || 'Incorrect flag');
      }
    } catch {
      toast.error('Flag submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const evaluateFlag = async (output) => {
    const task = tasks[activeTask];
    if (!task || task.is_captured || !session) return;
    try {
      const { data } = await api.post('/flags/evaluate', {
        taskId: task.id, sessionId: session.sessionId, command: '', output,
      });
      if (data.matched && data.flag) {
        setFlagInput(data.flag);
        toast.success('Flag unlocked! Submit it to claim your XP.');
      }
    } catch {}
  };

  const getHint = async (tier) => {
    const task = tasks[activeTask];
    if (!task) return;
    try {
      const { data } = await api.post('/flags/hint', {
        taskId: task.id, tier, sessionId: session?.sessionId,
      });
      setShowHint({ tier, text: data.hint, cost: data.cost });
      toast(`Hint unlocked (-${data.cost} XP)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Hint unavailable');
    }
  };

  if (loading) return <div style={centered}>Loading...</div>;
  if (!room)   return <div style={centered}>Room not found</div>;

  const task          = tasks[activeTask];
  const completedCount = tasks.filter(t => t.is_captured).length;
  const isWindowsRoom = room.os === 'windows';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117' }}>
      <XPNotification result={xpResult} onDone={() => setXpResult(null)} />
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 1.25rem', background: '#161b22',
        borderBottom: '1px solid #30363d', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/dashboard')} style={iconBtnStyle}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isWindowsRoom ? <Monitor size={16} color="#58a6ff" /> : <Terminal size={16} color="#3fb950" />}
          <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 15 }}>{room.title}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: 13, color: '#8b949e' }}>
            {completedCount}/{tasks.length} tasks
          </span>
          {/* Progress bar */}
          <div style={{ width: 120, height: 6, background: '#21262d', borderRadius: 3 }}>
            <div style={{
              height: '100%', borderRadius: 3, background: '#3fb950',
              width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%`,
              transition: 'width 0.4s',
            }} />
          </div>
          {session ? (
            <button onClick={stopLab} style={{ ...btnStyle, background: '#b91c1c', fontSize: 12, padding: '0.4rem 0.9rem' }}>
              Stop Lab
            </button>
          ) : (
            <button onClick={startLab} disabled={starting} style={{ ...btnStyle, background: '#238636', fontSize: 12, padding: '0.4rem 0.9rem' }}>
              {starting ? 'Starting...' : 'Start Lab'}
            </button>
          )}
        </div>
      </div>

      {/* Main split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Terminal / Sim pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {session ? (
            <div style={{ flex: 1, padding: '0.75rem', overflow: 'hidden' }}>
              <LabTerminal
                containerId={session.containerId}
                sessionId={session.sessionId}
                onReady={() => {}}
                onOutput={evaluateFlag}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column', gap: '1rem', color: '#8b949e' }}>
              <Terminal size={40} color="#30363d" />
              <p style={{ fontSize: 14 }}>Click <strong style={{ color: '#3fb950' }}>Start Lab</strong> to spin up your environment</p>
            </div>
          )}
        </div>

        {/* Doc panel */}
        {room && <DocPanel category={room.category} componentType={room.component_type} />}

        {/* Task panel */}
        <div style={{
          width: 380, flexShrink: 0, background: '#161b22',
          borderLeft: '1px solid #30363d', display: 'flex',
          flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Task tabs */}
          <div style={{
            display: 'flex', overflowX: 'auto', borderBottom: '1px solid #30363d',
            padding: '0 0.75rem', gap: 2, flexShrink: 0,
          }}>
            {tasks.map((t, i) => (
              <button key={t.id} onClick={() => setActiveTask(i)} style={{
                padding: '0.5rem 0.6rem', border: 'none', cursor: 'pointer',
                background: i === activeTask ? '#0d1117' : 'transparent',
                color:      i === activeTask ? '#e6edf3' : '#8b949e',
                fontSize: 12, borderBottom: i === activeTask ? '2px solid #58a6ff' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
              }}>
                {t.is_captured
                  ? <CheckCircle size={12} color="#3fb950" />
                  : <span style={{ width: 12, height: 12, borderRadius: '50%',
                                   background: '#30363d', display: 'inline-block' }} />}
                Task {t.sequence}
              </button>
            ))}
          </div>

          {/* Task content */}
          {task && (
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <Flag size={14} color="#58a6ff" />
                <span style={{ fontSize: 12, color: '#58a6ff', fontWeight: 600 }}>
                  {task.points} XP
                </span>
                {task.is_captured && <CheckCircle size={14} color="#3fb950" />}
              </div>

              <h2 style={{ color: '#e6edf3', fontSize: 15, fontWeight: 600, marginBottom: '0.75rem', lineHeight: 1.4 }}>
                {task.title}
              </h2>

              <p style={{
                color: '#8b949e', fontSize: 13, lineHeight: 1.65,
                whiteSpace: 'pre-wrap', marginBottom: '1rem',
              }}>
                {task.description}
              </p>

              {/* Flag submission */}
              {!task.is_captured && session && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 6 }}>
                    Submit flag
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={flagInput}
                      onChange={e => setFlagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitFlag()}
                      placeholder="eGSIM{...}"
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <button onClick={submitFlag} disabled={submitting} style={{ ...btnStyle, padding: '0.4rem 0.8rem', fontSize: 12 }}>
                      {submitting ? '...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}

              {task.is_captured && (
                <div style={{ padding: '0.6rem 0.75rem', background: '#1a2f1a',
                              border: '1px solid #3fb950', borderRadius: 6,
                              fontSize: 12, color: '#3fb950', marginBottom: '1rem' }}>
                  ✓ Flag captured — {task.points} XP awarded
                </div>
              )}

              {/* Hints */}
              {!task.is_captured && (
                <div>
                  <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>Need help?</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3].map(tier => (
                      <button key={tier} onClick={() => getHint(tier)} style={{
                        padding: '4px 10px', border: '1px solid #30363d', borderRadius: 6,
                        background: 'transparent', color: '#8b949e', fontSize: 11, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Lightbulb size={11} />
                        Hint {tier}
                      </button>
                    ))}
                  </div>
                  {showHint && (
                    <div style={{ marginTop: 10, padding: '0.6rem 0.75rem',
                                  background: '#1c1a0e', border: '1px solid #d29922',
                                  borderRadius: 6, fontSize: 12, color: '#d29922', lineHeight: 1.5 }}>
                      💡 Hint {showHint.tier}: {showHint.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const centered   = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b949e' };
const iconBtnStyle = { background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', display: 'flex' };
const btnStyle   = { background: '#238636', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: 'pointer', padding: '0.55rem 1rem' };
const inputStyle = { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '0.5rem 0.75rem', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };

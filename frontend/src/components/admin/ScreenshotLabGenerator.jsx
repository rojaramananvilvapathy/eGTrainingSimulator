import { useState, useRef } from 'react';
import { Upload, ImageIcon, Loader, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function ScreenshotLabGenerator() {
  const [file,       setFile]       = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [context,    setContext]    = useState({ os: 'both', difficulty: 'medium', phase: 5, component_type: '', admin_notes: '' });
  const [generating, setGenerating] = useState(false);
  const [result,     setResult]     = useState(null);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) { toast.error('Please select a PNG or JPEG image'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const generate = async () => {
    if (!file) { toast.error('Please upload a screenshot first'); return; }
    setGenerating(true);
    setResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl   = e.target.result;
        const base64    = dataUrl.split(',')[1];
        const mediaType = file.type;
        const { data }  = await api.post('/admin/generate-from-screenshot', { base64Image: base64, mediaType, context });
        setResult(data);
        toast.success(`Lab generated: ${data.room.slug}`);
        setGenerating(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left — upload + context */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${file ? '#3fb950' : '#30363d'}`,
            borderRadius: 10, padding: '2rem', textAlign: 'center',
            cursor: 'pointer', background: file ? '#0d2818' : '#0d1117',
            transition: 'all 0.2s',
          }}
        >
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

          {preview ? (
            <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'contain' }} />
          ) : (
            <>
              <ImageIcon size={36} color="#30363d" style={{ marginBottom: 12 }} />
              <p style={{ color: '#8b949e', fontSize: 13, margin: 0 }}>
                Drop an eG Enterprise screenshot here<br />
                <span style={{ color: '#58a6ff', fontSize: 12 }}>or click to browse</span>
              </p>
            </>
          )}
        </div>

        {file && (
          <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
            📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}

        {/* Context form */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '1rem' }}>
          <h4 style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, marginBottom: '0.75rem' }}>
            Lab Context
          </h4>
          {[
            { key: 'component_type', label: 'Component type',  type: 'text',   placeholder: 'e.g. Citrix, VMware, eG Manager' },
            { key: 'admin_notes',    label: 'Admin notes',      type: 'text',   placeholder: 'Any extra context for the AI' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key} style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{label}</label>
              <input type={type} value={context[key]} placeholder={placeholder}
                onChange={e => setContext(c => ({ ...c, [key]: e.target.value }))}
                style={{ ...inputSt, width: '100%', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            {[
              { key: 'os',         label: 'OS',         options: ['linux', 'windows', 'both'] },
              { key: 'difficulty', label: 'Difficulty',  options: ['easy', 'medium', 'hard', 'expert'] },
              { key: 'phase',      label: 'Phase',       options: [3,4,5,6] },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{label}</label>
                <select value={context[key]} onChange={e => setContext(c => ({ ...c, [key]: e.target.value }))} style={inputSt}>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={generating || !file} style={{
          padding: '0.7rem', background: generating ? '#21262d' : '#1f6feb',
          border: 'none', borderRadius: 6, color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: generating || !file ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {generating
            ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />Analysing screenshot & generating lab...</>
            : <><Upload size={14} />Generate Lab from Screenshot</>}
        </button>
      </div>

      {/* Right — result */}
      <div>
        {result ? (
          <div style={{ background: '#0d2818', border: '1px solid #3fb950', borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
              <CheckCircle size={18} color="#3fb950" />
              <span style={{ color: '#3fb950', fontWeight: 600, fontSize: 14 }}>Lab Generated!</span>
            </div>

            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Room slug</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', background: '#0d1117',
                          padding: '0.5rem', borderRadius: 6, marginBottom: '0.75rem' }}>
              {result.room?.slug}
            </div>

            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Title</div>
            <div style={{ fontSize: 13, color: '#e6edf3', marginBottom: '0.75rem' }}>{result.room?.title}</div>

            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>
              {result.taskCount} tasks · Status: draft · Go to Room Management → publish
            </div>

            {result.extractedFields?.fields?.length > 0 && (
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ fontSize: 12, color: '#58a6ff', cursor: 'pointer' }}>
                  Fields extracted from screenshot ({result.extractedFields.fields.length})
                </summary>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {result.extractedFields.fields.map((f, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#8b949e', padding: '3px 6px',
                                          background: '#0d1117', borderRadius: 4 }}>
                      <span style={{ color: '#e6edf3' }}>{f.label}</span>
                      {f.value ? ` = "${f.value}"` : ''} ({f.type})
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
                        padding: '1.5rem', color: '#8b949e', fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 8 }}>How it works</p>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Upload a screenshot of any eG Enterprise UI screen (DB config, component setup, threshold page, etc.)</li>
              <li>AI analyses the screenshot and extracts all visible field names, labels, and parameters</li>
              <li>A complete lab room YAML is generated with tasks, hints, flag conditions, and explanations</li>
              <li>Room is saved as draft — review it in Room Management, then publish</li>
            </ol>
            <p style={{ marginTop: '0.75rem', fontSize: 12, color: '#58a6ff' }}>
              Works for any eG Enterprise screen: component config, threshold setup, alert rules, agent approval, DB config, and more.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputSt = { background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', padding: '0.4rem 0.6rem', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };

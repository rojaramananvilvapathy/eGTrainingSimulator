import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon }  from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import useAuthStore from '../../store/authStore';

const SOCKET_URL = window.location.origin;

export default function LabTerminal({ containerId, sessionId, onReady, onOutput }) {
  const termRef      = useRef(null);
  const socketRef    = useRef(null);
  const terminalRef  = useRef(null);
  const fitAddonRef  = useRef(null);
  const lastCmd      = useRef('');
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!termRef.current || !containerId) return;

    // ── Initialise xterm ──────────────────────────────────────
    const term = new Terminal({
      cursorBlink:       true,
      fontSize:          14,
      fontFamily:        "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor:     '#58a6ff',
        selectionBackground: '#3b82f630',
        black:      '#484f58',
        green:      '#3fb950',
        yellow:     '#d29922',
        blue:       '#58a6ff',
        magenta:    '#bc8cff',
        cyan:       '#39c5cf',
        white:      '#b1bac4',
        brightGreen:'#56d364',
        brightBlue: '#79c0ff',
      },
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon      = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(termRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;32m  eG Enterprise Simulation Platform\x1b[0m');
    term.writeln('\x1b[90m  Connecting to lab environment...\x1b[0m\r\n');

    // ── Connect Socket.IO ─────────────────────────────────────
    const socket = io(`${SOCKET_URL}/terminal`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('terminal:start', { containerId, sessionId });
    });

    socket.on('terminal:ready', () => {
      term.writeln('\x1b[1;32m  ✓ Terminal connected\x1b[0m\r\n');
      if (onReady) onReady();
    });

    socket.on('terminal:output', ({ data }) => {
      term.write(data);
    });

    socket.on('terminal:error', ({ message }) => {
      term.writeln(`\r\n\x1b[1;31m  ERROR: ${message}\x1b[0m\r\n`);
    });

    // ── Input → server ────────────────────────────────────────
    term.onData((data) => {
      socket.emit('terminal:input', { data });
      if (data === '\r' || data === '\n') {
        lastCmd.current = '';
      } else if (data.charCodeAt(0) >= 32) {
        lastCmd.current += data;
      }
    });

    // ── Resize ────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      socket.emit('terminal:resize', {
        containerId,
        cols: term.cols,
        rows: term.rows,
      });
    });
    resizeObserver.observe(termRef.current);

    return () => {
      socket.disconnect();
      term.dispose();
      resizeObserver.disconnect();
    };
  }, [containerId, sessionId, accessToken]);

  return (
    <div
      ref={termRef}
      style={{ width: '100%', height: '100%', minHeight: '400px', borderRadius: '8px', overflow: 'hidden' }}
    />
  );
}

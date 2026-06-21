import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { apiClient } from '../../lib/api';

interface TerminalSessionProps {
  sessionId: string;
  isActive: boolean;
}

export default function TerminalSession({ sessionId, isActive }: TerminalSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      scrollback: 10000,
      allowProposedApi: true,
      convertEol: true,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#c9d1d9',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    term.focus();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    requestAnimationFrame(() => fitAddon.fit());

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    const token = apiClient.getToken();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/ws`}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    let connected = false;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'terminal_connect', sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'terminal_connected':
            connected = true;
            term.writeln('\x1b[32mTerminal connected\x1b[0m');
            break;
          case 'terminal_data':
            term.write(msg.data);
            break;
          case 'terminal_error':
            term.writeln(`\x1b[31m${msg.error}\x1b[0m`);
            break;
          case 'terminal_closed':
            term.writeln('\x1b[31mSession closed\x1b[0m');
            break;
          case 'connected':
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      term.writeln('\x1b[33mDisconnected\x1b[0m');
    };

    term.onData((data) => {
      if (connected && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal_input', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (connected && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal_resize', cols, rows }));
      }
    });

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [sessionId, isActive]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
}

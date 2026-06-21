import React from 'react';
import { Minus, Maximize2, Minimize2, X, Terminal } from 'lucide-react';

interface TerminalToolbarProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  sessionCount: number;
}

export default function TerminalToolbar({ isMaximized, onToggleMaximize, onClose, sessionCount }: TerminalToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-2">
        <Terminal size={14} className="text-green-400" />
        <span className="text-xs font-semibold text-gray-300 font-mono">Terminal</span>
        {sessionCount > 0 && (
          <span className="text-[10px] text-gray-600">{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMaximize}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
          title="Close terminal"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

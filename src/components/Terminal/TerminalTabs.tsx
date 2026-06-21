import React from 'react';
import { X, Plus, Terminal } from 'lucide-react';

interface TerminalTabsProps {
  sessions: Array<{ id: string; name: string }>;
  activeSession: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export default function TerminalTabs({ sessions, activeSession, onSelect, onClose, onNew }: TerminalTabsProps) {
  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-700 px-2 shrink-0">
      <div className="flex items-center flex-1 overflow-x-auto">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer border-b-2 transition-colors text-sm select-none ${
              activeSession === s.id
                ? 'border-indigo-500 bg-white/5 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
            }`}
          >
            <Terminal size={12} />
            <span className="font-mono text-xs">{s.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onNew}
        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1 shrink-0"
        title="New tab"
      >
        <Plus size={14} />
      </button>
      {sessions.length > 0 && (
        <span className="text-[10px] text-gray-600 ml-2">{sessions.length}</span>
      )}
    </div>
  );
}

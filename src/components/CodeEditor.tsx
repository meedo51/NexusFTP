import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FileItem, useStore } from '../store';
import { X, Save, Settings, Copy, Search, CornerDownLeft, RotateCcw } from 'lucide-react';

interface CodeEditorProps {
  file: FileItem;
  path: string;
  isLocal: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const getLanguageFromFile = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx': return 'javascript';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'c': return 'c';
    case 'cpp': return 'cpp';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'sql': return 'sql';
    case 'xml': return 'xml';
    case 'yaml':
    case 'yml': return 'yaml';
    case 'sh': return 'shell';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    default: return 'plaintext';
  }
};

export default function CodeEditor({ file, path, isLocal, onClose, onRefresh }: CodeEditorProps) {
  const { activeConnectionId } = useStore();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [minimap, setMinimap] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      const cid = isLocal ? 'local' : (activeConnectionId || 'local');
      try {
        const res = await fetch('/api/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cid, path, name: file.name })
        });
        const data = await res.json();
        if (data.success) {
          setContent(data.content);
          setOriginalContent(data.content);
        } else {
          alert('Failed to read file: ' + data.error);
          onClose();
        }
      } catch (e) {
        console.error(e);
        alert('Failed to read file');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [file.name, path, isLocal, activeConnectionId]);

  const hasUnsavedChanges = content !== originalContent;

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setSaving(true);
    const cid = isLocal ? 'local' : (activeConnectionId || 'local');
    try {
      const res = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cid, path, name: file.name, content })
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(content);
        onRefresh();
      } else {
        alert('Failed to save file: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-[5000] bg-[#1A1A1E] flex flex-col"
    >
      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 shrink-0 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm flex items-center gap-2">
                {file.name}
                {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes"></span>}
              </span>
            </div>
            <span className="text-gray-500 text-xs">{path}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTheme(t => t === 'vs-dark' ? 'light' : 'vs-dark')}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Toggle Theme"
          >
            <Settings size={16} />
          </button>
          
          <button 
            onClick={handleSave} 
            disabled={!hasUnsavedChanges || saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              hasUnsavedChanges && !saving
                ? 'bg-indigo-500 hover:bg-indigo-600 text-white' 
                : 'bg-white/5 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          
          <div className="h-4 w-px bg-white/10 mx-1"></div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading file content...
        </div>
      ) : (
        <div className="flex-1 relative">
          <Editor
            height="100%"
            language={getLanguageFromFile(file.name)}
            theme={theme}
            value={content}
            onChange={(val) => setContent(val || '')}
            options={{
              fontSize,
              wordWrap,
              minimap: { enabled: minimap },
              fontFamily: "'JetBrains Mono', monospace",
              padding: { top: 16 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        </div>
      )}
      
      {/* Status Bar */}
      <div className="h-6 bg-black/40 border-t border-white/10 flex items-center justify-between px-4 shrink-0 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>{getLanguageFromFile(file.name).toUpperCase()}</span>
          <span>{content.split('\n').length} Lines</span>
          <span>{content.length} Chars</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')} className="hover:text-white transition-colors">
            Wrap: {wordWrap}
          </button>
          <button onClick={() => setMinimap(m => !m)} className="hover:text-white transition-colors">
            Minimap: {minimap ? 'On' : 'Off'}
          </button>
          <span>UTF-8</span>
        </div>
      </div>
    </motion.div>
  );
}

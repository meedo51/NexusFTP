import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderPlus, FilePlus, Edit2, Trash2, Download, Upload, Info, Copy, Scissors, ClipboardPaste, X } from 'lucide-react';
import { useStore } from '../store';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuType {
  pos: ContextMenuPosition;
  isLocal: boolean;
  onClose: () => void;
  target?: string; // name
}

export default function ContextMenu({ pos, isLocal, target, onClose }: ContextMenuType) {
  const ref = useRef<HTMLDivElement>(null);
  const { selectedLocalFiles, selectedRemoteFiles } = useStore();
  
  const selected = isLocal ? selectedLocalFiles : selectedRemoteFiles;
  const isMulti = selected.length > 1;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Prevent going off-screen
  const style: React.CSSProperties = {
    top: Math.min(pos.y, window.innerHeight - 300),
    left: Math.min(pos.x, window.innerWidth - 220),
  };

  return (
    <AnimatePresence>
      <motion.div 
        ref={ref}
        initial={{ opacity: 0, scale: 0.95, y: -5 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={style}
        className="fixed w-56 bg-black/60 border border-white/10 rounded-xl shadow-2xl flex flex-col py-1.5 z-50 overflow-hidden backdrop-blur-xl"
      >
        <div className="px-3 py-2 border-b border-white/5 mb-1 bg-white/5">
           <p className="text-xs font-semibold text-gray-400 truncate">
              {target ? target : (isMulti ? `${selected.length} items selected` : 'Current Directory')}
           </p>
        </div>

        {target && !isMulti && (
          <>
            <MenuItem icon={<Download size={15}/>} label="Download" shortcut="Cmd D" />
            <MenuItem icon={<Edit2 size={15}/>} label="Rename" shortcut="Enter" />
            <div className="h-px bg-white/10 my-1 mx-2" />
            <MenuItem icon={<Scissors size={15}/>} label="Cut" shortcut="Cmd X" />
            <MenuItem icon={<Copy size={15}/>} label="Copy" shortcut="Cmd C" />
          </>
        )}
        
        {target && isMulti && (
          <>
            <MenuItem icon={<Download size={15}/>} label="Download Selected" />
            <MenuItem icon={<Copy size={15}/>} label="Copy Selected" />
          </>
        )}

        {!target && (
           <>
             <MenuItem icon={<FolderPlus size={15}/>} label="New Folder" shortcut="Cmd N" />
             <MenuItem icon={<FilePlus size={15}/>} label="New File" />
             <div className="h-px bg-white/10 my-1 mx-2" />
             <MenuItem icon={<ClipboardPaste size={15}/>} label="Paste" shortcut="Cmd V" disabled />
           </>
        )}

        <div className="h-px bg-white/10 my-1 mx-2" />
        
        {target && (
          <MenuItem 
            icon={<Trash2 size={15}/>} 
            label="Delete" 
            shortcut="Backspace" 
            danger 
          />
        )}
        
        {target && !isMulti && (
          <>
            <div className="h-px bg-white/10 my-1 mx-2" />
            <MenuItem icon={<Info size={15}/>} label="Properties" />
          </>
        )}
        
      </motion.div>
    </AnimatePresence>
  );
}

function MenuItem({ icon, label, shortcut, danger, disabled }: any) {
  return (
    <button 
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors mx-1 rounded-md max-w-[calc(100%-8px)]
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/10'}
        ${danger ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300' : 'text-[#E0E0E6] hover:text-white'}
      `}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-gray-500 font-medium tracking-widest">{shortcut}</span>}
    </button>
  );
}

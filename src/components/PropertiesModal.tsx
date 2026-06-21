import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save } from 'lucide-react';
import { FileItem, useStore } from '../store';
import { apiClient } from '../lib/api';
import { formatBytes } from '../lib/utils';
import { format } from 'date-fns';

export default function PropertiesModal({ 
  file, 
  isLocal, 
  path, 
  onClose,
  onRefresh
}: { 
  file: FileItem | null, 
  isLocal: boolean,
  path: string,
  onClose: () => void,
  onRefresh: () => void
}) {
  const [mounted, setMounted] = useState(false);
  const [permissions, setPermissions] = useState('');
  const { activeConnectionId } = useStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (file) {
      setPermissions(file.permissions || '');
    }
  }, [file]);

  const handleSave = async () => {
    if (!file) return;
    const cid = isLocal ? 'local' : (activeConnectionId || 'local');
    try {
            await apiClient.post('/files/permissions', { id: cid, path, name: file.name, permissions });
      onRefresh();
      onClose();
    } catch(e) {
      console.error(e);
    }
  };

  if (!mounted || !file) return null;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-[#1A1A1E] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h3 className="font-semibold text-white truncate pr-4">Properties: {file.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 flex flex-col gap-4 text-sm text-gray-300">
           <div className="grid grid-cols-3 gap-2">
              <div className="text-gray-500">Type</div>
              <div className="col-span-2 font-medium text-white">{file.type === 'dir' ? 'Folder' : 'File'}</div>
              
              <div className="text-gray-500">Size</div>
              <div className="col-span-2 font-medium text-white">{formatBytes(file.size, 2)}</div>
              
              <div className="text-gray-500">Modified</div>
              <div className="col-span-2 font-medium text-white">{format(new Date(file.modifyTime), 'PPpp')}</div>
              
              <div className="text-gray-500">Owner</div>
              <div className="col-span-2 font-medium text-white">{file.owner}</div>
              
              <div className="text-gray-500">Group</div>
              <div className="col-span-2 font-medium text-white">{file.group}</div>
           </div>

           <div className="mt-2 pt-4 border-t border-white/10">
              <label className="block text-gray-500 mb-2">Permissions</label>
              <input 
                type="text" 
                value={permissions}
                onChange={e => setPermissions(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 755 or drwxr-xr-x"
              />
           </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md hover:bg-white/5 text-gray-300 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white transition-colors text-sm font-medium">
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {file && modal}
    </AnimatePresence>,
    document.body
  );
}

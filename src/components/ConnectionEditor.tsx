import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Save, Shield } from 'lucide-react';
import { useStore, ConnectionConfig, Protocol } from '../store';
import { generateId } from '../lib/utils';

export default function ConnectionEditor({ conn, onClose }: { conn: ConnectionConfig | null, onClose: () => void }) {
  const { addConnection, updateConnection, deleteConnection } = useStore();
  
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>(
    conn || {
      id: generateId(),
      name: 'New Connection',
      protocol: 'sftp',
      host: '',
      port: 22,
      username: '',
      password: '',
      favorite: false
    }
  );

  const handleSave = () => {
    if (!formData.name || !formData.host || !formData.username) return alert('Name, Host, and Username are required.');
    
    if (conn) {
      updateConnection(conn.id, formData);
    } else {
      addConnection(formData as ConnectionConfig);
    }
    onClose();
  };

  const handleDelete = () => {
    if (conn && confirm('Are you sure you want to delete this connection?')) {
      deleteConnection(conn.id);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-[#111116] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-xl font-semibold text-white">{conn ? 'Edit Connection' : 'New Connection'}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
          {/* Protocol Selection */}
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5 grid grid-cols-3">
            {(['sftp', 'ftps', 'ftp'] as Protocol[]).map(p => (
              <button
                key={p}
                onClick={() => setFormData({ ...formData, protocol: p, port: p === 'sftp' ? 22 : 21 })}
                className={`flex items-center justify-center py-2.5 rounded-lg text-sm font-medium uppercase tracking-wider transition-all ${formData.protocol === p ? 'bg-cyan-500 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Connection Name</label>
              <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/40 border border-white/10 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none" placeholder="My Server" />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-400 mb-1 block">Host / IP</label>
                <input type="text" value={formData.host || ''} onChange={e => setFormData({...formData, host: e.target.value})} className="w-full bg-black/40 border border-white/10 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none font-mono text-sm" placeholder="example.com" />
              </div>
              <div className="w-24">
                <label className="text-xs font-medium text-gray-400 mb-1 block">Port</label>
                <input type="number" value={formData.port || ''} onChange={e => setFormData({...formData, port: parseInt(e.target.value)})} className="w-full bg-black/40 border border-white/10 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none font-mono text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Username</label>
              <input type="text" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-black/40 border border-white/10 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none font-mono text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Password</label>
              <input type="password" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-black/40 border border-white/10 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white outline-none font-mono text-sm" />
            </div>

            {formData.protocol === 'sftp' && (
              <div>
                <label className="text-xs font-medium text-teal-400 mb-1 flex items-center gap-1"><Shield size={12}/> Private Key (Optional)</label>
                <textarea 
                  value={formData.privateKey || ''} 
                  onChange={e => setFormData({...formData, privateKey: e.target.value})} 
                  className="w-full bg-black/40 border border-white/10 focus:border-teal-500 rounded-xl px-4 py-2.5 text-white outline-none font-mono text-xs h-24 resize-none" 
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." 
                />
              </div>
            )}
            
            <label className="flex items-center gap-3 cursor-pointer mt-2 text-sm text-gray-300 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-white/5">
               <input type="checkbox" checked={formData.favorite || false} onChange={e => setFormData({ ...formData, favorite: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-black/50 text-cyan-500 focus:ring-cyan-500" />
               Mark as Favorite
            </label>
          </div>
        </div>

        <div className="p-5 border-t border-white/5 bg-black/20 flex items-center justify-between">
          {conn ? (
             <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
               Delete
             </button>
          ) : <div />}
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white bg-cyan-500 hover:bg-cyan-600 shadow-lg shadow-cyan-500/20 transition-all active:scale-95">
              <Save size={18} />
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

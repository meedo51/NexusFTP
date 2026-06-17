import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Server, HardDrive, Search, MoreVertical, Shield, Globe, Star } from 'lucide-react';
import { useStore, ConnectionConfig } from '../store';
import { apiClient } from '../lib/api';
import { cn } from '../lib/utils';
import ConnectionEditor from './ConnectionEditor';
import NotificationToast from './NotificationToast';

export default function ConnectionManager() {
  const { connections, setActiveConnection, setIsConnected, addNotification } = useStore();
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<ConnectionConfig | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const filtered = connections.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.host.toLowerCase().includes(search.toLowerCase()));

  const handleConnect = async (conn: ConnectionConfig) => {
    setConnectingId(conn.id);
    try {
            const data = await apiClient.post<{ success: boolean; token?: string; error?: string }>('/connect', conn);
      if (data.success) {
        if (data.token) apiClient.setToken(data.token);
        setActiveConnection(conn.id);
        setIsConnected(true);
        addNotification({ type: 'success', message: `Connected to ${conn.name}` });
      } else {
        addNotification({ type: 'error', message: data.error || 'Connection failed' });
      }
    } catch (e: any) {
      addNotification({ type: 'error', message: e.message || 'Connection error' });
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden backdrop-blur-sm">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl flex flex-col gap-8 z-10"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">Connections</h2>
            <p className="text-gray-400 mt-1">Select a server to initiate hyperspace bypass.</p>
          </div>
          <button 
            onClick={() => { setEditingConn(null); setEditorOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 transition-all text-white rounded-xl shadow-lg shadow-cyan-500/25 font-medium"
          >
            <Plus size={18} />
            <span>New Connection</span>
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-400 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search connections..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 outline-none transition-all focus:ring-4 focus:ring-cyan-500/10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Localhost Demo Card */}
          <ConnectionCard 
            conn={{ id: 'local', name: 'Local Simulator', protocol: 'ftp', host: 'localhost', port: 21, username: 'local' }} 
            onConnect={handleConnect}
            connecting={connectingId === 'local'}
            onEdit={() => {}}
            isLocal
          />

          {filtered.map(conn => (
            <ConnectionCard 
              key={conn.id} 
              conn={conn} 
              onConnect={handleConnect}
              connecting={connectingId === conn.id}
              onEdit={() => { setEditingConn(conn); setEditorOpen(true); }}
            />
          ))}
          
          {filtered.length === 0 && connections.length > 0 && (
             <div className="col-span-full py-12 text-center text-gray-500">No connections match your search.</div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {editorOpen && (
          <ConnectionEditor 
            conn={editingConn} 
            onClose={() => setEditorOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConnectionCard({ conn, onConnect, onEdit, connecting, isLocal }: { key?: string | number; conn: ConnectionConfig; onConnect: (c: ConnectionConfig) => void; onEdit: () => void; connecting: boolean; isLocal?: boolean }) {
  const getProtocolColor = (p: string) => {
    switch(p) {
      case 'sftp': return 'from-teal-500/20 to-emerald-500/5 border-teal-500/20 text-teal-400';
      case 'ftps': return 'from-purple-500/20 to-fuchsia-500/5 border-purple-500/20 text-purple-400';
      default: return 'from-cyan-500/20 to-blue-500/5 border-cyan-500/20 text-cyan-400';
    }
  };

  const colors = getProtocolColor(conn.protocol);
  
  return (
    <motion.div 
      layoutId={`conn-${conn.id}`}
      whileHover={{ y: -4, scale: 1.02 }}
      className={cn(
        "group relative flex flex-col p-5 rounded-2xl bg-gradient-to-br border backdrop-blur-md cursor-pointer transition-all duration-300",
        colors,
        "hover:shadow-xl hover:shadow-black/50"
      )}
      onClick={() => !connecting && onConnect(conn)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 shrink-0">
          {isLocal ? <HardDrive size={20} className="text-gray-300" /> : conn.protocol === 'sftp' ? <Shield size={20} /> : <Globe size={20} />}
        </div>
        <div className="flex items-center gap-2">
          {conn.favorite && <Star size={16} className="text-yellow-500 fill-yellow-500" />}
          {!isLocal && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-white truncate">{conn.name}</h3>
        <p className="text-sm text-white/60 truncate flex items-center gap-1.5 mt-1">
          <span className="font-mono text-xs opacity-70">{conn.username}</span> @ <span className="truncate">{conn.host}</span>
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs font-medium">
        <span className="uppercase tracking-wider opacity-80 px-2 py-1 rounded-md bg-black/20">{isLocal ? 'DEMO' : conn.protocol}</span>
        {connecting ? (
           <div className="flex items-center gap-2 text-white">
             <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> Connecting...
           </div>
        ) : (
          <span className="text-white/40 group-hover:text-white/80 transition-colors">Click to connect</span>
        )}
      </div>
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none mix-blend-overlay" />
    </motion.div>
  );
}

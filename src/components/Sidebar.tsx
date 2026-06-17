import React from 'react';
import { useStore } from '../store';
import { apiClient } from '../lib/api';

export default function Sidebar() {
  const { isConnected, setIsConnected, setActiveConnection, activeConnectionId } = useStore();

  const handleDisconnect = async () => {
    if (activeConnectionId) {
      try {
        await apiClient.post('/api/disconnect', { id: activeConnectionId });
      } catch (e) { /* ignore */ }
    }
    setIsConnected(false);
    setActiveConnection(null);
  };

  return (
    <aside className="w-60 bg-black/20 backdrop-blur-lg border-r border-white/5 p-4 flex flex-col gap-6 shrink-0 h-full">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#E0E0E6]/30 font-bold mb-3 ml-2">Connections</p>
        <nav className="space-y-1">
          {isConnected ? (
             <div className="flex items-center gap-3 px-3 py-2 bg-white/10 rounded-xl border border-white/10 text-sm">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></div>
                <span className="font-medium text-white">Active session</span>
             </div>
          ) : (
             <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl border border-white/5 text-sm">
                <div className="w-2 h-2 rounded-full bg-gray-500/40"></div>
                <span className="font-medium text-[#E0E0E6]/50">Not connected</span>
             </div>
          )}
        </nav>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#E0E0E6]/30 font-bold mb-3 ml-2">Navigation</p>
        <nav className="space-y-1">
          <div 
             onClick={() => {
                if (isConnected) handleDisconnect();
             }}
             className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${!isConnected ? 'bg-white/10 text-cyan-400' : 'text-[#E0E0E6]/70 hover:bg-white/5'}`}
          >
             <div className="flex items-center gap-3">
               <svg className={`w-4 h-4 ${!isConnected ? 'text-cyan-400' : 'opacity-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
               <span className={!isConnected ? "font-medium" : ""}>Server Index</span>
             </div>
          </div>

          {isConnected && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer bg-white/10 text-cyan-400">
               <div className="flex items-center gap-3">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                 <span className="font-medium">File Browser</span>
               </div>
            </div>
          )}
        </nav>
      </div>

      {isConnected && (
        <div className="mt-auto">
          <button 
             onClick={handleDisconnect}
             className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors border border-red-500/20 text-sm font-medium"
          >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
             Disconnect
          </button>
        </div>
      )}
    </aside>
  );
}

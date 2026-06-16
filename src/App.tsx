/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { useStore } from './store';
import ConnectionManager from './components/ConnectionManager';
import FileBrowser from './components/FileBrowser';
import Sidebar from './components/Sidebar';

export default function App() {
  const { isConnected, activeConnectionId, theme, isSidebarOpen, toggleSidebar } = useStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Make the background very dark, space-like for that "Nexus" feel
  return (
    <div className="h-screen w-full bg-[#050508] text-[#E0E0E6] flex flex-col font-sans select-none overflow-hidden selection:bg-cyan-500/30">
      <header className="h-16 flex items-center justify-between px-6 bg-white/5 backdrop-blur-xl border-b border-white/10 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button 
             onClick={toggleSidebar}
             className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>

          <div className="w-8 h-8 ml-2 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M2 12h20"/><path d="M12 2v20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m19.07 4.93-14.14 14.14"/></svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Nexus<span className="text-cyan-400">FTP</span></h1>
        </div>
        <div className="flex items-center gap-4">
           {isConnected && (
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
               <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
               SFTP Secure
             </div>
           )}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden flex">
        {isSidebarOpen && <Sidebar />}
        <div className="flex-1 flex min-w-0 bg-transparent">
           {!isConnected ? (
             <ConnectionManager />
           ) : (
             <FileBrowser />
           )}
        </div>
      </main>
    </div>
  );
}

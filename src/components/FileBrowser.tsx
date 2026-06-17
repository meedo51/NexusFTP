import React, { useEffect } from 'react';
import { useStore } from '../store';
import FilePanel from './FilePanel';
import { PanelLeft, PanelRight, Columns } from 'lucide-react';
import { cn } from '../lib/utils';

export default function FileBrowser() {
  const { isConnected, activeConnectionId, setLocalFiles, setRemoteFiles, localPath, remotePath, layoutMode, setLayoutMode } = useStore();

  const fetchFiles = async (isLocal: boolean) => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: isLocal ? 'local' : activeConnectionId, 
          path: isLocal ? localPath : remotePath 
        })
      });
      const data = await res.json();
      if (data.files) {
         if (isLocal) setLocalFiles(data.files);
         else setRemoteFiles(data.files);
      }
    } catch(e) {
      console.error("Failed to fetch files", e);
    }
  };

  useEffect(() => {
    fetchFiles(true);
  }, [localPath]);

  useEffect(() => {
    if (isConnected && activeConnectionId) {
       fetchFiles(false);
    }
  }, [isConnected, activeConnectionId, remotePath]);


  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden bg-transparent">
        <div className="flex items-center justify-center p-3 border-b border-white/10 shrink-0">
           <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              <button 
                 onClick={() => setLayoutMode('local')}
                 className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2", layoutMode === 'local' ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white")}
                 title="Show Local Only"
              >
                  <PanelLeft size={14} />
                  Local
              </button>
              <button 
                 onClick={() => setLayoutMode('split')}
                 className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2", layoutMode === 'split' ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white")}
                 title="Show Split View"
              >
                  <Columns size={14} />
                  Split
              </button>
              <button 
                 onClick={() => setLayoutMode('remote')}
                 className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2", layoutMode === 'remote' ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white")}
                 title="Show Remote Only"
              >
                  <PanelRight size={14} />
                  Remote
              </button>
           </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden p-6">
           {/* Local Panel */}
           {(layoutMode === 'split' || layoutMode === 'local') && (
               <section className="flex-1 flex flex-col gap-4 min-w-0">
                  <h3 className="text-xs font-bold text-[#E0E0E6]/30 uppercase tracking-widest px-2">Local Workstation</h3>
                  <FilePanel isLocal={true} onRefresh={() => fetchFiles(true)} />
               </section>
           )}
           
           {/* Remote Panel */}
           {(layoutMode === 'split' || layoutMode === 'remote') && (
               <section className="flex-1 flex flex-col gap-4 min-w-0">
                  <h3 className="text-xs font-bold text-[#E0E0E6]/30 uppercase tracking-widest px-2">Remote Server</h3>
                  <FilePanel isLocal={false} onRefresh={() => fetchFiles(false)} />
               </section>
           )}
        </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import FilePanel from './FilePanel';

export default function FileBrowser() {
  const { isConnected, activeConnectionId, setLocalFiles, setRemoteFiles, localPath, remotePath } = useStore();

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
    if (isConnected) {
       // Ideally a real app would use the user's local filesystem API if possible, 
       // but here we simulate the local filesystem on the server too for demo purposes logic.
       // However, we want to hit the real server for remote. Let's make it hit local for local.
       fetchFiles(true);
    }
  }, [isConnected, localPath]);

  useEffect(() => {
    if (isConnected && activeConnectionId) {
       fetchFiles(false);
    }
  }, [isConnected, activeConnectionId, remotePath]);


  return (
    <div className="flex-1 w-full flex gap-6 overflow-hidden p-6 bg-transparent">
       {/* Local Panel */}
       <section className="flex-1 flex flex-col gap-4 min-w-0">
          <h3 className="text-xs font-bold text-[#E0E0E6]/30 uppercase tracking-widest px-2">Local Workstation</h3>
          <FilePanel isLocal={true} onRefresh={() => fetchFiles(true)} />
       </section>
       
       {/* Remote Panel */}
       <section className="flex-1 flex flex-col gap-4 min-w-0">
          <h3 className="text-xs font-bold text-[#E0E0E6]/30 uppercase tracking-widest px-2">Remote Server</h3>
          <FilePanel isLocal={false} onRefresh={() => fetchFiles(false)} />
       </section>
    </div>
  )
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, File as FileIcon, HardDrive, Globe, MoreHorizontal, ArrowUp, RefreshCw, Upload, Download, Plus, Trash2 } from 'lucide-react';
import { useStore, FileItem } from '../store';
import { formatBytes, cn } from '../lib/utils';
import { format } from 'date-fns';
import ContextMenu, { ContextMenuPosition } from './ContextMenu';

export default function FilePanel({ isLocal, onRefresh }: { isLocal: boolean, onRefresh: () => void }) {
  const { 
    localFiles, remoteFiles, 
    localPath, remotePath, 
    setLocalPath, setRemotePath,
    selectedLocalFiles, selectedRemoteFiles,
    toggleLocalFileSelection, toggleRemoteFileSelection,
    activeConnectionId
  } = useStore();

  const files = isLocal ? localFiles : remoteFiles;
  const path = isLocal ? localPath : remotePath;
  const selected = isLocal ? selectedLocalFiles : selectedRemoteFiles;
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [contextMenu, setContextMenu] = useState<{ pos: ContextMenuPosition, target?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Real app: upload logic here
    console.log("Dropped files", e.dataTransfer.files);
  };

  const navigateUp = () => {
    if (path === '/') return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    if (isLocal) setLocalPath(newPath);
    else setRemotePath(newPath);
  };

  const navigateTo = (folder: string) => {
    const newPath = path === '/' ? '/' + folder : path + '/' + folder;
    if (isLocal) setLocalPath(newPath);
    else setRemotePath(newPath);
  };
  
  const toggleSelection = (name: string, multi: boolean) => {
     if (isLocal) toggleLocalFileSelection(name, multi);
     else toggleRemoteFileSelection(name, multi);
  };

  const handleContextMenu = (e: React.MouseEvent, targetName?: string) => {
     e.preventDefault();
     if (targetName && !selected.includes(targetName)) {
        toggleSelection(targetName, false);
     }
     setContextMenu({ pos: { x: e.clientX, y: e.clientY }, target: targetName });
  };

  // Sorted: folders first, then files, alphabetically
  const sortedFiles = [...files].sort((a, b) => {
     if (a.type === 'dir' && b.type === 'file') return -1;
     if (a.type === 'file' && b.type === 'dir') return 1;
     return a.name.localeCompare(b.name);
  });

  return (
    <div 
       className="flex-1 flex flex-col h-full overflow-hidden relative bg-white/5 backdrop-blur-md rounded-2xl border border-white/10" 
       onContextMenu={(e) => handleContextMenu(e)}
       onDragOver={onDragOver}
       onDragLeave={onDragLeave}
       onDrop={onDrop}
    >
       {/* Breadcrumb Header */}
       <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 shrink-0 bg-transparent">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
             <div className="flex items-center justify-center p-1.5 rounded-md bg-white/5 text-gray-400 shrink-0">
               {isLocal ? <HardDrive size={16} /> : <Globe size={16} />}
             </div>
             
             {/* Simple path parsing */}
             <div className="flex items-center text-sm font-medium text-gray-300 whitespace-nowrap">
                <span className="cursor-pointer hover:text-white transition-colors" onClick={() => (isLocal ? setLocalPath('/') : setRemotePath('/'))}>
                  {isLocal ? 'Local' : 'Remote'}
                </span>
                {path !== '/' && path.split('/').filter(Boolean).map((segment, i, arr) => {
                   const partial = '/' + arr.slice(0, i + 1).join('/');
                   return (
                     <React.Fragment key={i}>
                       <span className="mx-1.5 text-gray-600">/</span>
                       <span 
                         className="cursor-pointer hover:text-white transition-colors text-white"
                         onClick={() => (isLocal ? setLocalPath(partial) : setRemotePath(partial))}
                       >
                         {segment}
                       </span>
                     </React.Fragment>
                   )
                })}
             </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-4">
             <button onClick={navigateUp} disabled={path === '/'} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30">
                <ArrowUp size={16} />
             </button>
             <button onClick={onRefresh} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <RefreshCw size={16} />
             </button>
          </div>
       </div>
       
       {/* Actions Bar */}
       <div className="p-2 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
         <div className="flex items-center gap-1">
           <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
             <Plus size={16}/> New Folder
           </button>
           {selected.length > 0 && (
             <>
               <div className="w-px h-4 bg-white/10 mx-2" />
               <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-blue-500/20 transition-colors">
                 {isLocal ? <Upload size={16}/> : <Download size={16}/>} 
                 {isLocal ? 'Upload' : 'Download'}
               </button>
               <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                 <Trash2 size={16}/> Delete
               </button>
             </>
           )}
         </div>
         <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 ml-auto mr-4">
            <button 
               onClick={() => setViewMode('grid')}
               className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
            >Grid</button>
            <button 
               onClick={() => setViewMode('list')}
               className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", viewMode === 'list' ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
            >List</button>
         </div>
         <div className="text-xs text-gray-500 font-medium tracking-wide">
           {selected.length > 0 ? `${selected.length} selected` : `${files.length} items`}
         </div>
       </div>

       {/* File List */}
       <div className="flex-1 overflow-y-auto no-scrollbar outline-none p-2" tabIndex={0}>
          {sortedFiles.length === 0 ? (
             <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
               {isLocal ? <HardDrive size={48} className="mb-4" /> : <Globe size={48} className="mb-4" />}
               <p>Empty Directory</p>
             </div>
          ) : viewMode === 'list' ? (
            <div className="flex flex-col gap-0.5">
               {/* Headers */}
               <div className="grid grid-cols-[30px_minmax(0,1fr)_80px_120px] lg:grid-cols-[30px_minmax(0,1fr)_100px_140px] gap-4 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 sticky top-0 bg-transparent backdrop-blur-md z-10 rounded">
                 <div className="w-5"></div>
                 <div>Name</div>
                 <div className="text-right">Size</div>
                 <div className="text-right">Modified</div>
               </div>
               
               {sortedFiles.map(file => {
                 const isSel = selected.includes(file.name);
                 return (
                   <motion.div 
                     initial={{ opacity: 0, y: 5 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0 }}
                     transition={{ duration: 0.15 }}
                     key={file.name}
                     onClick={(e) => toggleSelection(file.name, e.metaKey || e.ctrlKey || e.shiftKey)}
                     onDoubleClick={() => file.type === 'dir' ? navigateTo(file.name) : null}
                     onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, file.name); }}
                     className={cn(
                       "grid grid-cols-[30px_minmax(0,1fr)_80px_120px] lg:grid-cols-[30px_minmax(0,1fr)_100px_140px] gap-4 px-3 py-2.5 rounded-lg items-center cursor-pointer transition-all border border-transparent select-none group",
                       isSel ? "bg-cyan-500/20 border-cyan-500/30 text-white" : "hover:bg-white/5 text-[#E0E0E6] hover:text-white"
                     )}
                   >
                     <div className="w-5 text-gray-400 group-hover:text-current transition-colors">
                       {file.type === 'dir' ? <Folder size={18} className={isSel ? "text-cyan-400 fill-cyan-400" : "fill-gray-500/50"} /> : <FileIcon size={18} />}
                     </div>
                     <div className="truncate font-medium">{file.name}</div>
                     <div className="text-right text-xs opacity-70 font-mono">
                       {file.type === 'dir' ? '--' : formatBytes(file.size, 0)}
                     </div>
                     <div className="text-right text-xs opacity-70">
                       {format(new Date(file.modifyTime), 'MMM dd, yyyy')}
                     </div>
                   </motion.div>
                 )
               })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-2 items-start">
               {sortedFiles.map(file => {
                 const isSel = selected.includes(file.name);
                 return (
                    <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     transition={{ duration: 0.15 }}
                     key={file.name}
                     onClick={(e) => toggleSelection(file.name, e.metaKey || e.ctrlKey || e.shiftKey)}
                     onDoubleClick={() => file.type === 'dir' ? navigateTo(file.name) : null}
                     onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, file.name); }}
                     className={cn(
                       "flex flex-col items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none group h-full",
                       isSel 
                         ? "bg-cyan-500/10 border-cyan-500/30 shadow-xl shadow-cyan-900/20" 
                         : "bg-transparent border-transparent hover:bg-white/5"
                     )}
                   >
                     <div className={cn(
                       "w-20 h-20 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0",
                       file.type === 'dir' ? (isSel ? "bg-amber-500/20 text-amber-400" : "bg-amber-400/10 text-amber-400/80 group-hover:text-amber-400") : 
                                             (isSel ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-cyan-500/10")
                     )}>
                       {file.type === 'dir' ? <Folder size={42} className="fill-current opacity-80" /> : <FileIcon size={38} />}
                     </div>
                     <span className={cn("text-xs font-medium text-center break-all max-w-full leading-relaxed", isSel ? "text-white" : "text-[#E0E0E6]/70 group-hover:text-white")}>
                       {file.name}
                     </span>
                   </motion.div>
                 )
               })}
            </div>
          )}
       </div>

       {contextMenu && (
         <ContextMenu 
           pos={contextMenu.pos} 
           isLocal={isLocal} 
           target={contextMenu.target} 
           onClose={() => setContextMenu(null)} 
         />
       )}

       {isDragging && (
         <div className="absolute inset-0 z-40 bg-cyan-500/10 border-2 border-cyan-500/50 border-dashed m-4 rounded-2xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-4 bg-black/60 px-8 py-6 rounded-2xl border border-cyan-500/30">
               <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Upload size={32} className="text-cyan-400" />
               </div>
               <h3 className="text-xl font-bold text-white">Drop to Upload</h3>
               <p className="text-cyan-200">Release files here to upload to {path}</p>
            </div>
         </div>
       )}
    </div>
  )
}

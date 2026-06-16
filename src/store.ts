import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Protocol = 'ftp' | 'sftp' | 'ftps';

export interface ConnectionConfig {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  lastConnected?: string;
  favorite?: boolean;
  color?: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'dir';
  size: number;
  modifyTime: string;
  permissions: string;
  owner: string;
  group: string;
}

export interface Transfer {
  id: string;
  filename: string;
  type: 'upload' | 'download';
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  progress: number;
  speed: number;
  totalSize: number;
  transferredSize: number;
  timeRemaining?: number;
}

interface AppState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  isConnected: boolean;
  
  localPath: string;
  remotePath: string;
  
  localFiles: FileItem[];
  remoteFiles: FileItem[];
  
  selectedLocalFiles: string[];
  selectedRemoteFiles: string[];
  
  splitViewRatio: number;
  
  isSidebarOpen: boolean;
  
  transfers: Transfer[];
  
  theme: 'dark' | 'light' | 'system';
  
  // Actions
  addConnection: (conn: ConnectionConfig) => void;
  updateConnection: (id: string, partial: Partial<ConnectionConfig>) => void;
  deleteConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  
  setLocalPath: (path: string) => void;
  setRemotePath: (path: string) => void;
  
  setLocalFiles: (files: FileItem[]) => void;
  setRemoteFiles: (files: FileItem[]) => void;
  
  toggleLocalFileSelection: (id: string, multiple?: boolean) => void;
  toggleRemoteFileSelection: (id: string, multiple?: boolean) => void;
  clearSelection: () => void;
  
  toggleSidebar: () => void;
  
  setSplitViewRatio: (ratio: number) => void;
  
  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (id: string, partial: Partial<Transfer>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      isConnected: false,
      
      localPath: '/',
      remotePath: '/',
      
      localFiles: [],
      remoteFiles: [],
      
      selectedLocalFiles: [],
      selectedRemoteFiles: [],
      
      isSidebarOpen: true,
      
      splitViewRatio: 50,
      
      transfers: [],
      
      theme: 'dark',
      
      addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
      updateConnection: (id, partial) => set((state) => ({
        connections: state.connections.map(c => c.id === id ? { ...c, ...partial } : c)
      })),
      deleteConnection: (id) => set((state) => ({ connections: state.connections.filter(c => c.id !== id) })),
      setActiveConnection: (id) => set({ activeConnectionId: id }),
      setIsConnected: (isConnected) => set({ isConnected }),
      
      setLocalPath: (path) => set({ localPath: path, selectedLocalFiles: [] }),
      setRemotePath: (path) => set({ remotePath: path, selectedRemoteFiles: [] }),
      
      setLocalFiles: (files) => set({ localFiles: files }),
      setRemoteFiles: (files) => set({ remoteFiles: files }),
      
      toggleLocalFileSelection: (id, multiple) => set((state) => {
         if (multiple) {
            return { selectedLocalFiles: state.selectedLocalFiles.includes(id) 
              ? state.selectedLocalFiles.filter(fid => fid !== id) 
              : [...state.selectedLocalFiles, id] };
         }
         return { selectedLocalFiles: [id] };
      }),
      toggleRemoteFileSelection: (id, multiple) => set((state) => {
         if (multiple) {
            return { selectedRemoteFiles: state.selectedRemoteFiles.includes(id) 
              ? state.selectedRemoteFiles.filter(fid => fid !== id) 
              : [...state.selectedRemoteFiles, id] };
         }
         return { selectedRemoteFiles: [id] };
      }),
      clearSelection: () => set({ selectedLocalFiles: [], selectedRemoteFiles: [] }),
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      setSplitViewRatio: (ratio) => set({ splitViewRatio: ratio }),
      
      addTransfer: (transfer) => set((state) => ({ transfers: [...state.transfers, transfer] })),
      updateTransfer: (id, partial) => set((state) => ({
        transfers: state.transfers.map(t => t.id === id ? { ...t, ...partial } : t)
      })),
    }),
    {
      name: 'nexus-ftp-storage',
      partialize: (state) => ({
        connections: state.connections,
        theme: state.theme,
        splitViewRatio: state.splitViewRatio
      }),
    }
  )
);

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { apiClient } from '../../lib/api';
import { useStore } from '../../store';
import TerminalSession from './TerminalSession';
import TerminalTabs from './TerminalTabs';
import TerminalToolbar from './TerminalToolbar';

interface TerminalPanelProps {
  connectionId: string;
  onClose: () => void;
}

interface Tab {
  id: string;
  name: string;
}

export default function TerminalPanel({ connectionId, onClose }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const addNotification = useStore((s) => s.addNotification);

  const createTab = useCallback(async () => {
    try {
      const data = await apiClient.post<{ success: boolean; sessionId: string }>('/terminal/session', { connectionId });
      if (data.success) {
        const newTab = { id: data.sessionId, name: `Terminal ${tabs.length + 1}` };
        setTabs((prev) => [...prev, newTab]);
        setActiveTab(data.sessionId);
      }
    } catch (err: any) {
      addNotification({ type: 'error', message: err.message || 'Failed to create terminal session' });
    }
  }, [connectionId, tabs.length, addNotification]);

  const closeTab = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/terminal/session/${id}`);
    } catch {
      // ignore
    }
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTab((prev) => (prev === id ? (tabs.find((t) => t.id !== id)?.id || null) : prev));
  }, [tabs]);

  useEffect(() => {
    createTab();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`flex flex-col bg-[#0d1117] border-t border-gray-700 ${
        isMaximized ? 'fixed inset-0 z-50' : 'h-72'
      }`}
    >
      <TerminalToolbar
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized(!isMaximized)}
        onClose={onClose}
        sessionCount={tabs.length}
      />
      <TerminalTabs
        sessions={tabs}
        activeSession={activeTab}
        onSelect={setActiveTab}
        onClose={closeTab}
        onNew={createTab}
      />
      <div className="flex-1 relative min-h-0">
        {tabs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Starting terminal session...
          </div>
        ) : (
          tabs.map((tab) => (
            <div key={tab.id} className="absolute inset-0" style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
              <TerminalSession sessionId={tab.id} isActive={activeTab === tab.id} />
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

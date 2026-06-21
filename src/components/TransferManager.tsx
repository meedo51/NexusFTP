import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Upload, CheckCircle, AlertCircle, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { useStore, Transfer } from '../store';
import { formatBytes, cn } from '../lib/utils';

export default function TransferManager() {
  const { transfers } = useStore();
  const activeTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'transferring');
  const completedTransfers = transfers.filter(t => t.status === 'completed' || t.status === 'failed');

  if (transfers.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 z-[9999] flex flex-col gap-2">
      <AnimatePresence>
        {activeTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-[#111116] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="px-4 py-2.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Transfers</span>
              <span className="text-xs text-gray-400">{activeTransfers.length} active</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {activeTransfers.map(t => (
                <TransferItem key={t.id} transfer={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TransferItem({ transfer }: { key?: string; transfer: Transfer }) {
  const Icon = transfer.type === 'upload' ? Upload : Download;

  return (
    <div className="px-4 py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className={cn(
            transfer.type === 'upload' ? 'text-cyan-400' : 'text-purple-400'
          )} />
          <span className="text-sm text-gray-200 truncate">{transfer.filename}</span>
        </div>
        <span className="text-xs text-gray-500 shrink-0">
          {transfer.status === 'transferring' ? `${transfer.progress}%` : transfer.status}
        </span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${transfer.progress}%` }}
          className={cn(
            "h-full rounded-full transition-all",
            transfer.status === 'completed' ? 'bg-green-500' :
            transfer.status === 'failed' ? 'bg-red-500' :
            transfer.type === 'upload' ? 'bg-cyan-500' : 'bg-purple-500'
          )}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-500">
          {formatBytes(transfer.transferredSize)} / {formatBytes(transfer.totalSize)}
        </span>
        {transfer.speed > 0 && (
          <span className="text-[10px] text-gray-500">{formatBytes(transfer.speed)}/s</span>
        )}
      </div>
    </div>
  );
}

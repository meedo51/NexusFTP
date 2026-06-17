import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useStore, Notification } from '../store';
import { cn } from '../lib/utils';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-green-500/10 border-green-500/30 text-green-400',
  error: 'bg-red-500/10 border-red-500/30 text-red-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
};

export default function NotificationToast() {
  const { notifications, removeNotification } = useStore();

  return (
    <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {notifications.map(n => (
          <NotificationItem key={n.id} notification={n} onDismiss={removeNotification} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({ notification, onDismiss }: { key?: string; notification: Notification; onDismiss: (id: string) => void }) {
  const Icon = icons[notification.type];

  useEffect(() => {
    const timeout = setTimeout(() => {
      onDismiss(notification.id);
    }, notification.timeout || 4000);
    return () => clearTimeout(timeout);
  }, [notification.id, notification.timeout, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl",
        colors[notification.type]
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{notification.message}</p>
      <button onClick={() => onDismiss(notification.id)} className="opacity-50 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </motion.div>
  );
}

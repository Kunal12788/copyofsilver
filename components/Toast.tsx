
import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'ERROR';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; removeToast: (id: string) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const isSuccess = toast.type === 'SUCCESS';

  return (
    <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-[slideIn_0.3s_ease-out] backdrop-blur-md ${
        isSuccess 
        ? 'bg-slate-900/95 border-green-500/30 text-green-400 shadow-[0_4px_20px_rgba(34,197,94,0.15)]' 
        : 'bg-slate-900/95 border-red-500/30 text-red-400 shadow-[0_4px_20px_rgba(239,68,68,0.15)]'
    }`}>
        {isSuccess ? <CheckCircle className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
        <span className="text-sm font-medium text-slate-200">{toast.message}</span>
    </div>
  );
};

export default Toast;

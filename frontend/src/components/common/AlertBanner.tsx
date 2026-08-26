import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface AlertBannerProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'info',
  title,
  message,
  className = '',
  onClose,
}) => {
  const configs = {
    info: {
      icon: Info,
      bg: 'bg-stone-100/90 border-stone-200 text-stone-800',
      iconColor: 'text-teal-700',
    },
    success: {
      icon: CheckCircle2,
      bg: 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950',
      iconColor: 'text-emerald-700',
    },
    warning: {
      icon: AlertCircle,
      bg: 'bg-amber-50/80 border-amber-200/80 text-amber-950',
      iconColor: 'text-amber-700',
    },
    error: {
      icon: XCircle,
      bg: 'bg-red-50/80 border-red-200/80 text-red-900',
      iconColor: 'text-red-700',
    },
  };

  const current = configs[type];
  const Icon = current.icon;

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm ${current.bg} ${className}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${current.iconColor}`} />
      <div className="flex-1">
        {title && <div className="font-semibold text-xs text-stone-900">{title}</div>}
        <div className="text-xs leading-relaxed mt-0.5 text-stone-700">{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-xs font-semibold text-stone-400 hover:text-stone-700 p-0.5"
        >
          ×
        </button>
      )}
    </div>
  );
};

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-stone-500 gap-2 ${className}`}>
      <Loader2 className={`${sizeMap[size]} animate-spin text-teal-700`} />
      {label && <span className="text-xs font-medium text-stone-600">{label}</span>}
    </div>
  );
};

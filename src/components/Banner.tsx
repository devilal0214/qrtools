import { useState, useEffect } from 'react';

interface BannerProps {
  type?: 'info' | 'warning' | 'success' | 'error';
  message: string;
  showIcon?: boolean;
  dismissible?: boolean;
  className?: string;
}

export default function Banner({ 
  type = 'info', 
  message, 
  showIcon = true, 
  dismissible = true,
  className = ''
}: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const colors = {
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    success: 'bg-green-50 text-green-700 border-green-100',
    error: 'bg-red-50 text-red-700 border-red-100'
  };

  const icons = {
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  if (!isVisible) return null;

  return (
    <div className={`border rounded-lg p-4 ${colors[type]} ${className}`}>
      <div className="flex items-start gap-3">
        {showIcon && icons[type]}
        <div className="flex-1">{message}</div>
        {dismissible && (
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:opacity-70"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[1.5rem] h-6 px-1.5',
        'text-xs font-medium',
        'bg-muted border border-border rounded-md',
        'shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

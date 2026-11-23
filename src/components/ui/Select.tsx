import * as React from 'react';
import { cn } from '../../lib/utils';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-md border border-[#C9D9DC] bg-white px-3.5 py-2 text-sm text-[#24343B] transition-colors focus-visible:outline-none focus-visible:border-[#0D4A5A] focus-visible:ring-2 focus-visible:ring-[#0D4A5A]/20 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

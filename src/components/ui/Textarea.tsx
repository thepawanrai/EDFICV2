import * as React from 'react';
import { cn } from '../../lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[88px] w-full rounded-md border border-[#C9D9DC] bg-white px-3.5 py-2.5 text-sm text-[#24343B] placeholder:text-[#65747B]/70 transition-colors focus-visible:outline-none focus-visible:border-[#0D4A5A] focus-visible:ring-2 focus-visible:ring-[#0D4A5A]/20 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

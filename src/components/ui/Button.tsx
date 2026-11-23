import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#0D4A5A] text-white hover:bg-[#083642]',
        secondary: 'bg-[#E9F3F3] text-[#0D4A5A] hover:bg-[#d7e9ea]',
        outline:
          'border border-[#C9D9DC] bg-white text-[#24343B] hover:bg-[#F8FAFA] hover:border-[#287887]',
        ghost: 'text-[#24343B] hover:bg-[#E9F3F3]/60',
        destructive: 'bg-[#B42318] text-white hover:bg-[#912018]',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-11 px-6 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = 'Button';

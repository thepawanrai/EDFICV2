import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  variant?: 'compact' | 'circle' | 'drawer';
  className?: string;
}

export function ThemeToggle({ variant = 'compact', className }: ThemeToggleProps) {
  const { isDarkTeal, toggleTheme } = useTheme();

  if (variant === 'circle') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDarkTeal}
        aria-label={isDarkTeal ? 'Switch to Light mode' : 'Switch to Dark Teal mode'}
        title={isDarkTeal ? 'Switch to Light mode' : 'Switch to Dark Teal mode'}
        onClick={toggleTheme}
        className={cn(
          'group relative flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isDarkTeal
            ? 'border-[#2E7A8D] bg-[#092D38] text-[#6FD3E3] hover:bg-[#136174] hover:text-white hover:border-[#6FD3E3] focus-visible:ring-[#6FD3E3] focus-visible:ring-offset-[#052028]'
            : 'border-[#DCE7E9] bg-white text-[#0D4A5A] hover:bg-[#083642] hover:text-white hover:border-[#083642] focus-visible:ring-[#0D4A5A] focus-visible:ring-offset-white',
          className
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-14 whitespace-nowrap rounded-full bg-[#083642] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 dark-teal:border dark-teal:border-[#2E7A8D] dark-teal:bg-[#092D38] dark-teal:text-[#F0F9FA]"
        >
          {isDarkTeal ? 'Light Mode' : 'Dark Teal Mode'}
        </span>
        {isDarkTeal ? (
          <Sun className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    );
  }

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDarkTeal}
        aria-label={isDarkTeal ? 'Switch to Light mode' : 'Switch to Dark Teal mode'}
        onClick={toggleTheme}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A] focus-visible:ring-offset-2',
          isDarkTeal
            ? 'border-[#1F6173] bg-[#0E3C4A] text-[#F0F9FA] hover:bg-[#134B5C] focus-visible:ring-[#6FD3E3] focus-visible:ring-offset-[#092D38]'
            : 'border-[#DCE7E9] bg-[#F8FAFA] text-[#24343B] hover:bg-[#E9F3F3] focus-visible:ring-offset-white',
          className
        )}
      >
        <span className="flex items-center gap-2.5">
          {isDarkTeal ? (
            <Moon className="h-4 w-4 text-[#6FD3E3]" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4 text-[#0D4A5A]" aria-hidden="true" />
          )}
          <span>Theme: {isDarkTeal ? 'Dark Teal' : 'Light'}</span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
            isDarkTeal
              ? 'border-[#6FD3E3]/60 bg-[#1B6678]'
              : 'border-[#C9D9DC] bg-[#DCE7E9]'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full transition-transform duration-200',
              isDarkTeal
                ? 'translate-x-5.5 bg-[#F0F9FA]'
                : 'translate-x-1 bg-[#0D4A5A]'
            )}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDarkTeal}
      aria-label={isDarkTeal ? 'Switch to Light mode' : 'Switch to Dark Teal mode'}
      title={isDarkTeal ? 'Dark Teal mode active - Switch to Light mode' : 'Light mode active - Switch to Dark Teal mode'}
      onClick={toggleTheme}
      className={cn(
        'edfic-theme-toggle inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isDarkTeal
          ? 'border-[#2E7A8D] bg-[#0E3C4A] text-[#F0F9FA] hover:bg-[#155264] hover:border-[#6FD3E3]/70 focus-visible:ring-[#6FD3E3] focus-visible:ring-offset-[#092D38]'
          : 'border-[#C9D9DC] bg-[#F8FAFA] text-[#083642] hover:bg-[#E9F3F3] hover:border-[#287887] focus-visible:ring-[#0D4A5A] focus-visible:ring-offset-white',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
          isDarkTeal ? 'bg-[#082A34] text-[#6FD3E3]' : 'bg-[#E9F3F3] text-[#0D4A5A]'
        )}
      >
        {isDarkTeal ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
      <span className="hidden xl:inline">{isDarkTeal ? 'Dark Teal' : 'Light'}</span>
      <span className="sr-only">{isDarkTeal ? 'Dark Teal mode' : 'Light mode'}</span>
    </button>
  );
}

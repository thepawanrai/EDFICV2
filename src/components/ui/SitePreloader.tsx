import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

export function SitePreloader() {
  const { isDarkTeal } = useTheme();
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const minDisplayMs = prefersReducedMotion ? 160 : 3000;
    const fadeDurationMs = prefersReducedMotion ? 150 : 380;

    let fadeTimer = 0;
    let unmountTimer = 0;
    const startTime = performance.now();

    const triggerExit = () => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, minDisplayMs - elapsed);

      fadeTimer = window.setTimeout(() => {
        setExiting(true);
        unmountTimer = window.setTimeout(() => {
          setVisible(false);
        }, fadeDurationMs);
      }, remaining);
    };

    if (document.readyState === 'complete') {
      triggerExit();
    } else {
      window.addEventListener('load', triggerExit, { once: true });
      const safetyTimer = window.setTimeout(triggerExit, 3500);
      return () => {
        window.removeEventListener('load', triggerExit);
        window.clearTimeout(safetyTimer);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(unmountTimer);
      };
    }

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-[380ms] ease-out ${
        exiting ? 'pointer-events-none opacity-0 scale-[1.02]' : 'opacity-100 scale-100'
      } ${
        isDarkTeal
          ? 'bg-[radial-gradient(circle_at_50%_50%,#0D4A5A_0%,#052028_72%)]'
          : 'bg-[radial-gradient(circle_at_50%_50%,#FFFFFF_0%,#E9F4F7_72%,#DCEEF3_100%)]'
      }`}
    >
      {/* Pure Borderless Concentric Pulsing UI Animation */}
      <div className="relative flex h-36 w-36 items-center justify-center">
        <span
          aria-hidden="true"
          className={`edfic-preloader-ring absolute inset-0 rounded-full ${
            isDarkTeal ? 'bg-[#7CE0EF]/22' : 'bg-[#287887]/20'
          }`}
        />
        <span
          aria-hidden="true"
          className={`edfic-preloader-ring edfic-preloader-ring-2 absolute inset-0 rounded-full ${
            isDarkTeal ? 'bg-[#6FD3E3]/24' : 'bg-[#0D4A5A]/18'
          }`}
        />
        <span
          aria-hidden="true"
          className={`edfic-preloader-ring edfic-preloader-ring-3 absolute inset-0 rounded-full ${
            isDarkTeal ? 'bg-[#9BE3F0]/20' : 'bg-[#5CA8BA]/22'
          }`}
        />

        {/* Soft Glowing Core Pulse */}
        <span
          aria-hidden="true"
          className={`edfic-preloader-emblem relative z-10 h-6 w-6 rounded-full ${
            isDarkTeal
              ? 'bg-gradient-to-br from-[#9BE3F0] to-[#287887] shadow-[0_0_32px_rgba(124,224,239,0.55)]'
              : 'bg-gradient-to-br from-[#287887] to-[#0D4A5A] shadow-[0_0_28px_rgba(13,74,90,0.35)]'
          }`}
        />
      </div>
    </div>
  );
}

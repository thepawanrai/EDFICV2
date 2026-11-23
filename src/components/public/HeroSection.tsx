import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';

interface HeroSectionProps {
  clinicFullName?: string;
  parentUnitName?: string;
  doctorName?: string;
  doctorQualification?: string;
  categoriesCount: number;
  servicesCount: number;
}

const ROTATING_SPECIALTIES = [
  'Fetal Care',
  'Color Doppler',
  'Obstetric Scans',
  'Organ Ultrasound',
  'Radiology',
];

interface RippleWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

function OdometerValue({
  target,
  suffix = '',
  reducedMotion,
}: {
  target: number;
  suffix?: string;
  reducedMotion: boolean;
}) {
  const [display, setDisplay] = useState<number>(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const duration = 1150;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth easeOutQuart deceleration curve
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, reducedMotion]);

  return (
    <span className="font-mono-tabular tabular-nums">
      {display}
      {suffix}
    </span>
  );
}

export function HeroSection({
  clinicFullName,
  parentUnitName,
  doctorName,
  doctorQualification,
  categoriesCount,
  servicesCount,
}: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<RippleWave[]>([]);
  const lastMoveSpawnRef = useRef<number>(0);

  const [wordIndex, setWordIndex] = useState(0);
  const [prevWordIndex, setPrevWordIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ProHealth cd-headline slide rotation
  useEffect(() => {
    if (reducedMotion) return;

    const timer = window.setInterval(() => {
      setWordIndex((current) => {
        setPrevWordIndex(current);
        return (current + 1) % ROTATING_SPECIALTIES.length;
      });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  // Clear previous exiting word node after slide-out finishes
  useEffect(() => {
    if (prevWordIndex === null) return;
    const cleanup = window.setTimeout(() => setPrevWordIndex(null), 580);
    return () => window.clearTimeout(cleanup);
  }, [prevWordIndex]);

  // ProHealth cs_ripple_activate interactive acoustic/water ripple layer
  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;

    const resize = () => {
      const rect = section.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const spawnRipple = (x: number, y: number, maxRadius = 175) => {
      if (ripplesRef.current.length >= 3) {
        ripplesRef.current.shift();
      }
      ripplesRef.current.push({
        x,
        y,
        radius: 12,
        maxRadius,
        alpha: 0.18,
        speed: 1.15,
      });
    };

    // Initial calm single circle pulse centered behind hero headline
    spawnRipple(width * 0.5, height * 0.42, 220);

    const ambientInterval = window.setInterval(() => {
      if (width > 0 && height > 0 && ripplesRef.current.length < 2) {
        spawnRipple(
          width * (0.25 + Math.random() * 0.5),
          height * (0.28 + Math.random() * 0.4),
          185
        );
      }
    }, 5200);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const activeRipples: RippleWave[] = [];
      for (const wave of ripplesRef.current) {
        wave.radius += wave.speed;
        const progress = wave.radius / wave.maxRadius;
        const currentAlpha = wave.alpha * (1 - progress);

        if (progress < 1 && currentAlpha > 0.005) {
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(142, 224, 236, ${currentAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.25;
          ctx.stroke();

          activeRipples.push(wave);
        }
      }

      ripplesRef.current = activeRipples;
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.clearInterval(ambientInterval);
      cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reducedMotion || e.pointerType === 'touch') return;
    const now = performance.now();
    if (now - lastMoveSpawnRef.current < 800) return;
    lastMoveSpawnRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (ripplesRef.current.length >= 3) {
      ripplesRef.current.shift();
    }
    ripplesRef.current.push({
      x,
      y,
      radius: 10,
      maxRadius: 150,
      alpha: 0.16,
      speed: 1.25,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (ripplesRef.current.length >= 3) {
      ripplesRef.current.shift();
    }
    ripplesRef.current.push({
      x,
      y,
      radius: 12,
      maxRadius: 200,
      alpha: 0.24,
      speed: 1.5,
    });
  };

  const activeDepartmentCount = categoriesCount > 0 ? categoriesCount : 5;
  const activeProtocolCount = servicesCount > 0 ? servicesCount : 24;

  return (
    <section
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      className="relative overflow-hidden edfic-hero-home5-bg pt-14 sm:pt-20 lg:pt-24 text-white"
    >
      {/* Interactive Water / Acoustic Ripple Canvas Layer */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Ambient Subtle Teal Aura Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-10 h-80 w-80 rounded-full bg-[#7FD3E3]/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Centered Editorial Headline + Actions + Summary */}
        <div className="mx-auto max-w-4xl text-center">
          <p className="edfic-hero-enter text-xs font-semibold uppercase tracking-[0.16em] text-[#9BE3F0]">
            {clinicFullName || 'EWA Diagnostic and Fetal Imaging Centre'} ·{' '}
            {parentUnitName || 'A Unit of EWA DERMA'}
          </p>

          <h1
            className="edfic-hero-enter edfic-hero-delay-1 mt-4 font-display font-extrabold tracking-tight text-white text-balance"
            style={{ fontSize: 'clamp(2.3rem, 4.4vw, 3.85rem)', lineHeight: 1.08 }}
          >
            Precision Diagnostic Imaging for{' '}
            <span className="inline-grid align-bottom overflow-hidden text-[#8EE0EC]">
              {prevWordIndex !== null && (
                <span
                  key={`out-${prevWordIndex}`}
                  aria-hidden="true"
                  className="col-start-1 row-start-1 whitespace-nowrap edfic-word-out"
                >
                  {ROTATING_SPECIALTIES[prevWordIndex]}
                </span>
              )}
              <span
                key={`in-${wordIndex}`}
                className="col-start-1 row-start-1 whitespace-nowrap edfic-word-in"
              >
                {ROTATING_SPECIALTIES[wordIndex]}
              </span>
            </span>
          </h1>

          <p className="edfic-hero-enter edfic-hero-delay-2 mx-auto mt-6 max-w-2xl text-sm sm:text-base leading-relaxed text-[#E4F2F5]">
            Dedicated fetal medicine, Color Doppler evaluation, and organ ultrasound at Sushant Golf City near Lulu Mall, Lucknow - led by specialist radiologist oversight with strict PCPNDT compliance.
          </p>

          <div className="edfic-hero-enter edfic-hero-delay-3 mt-8 flex flex-wrap items-center justify-center gap-6">
            <span className="relative inline-flex edfic-cta-pulse">
              <span
                aria-hidden="true"
                className="edfic-cta-pulse-ring pointer-events-none absolute inset-0 rounded-full border-2 border-[#8EE0EC]/75 bg-[#8EE0EC]/15"
              />
              <Link
                to="/book"
                className="edfic-btn-slide relative inline-flex h-12 items-center justify-center gap-2.5 rounded-full border border-white/35 px-7 text-sm font-semibold text-white shadow-[0_14px_32px_-10px_rgba(4,24,30,0.65)] whitespace-nowrap"
              >
                <span className="relative z-10">Book Appointment</span>
                <span className="edfic-btn-arrows" aria-hidden="true">
                  <ArrowRight className="h-4 w-4" />
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </span>

            <a
              href="#visit-journey"
              className="edfic-link-elastic inline-flex items-center gap-3 text-sm font-semibold text-white/95 hover:text-[#9BE3F0] whitespace-nowrap"
            >
              <span className="edfic-link-icon flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white">
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              </span>
              <span className="edfic-link-text">See how we work</span>
            </a>
          </div>
        </div>

        {/* Flush Bottom Frosted 4-Column Odometer Metric Bar (ProHealth Home-5 Signature) */}
        <div className="edfic-hero-enter edfic-hero-delay-4 relative z-20 mt-12 sm:mt-14 lg:mt-16">
          <div className="mx-auto max-w-5xl rounded-t-[24px] border border-b-0 border-white/30 bg-[#083642]/80 px-6 py-7 backdrop-blur-xl sm:px-10 sm:py-8 shadow-[0_-12px_40px_-14px_rgba(4,24,30,0.45)]">
            <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4 md:gap-8">
              <div>
                <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  <OdometerValue
                    target={activeDepartmentCount}
                    suffix="+"
                    reducedMotion={reducedMotion}
                  />
                </p>
                <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#CBE7EE]">
                  Imaging Departments
                </p>
              </div>

              <div>
                <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  <OdometerValue
                    target={activeProtocolCount}
                    suffix="+"
                    reducedMotion={reducedMotion}
                  />
                </p>
                <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#CBE7EE]">
                  Diagnostic Protocols
                </p>
              </div>

              <div>
                <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  <OdometerValue
                    target={100}
                    suffix="%"
                    reducedMotion={reducedMotion}
                  />
                </p>
                <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#CBE7EE]">
                  PCPNDT &amp; Sterile Care
                </p>
              </div>

              <div>
                <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  <OdometerValue
                    target={6}
                    suffix=" Days"
                    reducedMotion={reducedMotion}
                  />
                </p>
                <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#CBE7EE]">
                  Mon - Sat Clinical Schedule
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

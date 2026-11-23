import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Baby,
  Calendar,
  FileCheck2,
  HeartPulse,
  Lock,
  MapPin,
  Microscope,
  Radio,
  Scan,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { FaqAccordionSection } from '../../components/public/FaqAccordionSection';
import { HeroSection } from '../../components/public/HeroSection';
import { TestimonialsSection } from '../../components/public/TestimonialsSection';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { usePublicClinic, usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

const quickInquirySchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.'),
  phone: z.string().min(10, 'Enter a valid 10-digit mobile number.').max(15),
  email: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
  interestedService: z.string().optional(),
  reasonType: z.enum(['Diagnostic Ultrasound', 'Fetal Medicine Scan', 'Preparation Question']),
  message: z.string().min(5, 'Share a short note about your required scan or question.'),
});

type QuickInquiryValues = z.infer<typeof quickInquirySchema>;

interface JourneyStep {
  id: string;
  stepNumber: string;
  title: string;
  subtitle: string;
  heading: string;
  description: string;
  highlights: string[];
  ctaLabel: string;
  ctaTo: string;
}

const VISIT_JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'select-scan',
    stepNumber: '01',
    title: 'Select Scan & Prep',
    subtitle: 'Catalogue & fasting/hydration guidance',
    heading: 'Review Prescribed Scan Protocols Before Booking',
    description:
      'Browse EDFIC’s obstetric fetal imaging, Color Doppler, and general ultrasound catalogue to verify clinical preparation - such as fasting for abdominal studies or full-bladder hydration for pelvic and KUB scans.',
    highlights: [
      'Structured protocols organized across approved imaging departments',
      'Clear pre-visit hydration, fasting, and document checklists',
      'Morning session alignment for specialist fetal medicine procedures',
    ],
    ctaLabel: 'Browse Diagnostic Catalogue',
    ctaTo: '/services',
  },
  {
    id: 'slot-upi',
    stepNumber: '02',
    title: 'Slot & UPI Advance',
    subtitle: 'Real-time calendar & UTR reference',
    heading: 'Automated Slot Lock With Manual Verification',
    description:
      'Pick a live slot synchronized with clinic working hours, Sunday schedule, and holidays. Complete the configured UPI advance and submit your UTR reference for verification by EDFIC reception.',
    highlights: [
      'Real-time slot capacity with temporary reservation protection',
      'Instant unique EDFIC booking reference generated on submission',
      'Transparent balance tracking reconciled manually by reception',
    ],
    ctaLabel: 'Book Appointment Slot',
    ctaTo: '/book',
  },
  {
    id: 'checkin-pcpndt',
    stepNumber: '03',
    title: 'Check-In & PCPNDT',
    subtitle: 'Prescription, photo ID & Form F',
    heading: 'Dignified Arrival & Strict Statutory Compliance',
    description:
      'Arrive 15 minutes before your confirmed slot at Unit 10, Millennium Place, Sushant Golf City. Carry your clinician prescription, prior scans, and valid government photo ID required under statutory PCPNDT rules.',
    highlights: [
      'Mandatory statutory Form F completion for all obstetric scans',
      'Single-use sterile covers and medical-grade probe disinfection',
      'Strict prohibition against prenatal sex determination inquiries',
    ],
    ctaLabel: 'View Preparation Checklist',
    ctaTo: '/patient-info',
  },
  {
    id: 'portal-report',
    stepNumber: '04',
    title: 'Portal PDF Report',
    subtitle: 'Private authenticated report download',
    heading: 'Secure Diagnostic Reports Without Public Exposure',
    description:
      'Once finalized and reviewed by Dr. Varun Agrawal, your diagnostic PDF is published strictly inside your authenticated EDFIC Patient Portal account - never dispatched over unsecured public links.',
    highlights: [
      'Private sign-in access using your registered Patient ID',
      'Unified appointment history, receipts, and verified PDF reports',
      'Confidential portal alerts instead of unencrypted message files',
    ],
    ctaLabel: 'Open Patient Portal',
    ctaTo: '/portal',
  },
];

const CORE_VALUES = [
  {
    icon: HeartPulse,
    title: 'Specialist Care',
    description:
      'Every obstetric and diagnostic examination is conducted with clinical attentiveness, unhurried patient communication, and DNB Radiology specialist oversight.',
  },
  {
    icon: Scan,
    title: 'Clinical Precision',
    description:
      'Standardized fetal biometry, Color Doppler waveforms, and structured reporting protocols support clear clinical correlation for your referring physician.',
  },
  {
    icon: ShieldCheck,
    title: 'Statutory Integrity',
    description:
      'Full adherence to PCPNDT Act guidelines, transparent Form F documentation, ethical medical conduct, and zero promotional diagnostic claims.',
  },
  {
    icon: Lock,
    title: 'Hygiene & Privacy',
    description:
      'Single-use sterile transducer covers, medical-grade probe disinfection between examinations, and private authenticated Patient Portal report delivery.',
  },
  {
    icon: Calendar,
    title: 'Scheduled Flow',
    description:
      'Appointment-led scheduling with real-time slot capacity and morning fetal specialist sessions minimizes waiting at our Sushant Golf City centre.',
  },
];

const DEPARTMENT_ICONS = [Baby, HeartPulse, Activity, Scan, Microscope];

export function HomePage() {
  const { data: clinicData } = usePublicClinic();
  const { data: servicesData, isLoading: servicesLoading } = usePublicServices();

  const [activeJourneyId, setActiveJourneyId] = useState<string>(VISIT_JOURNEY_STEPS[1].id);
  const [submittedLeadCode, setSubmittedLeadCode] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const clinic = clinicData?.clinic;
  const doctor = clinicData?.doctor;
  const categories = servicesData?.categories ?? [];
  const featuredCategories = categories.slice(0, 5);
  const allServices = categories.flatMap((cat) => cat.services);

  const activeJourney =
    VISIT_JOURNEY_STEPS.find((item) => item.id === activeJourneyId) ?? VISIT_JOURNEY_STEPS[0];

  // Scroll-Reveal IntersectionObserver + Parallax Offset Loop
  useEffect(() => {
    const rootEl = pageRef.current;
    if (!rootEl) return;

    const markRevealed = (el: Element) => {
      el.setAttribute('data-revealed', 'true');
      el.classList.add('edfic-revealed');
    };

    const revealNodes = Array.from(rootEl.querySelectorAll('.edfic-reveal'));
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight + 80) {
              markRevealed(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.02, rootMargin: '40px 0px 80px 0px' },
      );

      revealNodes.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 80) {
          markRevealed(el);
        } else {
          observer.observe(el);
        }
      });

      let rafId = 0;
      const updateParallax = () => {
        const y = window.scrollY;
        setScrollProgress(Math.min(Math.max(y / 18, 0), 42));
      };
      const onScroll = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateParallax);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', onScroll);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    revealNodes.forEach((el) => markRevealed(el));
    return undefined;
  }, [categories.length]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickInquiryValues>({
    resolver: zodResolver(quickInquirySchema),
    defaultValues: {
      reasonType: 'Diagnostic Ultrasound',
    },
  });

  const onQuickInquirySubmit = async (values: QuickInquiryValues) => {
    setInquiryError(null);
    try {
      const res = await apiFetch<{ leadCode: string }>('/api/v1/public/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          fullName: values.fullName,
          phone: values.phone,
          email: values.email,
          interestedService: values.interestedService || values.reasonType,
          message: `[${values.reasonType}] ${values.message}`,
        }),
      });
      setSubmittedLeadCode(res.leadCode);
      reset({ reasonType: 'Diagnostic Ultrasound' });
    } catch (err: unknown) {
      setInquiryError(err instanceof Error ? err.message : 'Unable to send inquiry right now.');
    }
  };

  return (
    <PublicLayout>
      <SeoHead
        title="EDFIC - EWA Diagnostic & Fetal Imaging Centre | Lucknow"
        description="Advanced Fetal Imaging & Diagnostic Services in Lucknow. A Unit of EWA DERMA at Sushant Golf City near Lulu Mall. Specialist obstetric, Doppler, and general ultrasound."
        canonicalPath="/"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinic?.primaryPhone,
          officialEmail: clinic?.officialEmail,
        })}
      />

      <div ref={pageRef} className="bg-white">
        {/* 1. ProHealth Home-5 Inspired Deep-Teal Ripple & Rotating Specialty Hero */}
        <HeroSection
          clinicFullName={clinic?.fullName}
          parentUnitName={clinic?.parentUnitName}
          doctorName={doctor?.name}
          doctorQualification={doctor?.qualification}
          categoriesCount={categories.length}
          servicesCount={allServices.length}
        />

        {/* 2. "Our Standards" (3 + 2 Centered Elevated Cards with ProHealth Expanding Halo Hover) */}
        <section className="bg-white mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="edfic-reveal text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
              Our Standards
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-6">
            {CORE_VALUES.map((item, idx) => {
              const Icon = item.icon;
              const placementClass =
                idx === 3
                  ? 'md:col-span-2 md:col-start-2'
                  : idx === 4
                  ? 'md:col-span-2 md:col-start-4'
                  : 'md:col-span-2';

              return (
                <div
                  key={item.title}
                  style={{ transitionDelay: `${idx * 75}ms` }}
                  className={`${placementClass} edfic-reveal edfic-card-interactive edfic-value-card rounded-2xl border border-[#EEF4F6] bg-white p-8 text-center hover:border-[#C9E2E8] edfic-card-soft`}
                >
                  <div className="edfic-value-head inline-flex items-center justify-center gap-3">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#287887] text-white transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="relative z-10 font-display text-xl font-bold text-[#083642]">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-[#65747B]">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Split About EDFIC Section with Rotating Quality Seal & Parallax Frame */}
        <section className="relative overflow-hidden bg-white py-14 sm:py-20">
          <div
            aria-hidden="true"
            className="edfic-particle-drift pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-[#E6F4F7] blur-3xl opacity-80"
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              {/* Left Overlapping Multi-Frame Visual + Continuously Rotating Quality Stamp (.cs_rotate_animation) */}
              <div className="edfic-reveal relative lg:col-span-6">
                <div className="relative mx-auto max-w-md sm:max-w-lg pb-10">
                  {/* Rotating Circular Quality Stamp at Top Right */}
                  <div className="absolute right-1 -top-5 z-20 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-lg">
                    <svg
                      viewBox="0 0 120 120"
                      className="edfic-rotate-slow h-full w-full text-[#287887]"
                      aria-hidden="true"
                    >
                      <defs>
                        <path
                          id="sealRingPath"
                          d="M 60, 60 m -43, 0 a 43,43 0 1,1 86,0 a 43,43 0 1,1 -86,0"
                        />
                      </defs>
                      <text className="fill-current text-[9.2px] font-bold uppercase tracking-[0.2em]">
                        <textPath href="#sealRingPath" textLength="256" lengthAdjust="spacing">
                          Ewa Diagnostic &amp; Fetal Imaging Centre
                        </textPath>
                      </text>
                    </svg>
                    <div className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-[#E9F3F3] text-[#0D4A5A]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Primary Back Rounded Card */}
                  <div className="rounded-[2rem] border border-[#E3EFF2] bg-gradient-to-br from-[#F4FAFC] to-[#E3F1F5] p-7 sm:p-9 edfic-card-soft">
                    <div className="flex items-center justify-between border-b border-[#D2E6EC] pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#287887]">
                          Lucknow Imaging Wing
                        </p>
                        <p className="mt-1 font-display text-lg font-bold text-[#083642]">
                          EDFIC Clinical Suite
                        </p>
                      </div>
                      <Radio className="h-6 w-6 text-[#0D4A5A]" />
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-[#455A64]">
                      <div className="rounded-xl bg-white/95 p-4 border border-white transition-transform duration-300 hover:-translate-y-0.5">
                        <p className="font-display font-bold text-[#083642]">
                          Fetal Medicine &amp; Trimester Screening
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#65747B]">
                          NT Scan, Level-II Anomaly, Growth Scan, Fetal Echocardiography &amp; Biophysical Profile.
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/95 p-4 border border-white transition-transform duration-300 hover:-translate-y-0.5">
                        <p className="font-display font-bold text-[#083642]">
                          General Ultrasound &amp; Color Doppler
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#65747B]">
                          Abdomen, KUB, Small Parts, MSK &amp; Arterial/Venous vascular hemodynamic evaluations.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Overlapping Lower-Right Inset Card with Scroll Parallax (.cs_to_up) */}
                  <div
                    className="relative z-10 ml-auto -mt-8 mr-2 w-60 rounded-2xl border-4 border-white dark-teal:border-[#092D38] bg-[#0D4A5A] p-4 text-white shadow-xl transition-transform duration-200"
                    style={{
                      transform: `translateY(${-Math.min(scrollProgress * 0.45, 18)}px)`,
                    }}
                  >
                    <p className="font-display text-sm font-bold">
                      A Unit of EWA DERMA
                    </p>
                    <p className="mt-0.5 text-xs text-white/80">
                      Sushant Golf City · Near Lulu Mall
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Editorial Column */}
              <div className="edfic-reveal lg:col-span-6 space-y-5">
                <div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
                    About Us
                  </h2>
                  <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#287887]">
                    EDFIC · {clinic?.parentUnitName || 'A UNIT OF EWA DERMA'}
                  </p>
                </div>

                <div className="flex items-start gap-4 pt-2">
                  <ArrowRight className="mt-1.5 h-6 w-6 shrink-0 text-[#287887]" />
                  <div>
                    <h3 className="font-display text-xl font-bold leading-snug text-[#083642]">
                      EDFIC is a dedicated fetal medicine &amp; diagnostic ultrasound centre in Lucknow
                    </h3>
                    <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#65747B]">
                      Operating as the specialized imaging wing of EWA DERMA at Sushant Golf City, EDFIC delivers structured obstetric screening, Color Doppler studies, and organ ultrasonography under DNB Radiology specialist supervision with strict PCPNDT Act adherence.
                    </p>
                  </div>
                </div>

                <div className="pt-2 pl-10 flex flex-wrap gap-6">
                  <Link
                    to="/about"
                    className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4A5A]"
                  >
                    <span className="edfic-link-text">About EDFIC &amp; EWA DERMA</span>
                    <ArrowRight className="edfic-link-icon h-4 w-4" />
                  </Link>
                  <Link
                    to="/fetal-imaging"
                    className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#287887]"
                  >
                    <span className="edfic-link-text">Explore Fetal Imaging</span>
                    <ArrowUpRight className="edfic-link-icon h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Curved Teal Departments Band + 5-Column Overlapping Animated Cards */}
        <section className="bg-white mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="relative">
            <div className="edfic-reveal rounded-[28px] edfic-teal-band px-6 pb-36 pt-14 text-center text-white sm:px-10 sm:pb-40">
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                Departments
              </h2>
              <p className="mx-auto mt-2.5 max-w-xl text-sm text-white/85">
                Select a diagnostic category below to view available procedures and preparation guidance.
              </p>
            </div>

            <div className="-mt-24 px-2 sm:px-5">
              {servicesLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="h-48 rounded-2xl border border-[#E6F0F2] bg-white animate-pulse p-6"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {featuredCategories.map((cat, idx) => {
                    const Icon = DEPARTMENT_ICONS[idx % DEPARTMENT_ICONS.length];
                    return (
                      <Link
                        key={cat.id}
                        to={`/services?category=${cat.slug}`}
                        style={{ transitionDelay: `${idx * 70}ms` }}
                        className="edfic-reveal edfic-card-interactive group flex flex-col items-center justify-center rounded-2xl border border-[#E6F0F2] bg-white px-5 py-8 text-center hover:border-[#0D4A5A] hover:shadow-[0_22px_42px_-16px_rgba(13,74,90,0.22)] edfic-card-soft"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4FAFC] transition-all duration-300 group-hover:scale-110 group-hover:bg-[#E6F4F7]">
                          <Icon className="h-10 w-10 stroke-[1.5] text-[#287887] transition-colors duration-300 group-hover:text-[#0D4A5A]" />
                        </div>
                        <h3 className="mt-5 font-display text-base font-bold leading-snug text-[#083642] transition-colors group-hover:text-[#0D4A5A]">
                          {cat.name}
                        </h3>
                        <p className="mt-1.5 font-mono-tabular text-xs text-[#65747B]">
                          {cat.services.length} scans
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold">
                <Link
                  to="/services"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-[#0D4A5A]"
                >
                  <span className="edfic-link-text">Browse All Categories &amp; Complete Service Catalogue</span>
                  <ArrowRight className="edfic-link-icon h-4 w-4" />
                </Link>
                <Link to="/general-ultrasound" className="text-[#287887] hover:underline">
                  General Ultrasound
                </Link>
                <Link to="/doppler-studies" className="text-[#287887] hover:underline">
                  Doppler Studies
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 5. 2x2 Clinical Safeguards & Equipment Grid */}
        <section className="bg-white mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="edfic-reveal flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
              Clinical Standards
            </h2>
            <Link
              to="/technology"
              className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4A5A] whitespace-nowrap"
            >
              <span className="edfic-link-text">Explore technology &amp; protocols</span>
              <ArrowRight className="edfic-link-icon h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                icon: Stethoscope,
                title: `${doctor?.name || 'Dr. Varun Agrawal'} (${doctor?.qualification || 'DNB Radiology'})`,
                body: 'Morning specialist sessions dedicated to NT Scans, Level-II Anomaly evaluations, Fetal Echocardiography, Biophysical Profiles, and Obstetric Color Doppler.',
              },
              {
                icon: Activity,
                title: 'Multi-Probe Ultrasound & Doppler Suites',
                body: 'Equipped for high-frequency small parts, musculoskeletal, abdominal, KUB, 2D/3D pelvic/TVS imaging, and peripheral or visceral spectral Doppler studies.',
              },
              {
                icon: FileCheck2,
                title: 'Sterile Probe Covers & Hygiene',
                body: 'Single-use protective probe covers and medical-grade high-level disinfection protocols enforced rigorously between every transvaginal and guided procedure.',
              },
              {
                icon: ShieldCheck,
                title: 'PCPNDT Form F & Private Portal Reports',
                body: 'Strict statutory documentation for all pregnancy scans. Verified diagnostic PDFs are published strictly inside the authenticated Patient Portal.',
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  style={{ transitionDelay: `${idx * 80}ms` }}
                  className="edfic-reveal edfic-card-interactive group rounded-2xl border border-[#EEF4F6] bg-white p-7 hover:border-[#C9E2E8] edfic-card-soft"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#287887] text-white transition-all duration-300 group-hover:scale-105 group-hover:bg-[#0D4A5A]">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="font-display text-lg font-bold leading-snug text-[#083642]">
                      {card.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-[#65747B]">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. Interactive 2-Column Split with Vertical Dot-Line (.cs_tabs.cs_style1 staggered & dot scaling) */}
        <section id="visit-journey" className="bg-white mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="edfic-reveal text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#083642]">
              HOW YOUR VISIT WORKS
            </h2>
            <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.16em] text-[#287887]">
              APPOINTMENT WORKFLOW
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            {/* Left Selector Items with Vertical Right-Edge Border & Scaling Timeline Dots */}
            <div className="lg:col-span-6 lg:border-r lg:border-[#287887]/40 lg:pr-10 space-y-5">
              {VISIT_JOURNEY_STEPS.map((step, idx) => {
                const isSelected = step.id === activeJourney.id;
                const staggerClass = idx % 2 === 1 ? 'lg:ml-14' : 'lg:mr-10';
                return (
                  <div key={step.id} className="relative">
                    {/* Scaling Timeline Dot Mounted on Right Divider Line (.cs_tabs li.active::before scale 1.8) */}
                    <span
                      aria-hidden="true"
                      className={`hidden lg:block absolute -right-[45px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-[#287887] transition-transform duration-400 ${
                        isSelected ? 'scale-[1.8] bg-[#0D4A5A] ring-4 ring-[#D7EEF4]' : 'scale-100 opacity-65'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveJourneyId(step.id)}
                      className={`w-full rounded-[22px] p-5 text-left transition-all duration-300 ${staggerClass} ${
                        isSelected
                          ? 'bg-white border border-[#EEF4F6] edfic-card-elevated -translate-y-0.5'
                          : 'bg-transparent border border-transparent hover:bg-[#F7FBFD]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono-tabular text-xs font-bold transition-colors duration-300 ${
                            isSelected
                              ? 'bg-[#0D4A5A] text-white'
                              : 'bg-[#E9F3F3] text-[#0D4A5A]'
                          }`}
                        >
                          {step.stepNumber}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-base font-bold uppercase tracking-wide text-[#083642]">
                            {step.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[#65747B]">{step.subtitle}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right Animated Callout Detail (Re-triggers clean 400ms Fade-Slide on switch) */}
            <div key={activeJourney.id} className="edfic-tab-fade lg:col-span-6 space-y-4 lg:pl-4">
              <div className="flex items-center gap-3 text-[#287887]">
                <span className="font-display text-4xl font-extrabold leading-none opacity-65">
                  {activeJourney.stepNumber}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                  EDFIC Patient Step
                </span>
              </div>

              <h3 className="font-display text-2xl font-bold text-[#083642]">
                {activeJourney.heading}
              </h3>

              <p className="text-base leading-relaxed text-[#455A64]">
                {activeJourney.description}
              </p>

              <ul className="space-y-2 pt-2 text-sm text-[#65747B]">
                {activeJourney.highlights.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#287887]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 flex flex-wrap items-center gap-5">
                <Link
                  to={activeJourney.ctaTo}
                  className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white whitespace-nowrap"
                >
                  <span className="relative z-10">{activeJourney.ctaLabel}</span>
                  <span className="edfic-btn-arrows" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  to="/appointment-info"
                  className="edfic-link-elastic text-sm font-semibold text-[#0D4A5A] whitespace-nowrap"
                >
                  <span className="edfic-link-text">Appointment Guidelines</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Mid-Page Curved Teal CTA Banner with Breaking Parallax Shield Crest */}
        <section className="bg-white mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-20">
          <div className="edfic-reveal relative rounded-[28px] edfic-teal-band px-7 py-10 text-white sm:px-12 sm:py-12">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-balance">
                  Schedule Your Diagnostic or Fetal Scan Today!
                </h2>
                <p className="mt-3 max-w-xl text-sm sm:text-base text-white/85">
                  Choose your prescribed ultrasound examination, lock a verified slot in Lucknow, and access your signed report privately online.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-5">
                  <Link
                    to="/book"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-[#083642] shadow-sm transition-all hover:scale-[1.02] hover:bg-[#E9F3F3] whitespace-nowrap"
                  >
                    <span>Book Appointment</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/patient-info"
                    className="edfic-link-elastic text-sm font-semibold text-white/95 whitespace-nowrap"
                  >
                    <span className="edfic-link-text">Preparation Checklist</span>
                  </Link>
                </div>
              </div>

              {/* Oversized Breaking Shield Crest with Subtle Scroll Drift */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div
                  className="relative lg:-mt-20 flex h-56 w-52 flex-col items-center justify-center rounded-t-[2.25rem] rounded-b-[5.5rem] border-[6px] border-white dark-teal:border-[#052028] bg-gradient-to-b from-[#083642] via-[#0D4A5A] to-[#287887] p-6 text-center shadow-2xl transition-transform duration-300 hover:scale-[1.03]"
                  style={{
                    transform: `translateY(${-Math.min(scrollProgress * 0.25, 10)}px)`,
                  }}
                >
                  <HeartPulse className="h-14 w-14 text-[#A5E4EB]" />
                  <p className="mt-3 font-display text-sm font-bold text-white">
                    Morning Fetal Wing
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    Dr. Varun Agrawal · DNB Radiology
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. 3-Column Patient & Clinical Resources */}
        <section className="bg-white mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="edfic-reveal text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
              PATIENT GUIDES
            </p>
            <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
              Clinical &amp; Visit Information
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-3">
            {[
              {
                meta: 'Fetal Medicine Wing',
                title: 'Fetal Imaging Protocols: NT Scan to Fetal Echocardiography',
                to: '/fetal-imaging',
                icon: Baby,
              },
              {
                meta: 'Preparation & ID Rules',
                title: 'Before You Arrive: Fasting, Bladder Prep & Photo ID',
                to: '/patient-info',
                icon: FileCheck2,
              },
              {
                meta: 'Clinical Leadership',
                title: `Specialist Oversight: ${doctor?.name || 'Dr. Varun Agrawal'}`,
                to: '/doctor',
                icon: Stethoscope,
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  to={card.to}
                  style={{ transitionDelay: `${idx * 80}ms` }}
                  className="edfic-reveal group flex flex-col rounded-2xl border border-[#EEF4F6] bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[#C9E2E8] edfic-card-soft"
                >
                  <div className="overflow-hidden">
                    <div className="flex h-44 items-center justify-between bg-gradient-to-br from-[#EAF5F8] to-[#D4EAF0] px-8 transition-transform duration-500 group-hover:scale-105">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#0D4A5A] shadow-sm">
                        <Icon className="h-7 w-7" />
                      </div>
                      <svg viewBox="0 0 120 60" className="h-14 w-28 text-[#287887]/35" aria-hidden="true">
                        <path
                          d="M5 42 Q 35 12, 60 34 T 115 18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                        />
                        <circle cx="60" cy="34" r="4.5" fill="currentColor" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#65747B]">
                        <span>{card.meta}</span>
                        <ArrowUpRight className="h-4 w-4 text-[#287887] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold leading-snug text-[#083642] group-hover:text-[#0D4A5A]">
                        {card.title}
                      </h3>
                    </div>
                    <p className="mt-5 text-xs font-semibold text-[#65747B] transition-colors group-hover:text-[#0D4A5A]">
                      Learn More →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 9. Split Interactive Booking / Reception Inquiry Form + Soft-Aqua Curved Visual */}
        <section className="relative overflow-hidden bg-white py-12 sm:py-16">
          <div
            aria-hidden="true"
            className="edfic-particle-drift pointer-events-none absolute -right-24 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-[#E5F3F7]"
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              {/* Left Form matching ProHealth Appointment Form + Expanding Underline Radios */}
              <div className="edfic-reveal lg:col-span-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
                  REQUEST CALLBACK OR GUIDANCE
                </p>
                <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
                  Reception Inquiry
                </h2>

                {submittedLeadCode && (
                  <div className="mt-5 rounded-xl border border-[#287887] bg-[#E9F3F3] p-4 text-sm text-[#083642]">
                    <p className="font-semibold">
                      Inquiry registered · Reference{' '}
                      <span className="font-mono-tabular">{submittedLeadCode}</span>
                    </p>
                    <p className="mt-1 text-xs text-[#455A64]">
                      EDFIC reception has logged your request and will follow up shortly.
                    </p>
                  </div>
                )}

                {inquiryError && (
                  <div className="mt-5 rounded-xl border border-[#B42318]/40 bg-[#FEF3F2] p-3.5 text-xs text-[#B42318]">
                    {inquiryError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onQuickInquirySubmit)} className="mt-7 space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="homeFullName">Name</Label>
                      <Input
                        id="homeFullName"
                        className="rounded-xl border-[#B9D3DA] transition-colors focus:border-[#0D4A5A]"
                        {...register('fullName')}
                        placeholder="Patient or caller name"
                      />
                      {errors.fullName && (
                        <p className="mt-1 text-xs text-[#B42318]">{errors.fullName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="homePhone">Phone Number</Label>
                      <Input
                        id="homePhone"
                        className="rounded-xl border-[#B9D3DA] transition-colors focus:border-[#0D4A5A]"
                        {...register('phone')}
                        placeholder="10-digit mobile number"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-[#B42318]">{errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="homeEmail">Email (Optional)</Label>
                      <Input
                        id="homeEmail"
                        type="email"
                        className="rounded-xl border-[#B9D3DA] transition-colors focus:border-[#0D4A5A]"
                        {...register('email')}
                        placeholder="name@example.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-[#B42318]">{errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="homeService">Investigation</Label>
                      <Select
                        id="homeService"
                        className="rounded-xl border-[#B9D3DA] transition-colors focus:border-[#0D4A5A]"
                        {...register('interestedService')}
                      >
                        <option value="">General Inquiry</option>
                        {allServices.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Reason for Inquiry</Label>
                    <div className="mt-2 flex flex-wrap gap-6 text-sm text-[#455A64]">
                      {(
                        [
                          'Diagnostic Ultrasound',
                          'Fetal Medicine Scan',
                          'Preparation Question',
                        ] as const
                      ).map((option) => (
                        <label
                          key={option}
                          className="edfic-radio-chip inline-flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            value={option}
                            {...register('reasonType')}
                            className="h-4 w-4 accent-[#0D4A5A]"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="homeMessage">Preferred Visit Window / Question</Label>
                    <Textarea
                      id="homeMessage"
                      className="rounded-xl border-[#B9D3DA] transition-colors focus:border-[#0D4A5A]"
                      {...register('message')}
                      placeholder="Share your preferred date, morning/afternoon slot preference, or preparation question."
                    />
                    {errors.message && (
                      <p className="mt-1 text-xs text-[#B42318]">{errors.message.message}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-5 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-8 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <span className="relative z-10">
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                      </span>
                      <span className="edfic-btn-arrows" aria-hidden="true">
                        <ArrowRight className="h-4 w-4" />
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                    <Link
                      to="/book"
                      className="edfic-link-elastic text-sm font-semibold text-[#0D4A5A] whitespace-nowrap"
                    >
                      <span className="edfic-link-text">Or book a live slot directly →</span>
                    </Link>
                  </div>
                </form>
              </div>

              {/* Right Location & Operating Hours Visual Card */}
              <div className="edfic-reveal lg:col-span-5">
                <div className="rounded-[2rem] bg-gradient-to-b from-[#EAF5F8] to-[#D4EAF0] p-7 sm:p-9 edfic-card-soft transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0D4A5A] shadow-sm">
                    <MapPin className="h-6 w-6" />
                  </div>

                  <h3 className="mt-5 font-display text-2xl font-bold text-[#083642]">
                    {clinic?.clinicName || 'EDFIC'} Lucknow Centre
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#287887]">
                    {clinic?.parentUnitName || 'A Unit of EWA DERMA'}
                  </p>

                  <div className="mt-6 space-y-4 text-sm text-[#354B54]">
                    <div>
                      <p className="font-semibold text-[#083642]">Address</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#455A64]">
                        {clinic?.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'} (
                        {clinic?.landmark || 'Near Lulu Mall'}),{' '}
                        {clinic?.cityStateCountry || 'Lucknow, Uttar Pradesh, India'}.
                      </p>
                    </div>

                    <div className="border-t border-white/70 dark-teal:border-[#1B5564] pt-4">
                      <p className="font-semibold text-[#083642]">Operating Hours</p>
                      <p className="mt-1 text-xs text-[#455A64]">
                        {clinic?.weekdayHours || 'Monday–Saturday: 9:00 AM – 8:00 PM'}
                      </p>
                      <p className="text-xs text-[#455A64]">
                        {clinic?.sundayHours || 'Sunday: 10:00 AM – 2:00 PM (By Appointment)'}
                      </p>
                    </div>

                    {clinic?.primaryPhone ? (
                      <p className="border-t border-white/70 pt-4 font-mono-tabular text-xs font-semibold text-[#083642]">
                        Reception: {clinic.primaryPhone}
                        {clinic.officialEmail ? ` · ${clinic.officialEmail}` : ''}
                      </p>
                    ) : (
                      <p className="border-t border-white/70 pt-4 text-xs text-[#455A64]">
                        Official phone contact is configurable via EDFIC Administration; online inquiries are active 24/7.
                      </p>
                    )}
                  </div>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      to="/book"
                      className="edfic-btn-slide inline-flex h-10 items-center rounded-full px-5 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      <span className="relative z-10">Book Live Slot</span>
                    </Link>
                    <Link
                      to="/contact"
                      className="inline-flex h-10 items-center rounded-full bg-white px-5 text-xs font-semibold text-[#083642] transition-colors hover:bg-[#F5FAFB] whitespace-nowrap"
                    >
                      Location Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Patient Testimonials Showcase (Before FAQ Section) */}
        <TestimonialsSection />

        {/* 11. Centered FAQ Accordion with Smooth Grid Expansion ("WHAT PATIENTS / Usually Asked") */}
        <section id="faqs" className="bg-white mx-auto max-w-4xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <div className="edfic-reveal text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
              WHAT PATIENTS
            </p>
            <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
              Usually Asked
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[#65747B]">
              Answers covering obstetric fetal imaging, general diagnostic ultrasound preparation, slot verification, and private portal report access.
            </p>
          </div>

          <FaqAccordionSection variant="home" />

          <div className="mt-8 text-center">
            <Link
              to="/faqs"
              className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4A5A]"
            >
              <span className="edfic-link-text">View complete FAQs &amp; statutory notices</span>
              <ArrowRight className="edfic-link-icon h-4 w-4" />
            </Link>
          </div>

          {/* Monochrome Clinical Governance Strip */}
          <div className="edfic-reveal mt-16 grid grid-cols-2 gap-6 border-t border-[#EEF4F6] pt-12 text-center sm:grid-cols-4">
            {[
              { label: 'A Unit of EWA DERMA', sub: 'Clinical Division' },
              { label: 'PCPNDT Act Compliant', sub: 'Mandatory Form F' },
              { label: 'Sushant Golf City', sub: 'Near Lulu Mall, Lucknow' },
              { label: 'Private Patient Portal', sub: 'Encrypted PDF Access' },
            ].map((item) => (
              <div key={item.label} className="space-y-1 text-[#7D8C93]">
                <p className="font-display text-sm font-bold tracking-tight text-[#55676F]">
                  {item.label}
                </p>
                <p className="text-xs">{item.sub}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

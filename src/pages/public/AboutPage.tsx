import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Baby,
  CalendarClock,
  CheckCircle2,
  Compass,
  Eye,
  FileCheck2,
  HeartPulse,
  Lock,
  MapPin,
  Scan,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { usePublicClinic } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

interface CmsItem {
  id: string;
  title: string;
  contentMarkdown: string;
  medicalReviewerName: string | null;
}

interface StoryMilestone {
  chapter: string;
  title: string;
  summary: string;
}

interface CoreValue {
  index: string;
  category: 'clinical' | 'ethics';
  icon: typeof HeartPulse;
  title: string;
  description: string;
  practiceNote: string;
}

const STORY_MILESTONES: StoryMilestone[] = [
  {
    chapter: '01',
    title: 'Rooted in EWA DERMA',
    summary:
      'Established as the dedicated diagnostic ultrasonography and fetal medicine wing of EWA DERMA, bringing specialist-supervised imaging into a calm clinical environment.',
  },
  {
    chapter: '02',
    title: 'Serving Sushant Golf City & Lucknow',
    summary:
      'Located at Unit 10, Millennium Place near Lulu Mall so expectant mothers and referring doctors across Gomti Nagar Extension, Shaheed Path, and South Lucknow have accessible specialist care.',
  },
  {
    chapter: '03',
    title: 'Replacing Queues With Scheduled Precision',
    summary:
      'Built around appointment-led time slots, pre-visit fasting and hydration guidance, and dedicated morning sessions led by Dr. Varun Agrawal (DNB Radiology).',
  },
  {
    chapter: '04',
    title: 'Private Digital Continuity',
    summary:
      'Engineered with access-controlled Patient Portal report vaults, Form F statutory workflows, and immutable audit trails to protect every patient’s medical confidentiality.',
  },
];

const CORE_VALUES: CoreValue[] = [
  {
    index: '01',
    category: 'clinical',
    icon: HeartPulse,
    title: 'Specialist Care',
    description:
      'Every obstetric, vascular Doppler, and organ ultrasound is approached with unhurried clinical attention, clear communication, and DNB Radiology specialist oversight.',
    practiceNote: 'Dedicated morning sessions for complex fetal medicine scans.',
  },
  {
    index: '02',
    category: 'clinical',
    icon: Scan,
    title: 'Clinical Precision',
    description:
      'Standardized fetal biometry, multi-plane anatomical checklists, and spectral Doppler waveform assessment deliver structured findings that referring physicians can rely upon.',
    practiceNote: 'Protocol-driven documentation across all 5 diagnostic departments.',
  },
  {
    index: '03',
    category: 'ethics',
    icon: ShieldCheck,
    title: 'Statutory Integrity',
    description:
      'Uncompromising compliance with the PCPNDT Act, 1994, NMC ethical communication standards, and verified Form F documentation—with zero promotional claims or shortcuts.',
    practiceNote: 'Mandatory photo ID verification & Form F for every obstetric study.',
  },
  {
    index: '04',
    category: 'ethics',
    icon: Sparkles,
    title: 'Hygiene & Sterile Safety',
    description:
      'Radiation-free ultrasound modalities paired with single-use sterile transducer covers, medical-grade probe disinfection between examinations, and clean preparation suites.',
    practiceNote: 'Strict single-use sheath protocol for TVS and guided procedures.',
  },
  {
    index: '05',
    category: 'ethics',
    icon: Lock,
    title: 'Confidentiality & Privacy',
    description:
      'Diagnostic PDF reports are never sent over open public links or unencrypted messaging forwards; finalized reports are released strictly inside your authenticated Patient Portal.',
    practiceNote: 'Role-restricted access and logged report download records.',
  },
  {
    index: '06',
    category: 'clinical',
    icon: CalendarClock,
    title: 'Respect for Patient Time',
    description:
      'Real-time slot capacity, transparent advance verification, and clear pre-appointment checklists minimize waiting room fatigue for expectant parents and elderly patients.',
    practiceNote: 'Structured 30-minute slot rhythm synchronized with clinic hours.',
  },
];

const ANCHOR_LINKS = [
  { href: '#about-overview', label: 'About EDFIC' },
  { href: '#our-story', label: 'Our Story' },
  { href: '#our-purpose', label: 'Purpose' },
  { href: '#mission-vision', label: 'Mission & Vision' },
  { href: '#our-values', label: 'Core Values' },
  { href: '#leadership-centre', label: 'Doctors & Leadership' },
];

export function AboutPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: cmsData } = useQuery({
    queryKey: ['public-cms', 'about'],
    queryFn: () => apiFetch<{ items: CmsItem[] }>('/api/v1/public/cms/about'),
  });

  const [valueFilter, setValueFilter] = useState<'all' | 'clinical' | 'ethics'>('all');
  const pageRef = useRef<HTMLDivElement>(null);

  const clinic = clinicData?.clinic;
  const doctor = clinicData?.doctor;
  const cmsItem = cmsData?.items?.[0];

  const filteredValues =
    valueFilter === 'all'
      ? CORE_VALUES
      : CORE_VALUES.filter((item) => item.category === valueFilter);

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

      return () => observer.disconnect();
    }

    revealNodes.forEach((el) => markRevealed(el));
    return undefined;
  }, [valueFilter]);

  return (
    <PublicLayout>
      <SeoHead
        title="About EDFIC — Mission, Vision, Purpose, Story & Values | Lucknow"
        description="Explore the story, clinical purpose, mission, vision, and core values of EWA Diagnostic and Fetal Imaging Centre (EDFIC), a unit of EWA DERMA in Sushant Golf City, Lucknow."
        canonicalPath="/about"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinic?.primaryPhone,
          officialEmail: clinic?.officialEmail,
        })}
      />

      <div ref={pageRef} className="bg-white">
        {/* 1. Institutional Hero & Quick Anchor Navigation */}
        <section className="edfic-hero-gradient border-b border-[#DCE7E9] pt-12 pb-14 sm:pt-16 sm:pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
                {clinic?.fullName || 'EWA Diagnostic and Fetal Imaging Centre'} ·{' '}
                {clinic?.parentUnitName || 'A Unit of EWA DERMA'}
              </p>

              <h1
                className="mt-3 font-display font-extrabold tracking-tight text-[#083642] text-balance"
                style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', lineHeight: 1.08 }}
              >
                Built Around Clinical Clarity, Specialist Oversight &amp; Dignified Care
              </h1>

              <p className="mt-5 max-w-3xl text-base sm:text-lg leading-relaxed text-[#455A64]">
                Operating from Sushant Golf City near Lulu Mall in Lucknow, EDFIC is the specialized fetal medicine, Color Doppler, and diagnostic ultrasonography wing of{' '}
                <strong className="font-semibold text-[#083642]">EWA DERMA</strong>—structured to replace rushed waiting rooms with calm, appointment-led precision under{' '}
                <strong className="font-semibold text-[#083642]">
                  {doctor?.name || 'Dr. Varun Agrawal'} ({doctor?.qualification || 'DNB Radiology'})
                </strong>
                .
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/book"
                  className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-7 text-sm font-semibold text-white whitespace-nowrap shrink-0"
                >
                  <span className="relative z-10">Book Appointment</span>
                  <span className="edfic-btn-arrows" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  to="/doctor"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#0D4A5A]/25 bg-white px-6 text-sm font-semibold text-[#083642] transition-colors hover:border-[#0D4A5A] whitespace-nowrap shrink-0"
                >
                  <span>Meet {doctor?.name || 'Dr. Varun Agrawal'}</span>
                  <ArrowUpRight className="h-4 w-4 text-[#287887]" />
                </Link>
              </div>
            </div>

            {/* Institutional Fact Strip */}
            <div className="mt-12 grid grid-cols-2 gap-4 rounded-2xl border border-[#D5E6EA] bg-white/90 p-5 sm:p-6 md:grid-cols-4 md:gap-6 edfic-card-soft">
              <div>
                <p className="font-display text-xl sm:text-2xl font-bold text-[#083642]">
                  EWA DERMA
                </p>
                <p className="mt-1 text-xs text-[#65747B]">Parent Medical Institution</p>
              </div>
              <div>
                <p className="font-display text-xl sm:text-2xl font-bold text-[#083642]">
                  DNB Radiology
                </p>
                <p className="mt-1 text-xs text-[#65747B]">Specialist Clinical Oversight</p>
              </div>
              <div>
                <p className="font-display text-xl sm:text-2xl font-bold text-[#083642] font-mono-tabular">
                  09:30–13:30
                </p>
                <p className="mt-1 text-xs text-[#65747B]">Daily Morning Fetal Wing</p>
              </div>
              <div>
                <p className="font-display text-xl sm:text-2xl font-bold text-[#083642]">
                  PCPNDT 1994
                </p>
                <p className="mt-1 text-xs text-[#65747B]">100% Statutory Compliance</p>
              </div>
            </div>

            {/* In-Page Section Navigator */}
            <nav
              aria-label="About page sections"
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#D5E6EA] pt-5 text-xs sm:text-sm font-medium text-[#455A64]"
            >
              {ANCHOR_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-[#0D4A5A] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* 2. About EDFIC & Our Story (2-Column Editorial Split) */}
        <section id="about-overview" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
            {/* Left Column: About EDFIC */}
            <div className="edfic-reveal lg:col-span-6 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#287887]">
                  01. About EDFIC
                </p>
                <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642] text-balance">
                  {cmsItem?.title || 'A Specialized Fetal Imaging & Diagnostic Wing of EWA DERMA'}
                </h2>
              </div>

              {cmsItem ? (
                <div className="space-y-4 text-sm sm:text-base leading-relaxed text-[#24343B] whitespace-pre-line">
                  {cmsItem.contentMarkdown}
                </div>
              ) : (
                <p className="text-sm sm:text-base leading-relaxed text-[#24343B]">
                  EWA Diagnostic and Fetal Imaging Centre (EDFIC) operates as the specialized diagnostic ultrasound and fetal imaging wing of EWA DERMA at Unit 10, Millennium Place, Sushant Golf City, Lucknow (Near Lulu Mall).
                </p>
              )}

              <p className="text-sm sm:text-base leading-relaxed text-[#455A64]">
                Our clinical scope bridges five core imaging disciplines: obstetric and trimester-wise fetal screening (Viability, NT, Level-II Anomaly, Growth, Fetal Echocardiography, and BPP), Color and Spectral Doppler hemodynamics, abdominal and KUB evaluations, high-resolution small parts and musculoskeletal scans, and 2D/3D pelvic imaging.
              </p>

              <div className="grid grid-cols-1 gap-4 border-t border-[#DCE7E9] pt-6 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E6F0F2] bg-[#F6FAFB] p-4">
                  <div className="flex items-center gap-2.5 text-[#0D4A5A]">
                    <Baby className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-semibold text-[#083642]">Fetal Medicine Focus</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#65747B]">
                    Structured trimester protocols performed during dedicated morning specialist sessions with unhurried counseling.
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6F0F2] bg-[#F6FAFB] p-4">
                  <div className="flex items-center gap-2.5 text-[#0D4A5A]">
                    <Activity className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-semibold text-[#083642]">Clinician-Ready Reports</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#65747B]">
                    Clear measurements, Doppler indices, and clinical correlation authored by Dr. Varun Agrawal for referring doctors.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <Link
                  to="/services"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4A5A] whitespace-nowrap"
                >
                  <span className="edfic-link-text">Explore Diagnostic Services</span>
                  <ArrowRight className="edfic-link-icon h-4 w-4" />
                </Link>
                <Link
                  to="/facilities"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#287887] whitespace-nowrap"
                >
                  <span className="edfic-link-text">View Clinical Facilities</span>
                  <ArrowUpRight className="edfic-link-icon h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right Column: Our Story & Institutional Journey */}
            <div id="our-story" className="edfic-reveal lg:col-span-6">
              <div className="relative rounded-[2rem] border border-[#E3EFF2] bg-gradient-to-br from-[#F4FAFC] to-[#E6F3F6] p-7 sm:p-9 edfic-card-soft">
                {/* Rotating Quality Crest */}
                <div className="hidden sm:flex absolute -right-4 -top-6 z-10 h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg">
                  <svg
                    viewBox="0 0 120 120"
                    className="edfic-rotate-slow h-full w-full text-[#287887]"
                    aria-hidden="true"
                  >
                    <defs>
                      <path
                        id="aboutSealRingPath"
                        d="M 60, 60 m -43, 0 a 43,43 0 1,1 86,0 a 43,43 0 1,1 -86,0"
                      />
                    </defs>
                    <text className="fill-current text-[9.2px] font-bold uppercase tracking-[0.2em]">
                      <textPath href="#aboutSealRingPath">
                        QUALITY FETAL &amp; DIAGNOSTIC CARE · EDFIC ·
                      </textPath>
                    </text>
                  </svg>
                  <div className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-[#E9F3F3] text-[#0D4A5A]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                </div>

                <div className="border-b border-[#D2E6EC] pb-5 pr-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#287887]">
                    02. Our Story
                  </p>
                  <h3 className="mt-1.5 font-display text-2xl font-bold text-[#083642]">
                    Why We Built a Focused Diagnostic &amp; Fetal Centre in Lucknow
                  </h3>
                </div>

                <ol className="mt-6 space-y-4">
                  {STORY_MILESTONES.map((step) => (
                    <li
                      key={step.chapter}
                      className="rounded-xl border border-white bg-white/95 p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E9F3F3] font-mono-tabular text-xs font-bold text-[#0D4A5A]">
                          {step.chapter}
                        </span>
                        <div>
                          <h4 className="font-display text-base font-bold text-[#083642]">
                            {step.title}
                          </h4>
                          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#65747B]">
                            {step.summary}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Our Purpose, Mission & Vision (Deep Teal Editorial Band) */}
        <section id="our-purpose" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="edfic-reveal rounded-[28px] edfic-teal-band p-7 text-white sm:p-10 lg:p-12">
            {/* Our Purpose Lead Block */}
            <div className="max-w-4xl border-b border-white/20 pb-8">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#9BE3F0]">
                <Compass className="h-4 w-4" />
                <span>03. Our Purpose</span>
              </div>
              <h2 className="mt-2.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                Replacing Diagnostic Uncertainty With Calm, Evidence-Led Answers
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-white/90">
                Diagnostic ultrasound often meets patients at pivotal moments—a first pregnancy heartbeat, a mid-trimester fetal survey, an acute Doppler evaluation, or an internal organ check advised by a physician. EDFIC exists to ensure that these critical moments are met with unhurried specialist focus, radiation-free safety, sterile clinical standards, and private, reliable reporting—never assembly-line haste.
              </p>
            </div>

            {/* Mission & Vision Balanced 2-Column Grid */}
            <div
              id="mission-vision"
              className="mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2"
            >
              {/* Mission Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/20 bg-[#062A34]/75 p-7 backdrop-blur-md">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#9BE3F0]">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9BE3F0]">
                        Our Mission
                      </p>
                      <h3 className="font-display text-2xl font-bold text-white">
                        Specialist Precision Every Visit
                      </h3>
                    </div>
                  </div>

                  <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#E4F2F5]">
                    To deliver accurate, specialist-supervised fetal medicine, Color Doppler, and general diagnostic ultrasonography in Lucknow through scheduled appointments, medical-grade probe hygiene, strict PCPNDT compliance, and private digital report access.
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-white/15 pt-5 text-xs sm:text-sm text-[#CBE7EE]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]" />
                    <span>Daily morning fetal specialist sessions led by Dr. Varun Agrawal</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]" />
                    <span>Clear pre-scan hydration, fasting, and photo ID preparation guidance</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]" />
                    <span>Authenticated Patient Portal delivery with zero public report exposure</span>
                  </li>
                </ul>
              </div>

              {/* Vision Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/20 bg-[#062A34]/75 p-7 backdrop-blur-md">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#9BE3F0]">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9BE3F0]">
                        Our Vision
                      </p>
                      <h3 className="font-display text-2xl font-bold text-white">
                        Setting an Ethical Diagnostic Standard
                      </h3>
                    </div>
                  </div>

                  <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#E4F2F5]">
                    To be Lucknow’s most trusted benchmark for ethical, specialist-led fetal imaging and diagnostic ultrasound—recognized equally by expectant families and referring clinicians for clinical clarity, statutory integrity, and compassionate care.
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-white/15 pt-5 text-xs sm:text-sm text-[#CBE7EE]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]" />
                    <span>Raise awareness of structured trimester-wise fetal anomaly &amp; Doppler screening</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]" />
                    <span>Maintain NMC-aligned factual medical communication with zero sensational claims</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]" />
                    <span>Protect patient dignity and health records with accountable audit governance</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Our Core Values (Interactive Filter + 6 EDFIC Halo Cards) */}
        <section id="our-values" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="edfic-reveal flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
                04. Our Core Values
              </p>
              <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
                Principles That Govern Every Examination
              </h2>
            </div>

            {/* Interactive Value Filter */}
            <div
              role="group"
              aria-label="Filter values by focus area"
              className="inline-flex items-center gap-1 self-start rounded-xl border border-[#DCE7E9] bg-[#F6FAFB] p-1"
            >
              {(
                [
                  { id: 'all', label: 'All Values' },
                  { id: 'clinical', label: 'Clinical Care' },
                  { id: 'ethics', label: 'Ethics & Privacy' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setValueFilter(tab.id)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    valueFilter === tab.id
                      ? 'bg-[#0D4A5A] text-white shadow-sm'
                      : 'text-[#455A64] hover:text-[#083642]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredValues.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div
                  key={val.title}
                  style={{ transitionDelay: `${idx * 60}ms` }}
                  className="edfic-reveal edfic-value-card flex flex-col justify-between rounded-2xl border border-[#EEF4F6] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#C9E2E8] edfic-card-soft"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#65747B]">
                      <span className="font-mono-tabular font-semibold text-[#287887]">
                        Value {val.index}
                      </span>
                      <span>
                        {val.category === 'clinical' ? 'Clinical Practice' : 'Compliance & Safety'}
                      </span>
                    </div>

                    <div className="edfic-value-head mt-5 inline-flex items-center gap-3">
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#287887] text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="relative z-10 font-display text-xl font-bold text-[#083642]">
                        {val.title}
                      </h3>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[#65747B]">
                      {val.description}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#EEF4F6] pt-4 text-xs text-[#354B54]">
                    <span className="font-semibold text-[#083642]">In practice:</span>{' '}
                    {val.practiceNote}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Clinical Leadership & Doctors, Operating Details & Next Steps */}
        <section
          id="leadership-centre"
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20 space-y-8"
        >
          <div className="edfic-reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
              05. Doctors &amp; Clinical Leadership
            </p>
            <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
              Guiding Clinical Authority Across EDFIC &amp; EWA DERMA
            </h2>
            <p className="mt-2.5 max-w-3xl text-sm sm:text-base leading-relaxed text-[#455A64]">
              EDFIC combines specialist radiological leadership within our diagnostic suites with institutional clinical stewardship from our parent unit, EWA DERMA.
            </p>
          </div>

          {/* Two Doctor Leadership Cards */}
          <div className="edfic-reveal grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            {/* Doctor 1: Dr. Varun Agrawal — Leader of EDFIC */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DCE7E9] bg-[#F6FAFB] p-7 sm:p-8">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#65747B]">
                  <span className="font-semibold text-[#287887]">EDFIC Clinical Lead</span>
                  <span>Morning Specialist Sessions</span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0D4A5A] font-display text-xl font-bold text-white">
                    VA
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-[#083642]">
                      {doctor?.name || 'Dr. Varun Agrawal'}
                    </h3>
                    <p className="mt-0.5 text-sm font-medium text-[#287887]">
                      {doctor?.qualification || 'DNB Radiology'} ·{' '}
                      {doctor?.designation || 'Consultant Radiologist & Fetal Medicine Specialist'}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-[#455A64]">
                  Dr. Varun Agrawal leads EDFIC’s diagnostic radiology and fetal medicine practice in Lucknow—conducting daily morning fetal imaging sessions and overseeing structured reporting across early viability, first-trimester screening, Level-II anomaly evaluations, fetal echocardiography, and complex Color Doppler studies.
                </p>

                <div className="mt-5 border-t border-[#DCE7E9] pt-4">
                  <p className="text-xs font-semibold text-[#083642]">
                    Clinical Focus Areas
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-[#354B54]">
                    {(
                      doctor?.expertise || [
                        'NT Scan',
                        'Anomaly Scan',
                        'Growth Scan',
                        'Doppler',
                        'Fetal Echo',
                        'BPP',
                      ]
                    ).map((item, index, arr) => (
                      <span key={item} className="inline-flex items-center gap-3">
                        <span>{item}</span>
                        {index < arr.length - 1 && (
                          <span aria-hidden="true" className="text-[#9FB2B9]">
                            ·
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#DCE7E9] pt-5 flex flex-wrap items-center gap-5">
                <Link
                  to="/doctor"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4A5A] whitespace-nowrap"
                >
                  <span className="edfic-link-text">View Full Specialist Profile</span>
                  <ArrowRight className="edfic-link-icon h-4 w-4" />
                </Link>
                <Link
                  to="/fetal-imaging"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#287887] whitespace-nowrap"
                >
                  <span className="edfic-link-text">Trimester Imaging Pathway</span>
                  <ArrowUpRight className="edfic-link-icon h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Doctor 2: Dr. Sharad — EWA DERMA */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DCE7E9] bg-white p-7 sm:p-8 edfic-card-soft">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#65747B]">
                  <span className="font-semibold text-[#287887]">EWA DERMA · Parent Unit</span>
                  <span>Institutional Stewardship</span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#287887] font-display text-xl font-bold text-white">
                    DS
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-[#083642]">
                      Dr. Sharad
                    </h3>
                    <p className="mt-0.5 text-sm font-medium text-[#287887]">
                      Clinical Leadership · EWA DERMA (Parent Medical Institution)
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-[#455A64]">
                  Guiding the parent clinical ethos at EWA DERMA, Dr. Sharad helped shape EDFIC’s foundation as a dedicated diagnostic and fetal imaging wing in Sushant Golf City, Lucknow—anchoring the centre’s commitment to ethical medical communication, hygienic clinical environments, and respectful multidisciplinary care.
                </p>

                <div className="mt-5 border-t border-[#EEF4F6] pt-4">
                  <p className="text-xs font-semibold text-[#083642]">
                    Institutional Priorities
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-[#354B54]">
                    {[
                      'EWA DERMA Governance',
                      'Ethical Medical Standards',
                      'Patient-First Environment',
                      'Multidisciplinary Coordination',
                    ].map((item, index, arr) => (
                      <span key={item} className="inline-flex items-center gap-3">
                        <span>{item}</span>
                        {index < arr.length - 1 && (
                          <span aria-hidden="true" className="text-[#9FB2B9]">
                            ·
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#EEF4F6] pt-5 flex flex-wrap items-center gap-5">
                <a
                  href="#our-story"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4A5A] whitespace-nowrap"
                >
                  <span className="edfic-link-text">Read Our EWA DERMA Story</span>
                  <ArrowRight className="edfic-link-icon h-4 w-4" />
                </a>
                <Link
                  to="/contact"
                  className="edfic-link-elastic inline-flex items-center gap-1.5 text-sm font-semibold text-[#287887] whitespace-nowrap"
                >
                  <span className="edfic-link-text">Centre Contact &amp; Location</span>
                  <ArrowUpRight className="edfic-link-icon h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Centre Operations & Schedule Card */}
          <div className="edfic-reveal rounded-2xl border border-[#DCE7E9] bg-white p-7 sm:p-8 edfic-card-soft">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#287887]">
                    Centre Operations
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-[#083642]">
                    Visit EDFIC Lucknow
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3 text-sm text-[#455A64]">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#287887]" />
                    <div>
                      <p className="font-semibold text-[#083642]">
                        {clinic?.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'}
                      </p>
                      <p className="text-xs text-[#65747B]">
                        {clinic?.landmark || 'Near Lulu Mall'},{' '}
                        {clinic?.cityStateCountry || 'Lucknow, Uttar Pradesh, India'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#287887]" />
                    <div>
                      <p className="font-semibold text-[#083642]">Operating Schedule</p>
                      <p className="text-xs text-[#65747B]">
                        {clinic?.weekdayHours || 'Monday–Saturday: 9:00 AM – 8:00 PM'}
                      </p>
                      <p className="text-xs text-[#65747B]">
                        {clinic?.sundayHours || 'Sunday: 10:00 AM – 2:00 PM (By Appointment)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#287887]" />
                    <div>
                      <p className="font-semibold text-[#083642]">Statutory &amp; Ethical Pledge</p>
                      <p className="text-xs leading-relaxed text-[#65747B]">
                        Strict adherence to the PCPNDT Act, 1994. Sex selection or fetal gender disclosure is strictly prohibited and never performed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 shrink-0">
                <Link
                  to="/book"
                  className="inline-flex h-10 items-center rounded-full bg-[#0D4A5A] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#083642] whitespace-nowrap shrink-0"
                >
                  Schedule Slot
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex h-10 items-center rounded-full border border-[#C9D9DC] bg-white px-5 text-xs font-semibold text-[#24343B] transition-colors hover:border-[#0D4A5A] whitespace-nowrap shrink-0"
                >
                  Directions &amp; Contact
                </Link>
              </div>
            </div>
          </div>

          {/* Patient & Institutional Links Footer Strip */}
          <div className="edfic-reveal rounded-2xl border border-[#DCE7E9] bg-[#E9F3F3]/70 p-6 sm:p-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-[#083642]">
                Preparing for an Upcoming Ultrasound or Fetal Evaluation?
              </p>
              <p className="mt-1 text-xs sm:text-sm text-[#455A64]">
                Review fasting, bladder hydration, and PCPNDT photo ID requirements before arriving at the centre.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/patient-info"
                className="inline-flex h-10 items-center rounded-full border border-[#0D4A5A]/30 bg-white px-5 text-xs font-semibold text-[#083642] hover:border-[#0D4A5A] whitespace-nowrap shrink-0"
              >
                Preparation Guide
              </Link>
              <Link
                to="/portal"
                className="inline-flex h-10 items-center rounded-full bg-[#0D4A5A] px-5 text-xs font-semibold text-white hover:bg-[#083642] whitespace-nowrap shrink-0"
              >
                Patient Portal
              </Link>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

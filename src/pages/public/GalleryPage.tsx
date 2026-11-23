import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Baby,
  Building2,
  FileCheck2,
  Lock,
  Scan,
  ShieldCheck,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';

type GalleryCategory = 'All' | 'Clinical Suites' | 'Equipment & Hygiene' | 'Patient Care';

interface GallerySpaceItem {
  id: string;
  category: Exclude<GalleryCategory, 'All'>;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Baby;
}

const GALLERY_SPACES: GallerySpaceItem[] = [
  {
    id: 'fetal-suite',
    category: 'Clinical Suites',
    title: 'Obstetric & Fetal Medicine Suite',
    subtitle: 'Quiet Ambient Scan Suite · Morning Specialist Sessions',
    description:
      'Designed for detailed NT Screening, Level-II Anomaly evaluations, Fetal Echocardiography, and Growth Scans with clear viewing angles and patient privacy.',
    icon: Baby,
  },
  {
    id: 'doppler-suite',
    category: 'Equipment & Hygiene',
    title: 'Color & Spectral Doppler Console',
    subtitle: 'Multi-Probe Convex, Linear & Endocavitary Architecture',
    description:
      'Supports calibrated pulsed-wave Doppler waveforms across obstetric vessels, renal arteries, carotid vessels, and peripheral arterial or venous examinations.',
    icon: Activity,
  },
  {
    id: 'general-suite',
    category: 'Clinical Suites',
    title: 'General Abdomen, KUB & Small-Parts Suite',
    subtitle: 'High-Resolution Organ & MSK Imaging',
    description:
      'Dedicated suite for abdominal, urinary tract, breast, thyroid, neck, scrotal, and musculoskeletal diagnostic ultrasound investigations.',
    icon: Scan,
  },
  {
    id: 'sterility-zone',
    category: 'Equipment & Hygiene',
    title: 'Probe Disinfection & Sterile Supply Station',
    subtitle: 'Single-Use Covers & High-Level Probe Hygiene',
    description:
      'Sanitized workflow between appointments utilizing disposable transducer sheaths and clinical-grade probe disinfection protocols.',
    icon: ShieldCheck,
  },
  {
    id: 'reception-desk',
    category: 'Patient Care',
    title: 'Reception Check-In & Statutory Form F Desk',
    subtitle: 'Unit 10, Millennium Place, Sushant Golf City',
    description:
      'Streamlined check-in for prescription review, photo ID verification, UTR confirmation reconciliation, and statutory PCPNDT compliance.',
    icon: FileCheck2,
  },
  {
    id: 'portal-reporting',
    category: 'Patient Care',
    title: 'Authenticated Reporting & Digital Vault Desk',
    subtitle: 'Confidential Patient Portal Delivery',
    description:
      'Reports finalized by Dr. Varun Agrawal are securely archived and released strictly inside authenticated patient portal accounts.',
    icon: Lock,
  },
];

const GALLERY_FILTERS: GalleryCategory[] = [
  'All',
  'Clinical Suites',
  'Equipment & Hygiene',
  'Patient Care',
];

export function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>('All');

  const filteredItems = useMemo(
    () =>
      activeCategory === 'All'
        ? GALLERY_SPACES
        : GALLERY_SPACES.filter((item) => item.category === activeCategory),
    [activeCategory],
  );

  return (
    <PublicLayout>
      <SeoHead
        title="Centre Gallery & Clinical Suites | EDFIC Lucknow"
        description="Structured overview of EDFIC clinical suites, transducer hygiene areas, reception desk, and imaging bays at Sushant Golf City, Lucknow."
        canonicalPath="/gallery"
        structuredData={buildClinicJsonLd()}
      />

      <div className="bg-white">
        <section className="edfic-hero-gradient border-b border-[#DCE7E9] py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
                SUSHANT GOLF CITY · LUCKNOW CENTRE
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#083642]">
                Centre Gallery &amp; Clinical Environment
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[#455A64]">
                Inspect the clinical layout of EDFIC’s diagnostic bays, hygiene protocols, and patient check-in environment at Unit 10, Millennium Place.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Interactive Category Filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EEF4F6] pb-6">
            <div
              role="tablist"
              aria-label="Filter gallery areas"
              className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#EEF5F7] p-1"
            >
              {GALLERY_FILTERS.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#083642] shadow-sm'
                        : 'text-[#4F646D] hover:text-[#083642]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#65747B] flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-[#287887]" />
              <span>Official site photography is added strictly after administrative &amp; privacy review.</span>
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((space) => {
              const Icon = space.icon;
              return (
                <div
                  key={space.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#E6F0F2] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#287887] edfic-card-soft"
                >
                  {/* Clean Architectural Visual Frame (zero stock or unauthorized patient photos) */}
                  <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-[#EAF5F8] via-[#DCEEF3] to-[#C8E4EC] p-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-[#0D4A5A] shadow-md transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-9 w-9" />
                    </div>
                    <svg
                      viewBox="0 0 220 80"
                      className="pointer-events-none absolute bottom-0 left-0 right-0 w-full text-white/60 dark-teal:text-[#092D38]/85"
                      aria-hidden="true"
                    >
                      <path
                        d="M0,55 Q55,20 110,48 T220,30 L220,80 L0,80 Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <p className="text-[11px] font-semibold text-[#287887]">
                        {space.category}
                      </p>
                      <h2 className="mt-1.5 font-display text-lg font-bold text-[#083642]">
                        {space.title}
                      </h2>
                      <p className="mt-1 text-xs font-medium text-[#455A64]">
                        {space.subtitle}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-[#65747B]">
                        {space.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 rounded-2xl border border-[#DCE7E9] bg-[#F6FAFB] p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#083642]">
                Compliance &amp; Privacy Photography Standard
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#65747B]">
                In line with healthcare ethics and patient dignity, EDFIC never displays stock clinic images or unauthorized patient photographs. Verified facility photos are uploaded exclusively by authorized EDFIC leadership.
              </p>
            </div>
            <Link
              to="/book"
              className="edfic-btn-slide inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-xs font-semibold text-white whitespace-nowrap"
            >
              <span className="relative z-10">Schedule Visit</span>
              <ArrowRight className="relative z-10 h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

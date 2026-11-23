import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Baby, FileCheck2, HeartPulse, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';

type BlogCategory = 'All' | 'Fetal Imaging' | 'Scan Preparation' | 'Compliance & Privacy';

interface BlogArticle {
  id: string;
  category: Exclude<BlogCategory, 'All'>;
  readTime: string;
  title: string;
  summary: string;
  icon: typeof Baby;
  sections: { heading: string; body: string }[];
  actionLabel: string;
  actionTo: string;
}

const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'fetal-screening-milestones',
    category: 'Fetal Imaging',
    readTime: '4 min read',
    icon: Baby,
    title: 'Understanding Key Trimester Fetal Ultrasound Milestones',
    summary:
      'An educational overview of why obstetricians recommend Dating Scans, NT Screening, Level-II Anomaly Scans, Fetal Echocardiography, and Growth Scans at specific gestational windows.',
    sections: [
      {
        heading: 'First Trimester: Viability & NT Screening (11 to 13+6 Weeks)',
        body: 'Early viability scans confirm intrauterine gestation and cardiac activity. Between 11 and 13+6 weeks, the Nuchal Translucency (NT) scan evaluates fetal crown-rump length, nuchal fold thickness, and early anatomical markers under standardized protocols.',
      },
      {
        heading: 'Second Trimester: Level-II Anomaly Scan & Fetal Echo (18 to 24 Weeks)',
        body: 'The Level-II Targeted Anomaly Scan conducts a systematic head-to-toe anatomical review of fetal organ systems, placenta location, and amniotic fluid. When clinically indicated by your physician, Fetal Echocardiography provides focused evaluation of fetal heart chambers and outflow tracts.',
      },
      {
        heading: 'Third Trimester: Growth Biometry, BPP & Obstetric Doppler',
        body: 'Interval growth scans assess fetal biometry trends, amniotic fluid index, and Biophysical Profile (BPP). Obstetric Color Doppler studies measure blood flow waveforms across the umbilical artery, middle cerebral artery, and uterine arteries.',
      },
    ],
    actionLabel: 'Explore Fetal Imaging Services',
    actionTo: '/fetal-imaging',
  },
  {
    id: 'pre-scan-preparation',
    category: 'Scan Preparation',
    readTime: '3 min read',
    icon: FileCheck2,
    title: 'Before Your Appointment: Fasting vs. Full-Bladder Scan Preparation',
    summary:
      'Why different diagnostic ultrasound procedures require fasting, bladder filling, or an empty bladder to achieve clear acoustic imaging on the first visit.',
    sections: [
      {
        heading: 'When 6 to 8 Hours of Fasting Is Needed',
        body: 'Whole Abdomen, Upper Abdomen, Hepatobiliary, and Renal or Abdominal Doppler scans require fasting so bowel gas is minimized and the gallbladder remains distended for clear evaluation. Plain water is permitted unless instructed otherwise.',
      },
      {
        heading: 'When a Comfortably Full Bladder Helps',
        body: 'For KUB (Kidney, Ureter, Bladder) and Transabdominal Pelvic studies, drinking 3 to 4 glasses of water 45 to 60 minutes prior to your appointment creates an acoustic window that improves visualization of lower abdominal organs.',
      },
      {
        heading: 'Studies Requiring No Fasting or an Empty Bladder',
        body: 'Neck, Thyroid, Breast, Soft-Tissue, and Musculoskeletal (MSK) studies need no special fasting. For Transvaginal (TVS) studies, an empty urinary bladder is required right before entering the scan suite.',
      },
    ],
    actionLabel: 'Read Full Prep Checklist',
    actionTo: '/patient-info',
  },
  {
    id: 'doppler-role',
    category: 'Fetal Imaging',
    readTime: '3 min read',
    icon: HeartPulse,
    title: 'How Color & Spectral Doppler Supports Clinical Evaluation',
    summary:
      'Learn how radiation-free Doppler ultrasound measures directional blood flow velocities across obstetric, renal, carotid, and limb vessels.',
    sections: [
      {
        heading: 'Obstetric & Maternal Vascular Assessment',
        body: 'Doppler imaging evaluates placental and fetal blood circulation alongside routine biometry during morning specialist sessions led by Dr. Varun Agrawal (DNB Radiology).',
      },
      {
        heading: 'Renal, Carotid & Peripheral Limb Studies',
        body: 'Outside obstetrics, Color and Spectral Doppler assesses arterial narrowing, venous patency, deep venous thrombosis screening, and visceral blood flow without contrast dye or ionizing radiation.',
      },
    ],
    actionLabel: 'Explore Doppler Studies',
    actionTo: '/doppler-studies',
  },
  {
    id: 'pcpndt-portal-security',
    category: 'Compliance & Privacy',
    readTime: '3 min read',
    icon: ShieldCheck,
    title: 'PCPNDT Form F Requirements & Private Patient Portal Report Security',
    summary:
      'Important statutory documentation required for obstetric visits and how EDFIC safeguards finalized diagnostic PDFs inside authenticated portal accounts.',
    sections: [
      {
        heading: 'Mandatory Documents Under PCPNDT Rules',
        body: 'Every patient undergoing an obstetric scan must carry a valid government photo ID (such as Aadhaar Card or Passport), the referring doctor’s signed prescription, and prior pregnancy scan reports to complete statutory Form F declarations. Prenatal sex determination is strictly prohibited by law.',
      },
      {
        heading: 'Why Diagnostic Reports Are Never Sent on Public Links',
        body: 'Once Dr. Varun Agrawal finalizes and signs your ultrasound report, EDFIC publishes the PDF exclusively inside your authenticated Patient Portal account rather than transmitting medical files over unencrypted chat attachments.',
      },
    ],
    actionLabel: 'Open Patient Portal',
    actionTo: '/portal',
  },
];

const BLOG_FILTERS: BlogCategory[] = [
  'All',
  'Fetal Imaging',
  'Scan Preparation',
  'Compliance & Privacy',
];

export function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory>('All');
  const [expandedId, setExpandedId] = useState<string>(BLOG_ARTICLES[0].id);

  const visibleArticles = useMemo(
    () =>
      selectedCategory === 'All'
        ? BLOG_ARTICLES
        : BLOG_ARTICLES.filter((art) => art.category === selectedCategory),
    [selectedCategory],
  );

  const handleFilterChange = (category: BlogCategory) => {
    setSelectedCategory(category);
    const nextList =
      category === 'All'
        ? BLOG_ARTICLES
        : BLOG_ARTICLES.filter((art) => art.category === category);
    if (!nextList.some((art) => art.id === expandedId)) {
      setExpandedId(nextList[0]?.id || '');
    }
  };

  return (
    <PublicLayout>
      <SeoHead
        title="Patient Education Blog & Clinical Guides | EDFIC Lucknow"
        description="Read clinically reviewed patient articles on fetal imaging milestones, pre-scan fasting and hydration preparation, Color Doppler studies, PCPNDT rules, and report privacy at EDFIC."
        canonicalPath="/blog"
        structuredData={buildClinicJsonLd()}
      />

      <div className="bg-white">
        <section className="edfic-hero-gradient border-b border-[#DCE7E9] py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
              PATIENT EDUCATION · CLINICAL GUIDES
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#083642]">
              EDFIC Diagnostic &amp; Fetal Care Guides
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#455A64]">
              Factual patient education articles covering trimester fetal screening protocols, preparation checklists, Color Doppler imaging, and statutory medical privacy.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EEF4F6] pb-6">
            <div
              role="tablist"
              aria-label="Filter patient articles"
              className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#EEF5F7] p-1"
            >
              {BLOG_FILTERS.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleFilterChange(cat)}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white text-[#083642] shadow-sm'
                        : 'text-[#4F646D] hover:text-[#083642]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#65747B]">
              Educational information only - consult your physician for clinical advice.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            {visibleArticles.map((article) => {
              const Icon = article.icon;
              const isOpen = expandedId === article.id;

              return (
                <article
                  key={article.id}
                  id={article.id}
                  className={`rounded-2xl border transition-colors duration-300 ${
                    isOpen
                      ? 'border-[#B6DCE5] bg-[#F6FBFD]'
                      : 'border-[#DCE7E9] bg-white hover:border-[#287887]/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? '' : article.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-4 p-6 text-left cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E9F3F3] text-[#0D4A5A]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-[#287887]">
                          <span>{article.category}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="text-[#65747B]">{article.readTime}</span>
                        </p>
                        <h2 className="font-display text-lg sm:text-xl font-bold text-[#083642]">
                          {article.title}
                        </h2>
                        <p className="text-sm leading-relaxed text-[#65747B]">
                          {article.summary}
                        </p>
                      </div>
                    </div>

                    <span
                      aria-hidden="true"
                      className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                        isOpen
                          ? 'rotate-180 border-[#0D4A5A] bg-[#0D4A5A] text-white'
                          : 'rotate-0 border-[#287887] bg-white text-[#0D4A5A]'
                      }`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </span>
                  </button>

                  <div className={`edfic-accordion-grid ${isOpen ? 'is-open' : ''}`}>
                    <div className="edfic-accordion-inner">
                      <div className="border-t border-[#DCE7E9] px-6 pb-6 pt-5 space-y-5">
                        {article.sections.map((sec) => (
                          <div key={sec.heading}>
                            <h3 className="font-display text-sm sm:text-base font-bold text-[#083642]">
                              {sec.heading}
                            </h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-[#354B54]">
                              {sec.body}
                            </p>
                          </div>
                        ))}

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6F0F2]">
                          <Link
                            to={article.actionTo}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D4A5A] hover:underline"
                          >
                            <span>{article.actionLabel}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            to="/book"
                            className="inline-flex h-9 items-center rounded-full bg-[#0D4A5A] px-4 text-xs font-semibold text-white hover:bg-[#083642]"
                          >
                            Book Slot
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

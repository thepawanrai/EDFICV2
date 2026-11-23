import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight } from 'lucide-react';

export type FaqTopic = 'Fetal Imaging' | 'Diagnostic Procedures' | 'Appointments & Reports';

export interface ClinicalFaqItem {
  id: string;
  topic: FaqTopic;
  question: string;
  answer: string;
  relatedLabel?: string;
  relatedTo?: string;
  featuredOnHome?: boolean;
}

export const CLINICAL_FAQS: ClinicalFaqItem[] = [
  {
    id: 'fetal-scope',
    topic: 'Fetal Imaging',
    featuredOnHome: true,
    question: 'What fetal imaging and obstetric ultrasound scans are performed at EDFIC?',
    answer:
      'EDFIC performs structured obstetric and fetal imaging examinations including Dating & Early Viability Scans, First-Trimester Nuchal Translucency (NT) Screening, Level-II Targeted Anomaly Scans, Fetal Growth & Biometry, Fetal Echocardiography, Biophysical Profile (BPP), and Obstetric Color Doppler studies during daily morning specialist sessions led by Dr. Varun Agrawal (DNB Radiology).',
    relatedLabel: 'Explore Fetal Imaging',
    relatedTo: '/fetal-imaging',
  },
  {
    id: 'fetal-timing',
    topic: 'Fetal Imaging',
    featuredOnHome: true,
    question: 'When should I schedule an NT Scan, Level-II Anomaly Scan, or Fetal Echocardiography?',
    answer:
      'Specific gestational windows are determined by your referring obstetrician. Generally, first-trimester screening (NT Scan) is advised between 11 and 13+6 weeks, Level-II Anomaly Scans around 18 to 22 weeks, and Fetal Echocardiography typically between 18 and 24 weeks when clinically indicated. Please carry your prescription and prior antenatal records so timing matches your LMP/dating scan.',
    relatedLabel: 'Book Morning Specialist Slot',
    relatedTo: '/book',
  },
  {
    id: 'fetal-pcpndt',
    topic: 'Fetal Imaging',
    featuredOnHome: true,
    question: 'What documents are mandatory for pregnancy scans under PCPNDT rules?',
    answer:
      'Every patient undergoing an obstetric or fetal ultrasound must carry a valid government-issued photo ID (such as Aadhaar Card or Passport), the referring doctor’s signed prescription, and any prior trimester ultrasound reports for mandatory statutory Form F compliance. In strict accordance with the PCPNDT Act, 1994, prenatal sex determination or gender prediction is illegal and is never performed or disclosed.',
    relatedLabel: 'Read PCPNDT Consent Info',
    relatedTo: '/patient-consent',
  },
  {
    id: 'fetal-prep',
    topic: 'Fetal Imaging',
    featuredOnHome: false,
    question: 'Do I need to fast or hold a full bladder for a pregnancy scan?',
    answer:
      'Fasting is not required for obstetric or fetal ultrasound scans; you should eat normally and stay comfortably hydrated. In very early first-trimester scans (before 10–12 weeks), mild bladder filling may be requested if a transabdominal view is performed. For second- and third-trimester NT, Anomaly, Growth, or Fetal Echo scans, an overfull bladder is not necessary.',
    relatedLabel: 'View Preparation Guidelines',
    relatedTo: '/patient-info',
  },
  {
    id: 'diag-services',
    topic: 'Diagnostic Procedures',
    featuredOnHome: true,
    question: 'Which general ultrasound and Color Doppler procedures are available?',
    answer:
      'Alongside fetal medicine, EDFIC offers Whole Abdomen & Upper Abdomen Ultrasound, KUB & Prostate evaluation, Gynecological Pelvis & Transvaginal (TVS) studies, High-Resolution Breast, Thyroid & Neck, Small Parts & Musculoskeletal (MSK) imaging, and Spectral/Color Doppler examinations (Carotid, Renal, Obstetric, Scrotal, and Peripheral Arterial/Venous Doppler).',
    relatedLabel: 'Browse All Services',
    relatedTo: '/services',
  },
  {
    id: 'diag-prep',
    topic: 'Diagnostic Procedures',
    featuredOnHome: true,
    question: 'How should I prepare (fasting vs. full bladder) before a diagnostic ultrasound?',
    answer:
      'Preparation varies by examination: Whole Abdomen, Upper Abdomen, and Renal or Abdominal Doppler scans require 6–8 hours of fasting (plain water is allowed). KUB and Transabdominal Pelvic scans require drinking 3–4 glasses of water 45–60 minutes prior and holding urine. Transvaginal (TVS) scans require an empty bladder right before the scan. Neck, Thyroid, Breast, and MSK scans need no fasting.',
    relatedLabel: 'Check Prep Checklist',
    relatedTo: '/patient-info',
  },
  {
    id: 'diag-safety-hygiene',
    topic: 'Diagnostic Procedures',
    featuredOnHome: false,
    question: 'Is diagnostic ultrasound safe and what hygiene protocols are followed?',
    answer:
      'Diagnostic ultrasonography and Color Doppler use high-frequency sound waves with zero ionizing radiation, making them clinically established non-invasive imaging tools when medically indicated. At EDFIC, medical-grade probe disinfection is performed between every examination, alongside single-use sterile transducer covers for endocavitary and specialized evaluations.',
    relatedLabel: 'Our Imaging Standards',
    relatedTo: '/technology',
  },
  {
    id: 'diag-duration',
    topic: 'Diagnostic Procedures',
    featuredOnHome: false,
    question: 'How long does an ultrasound procedure take at the centre?',
    answer:
      'Most general ultrasound scans take approximately 15–20 minutes, while detailed Level-II Anomaly Scans, Fetal Echocardiography, and multi-vessel Color Doppler studies typically require 25–40 minutes depending on clinical complexity and fetal position. We recommend arriving 15 minutes before your confirmed slot for prescription and ID verification.',
    relatedLabel: 'View General Ultrasound',
    relatedTo: '/general-ultrasound',
  },
  {
    id: 'booking-upi',
    topic: 'Appointments & Reports',
    featuredOnHome: true,
    question: 'How do appointment slot booking and UPI advance verification work?',
    answer:
      'On our Book Appointment page, choose your prescribed scan and an open time slot matching clinic hours. Complete the configured UPI advance payment and submit your UTR/reference number. A unique booking reference is created immediately, and your slot changes to Confirmed once EDFIC reception manually verifies your UTR against banking records.',
    relatedLabel: 'Book Live Slot',
    relatedTo: '/book',
  },
  {
    id: 'reports-portal',
    topic: 'Appointments & Reports',
    featuredOnHome: true,
    question: 'How and when will I receive my finalized diagnostic PDF report?',
    answer:
      'Once Dr. Varun Agrawal reviews and finalizes your examination, your signed PDF report is published securely inside your authenticated EDFIC Patient Portal account. For patient confidentiality and medical data protection, diagnostic reports and findings are never sent as open files over WhatsApp or public links.',
    relatedLabel: 'Open Patient Portal',
    relatedTo: '/portal',
  },
];

type TopicFilter = 'All' | FaqTopic;

const TOPIC_TABS: { value: TopicFilter; label: string }[] = [
  { value: 'All', label: 'All Topics' },
  { value: 'Fetal Imaging', label: 'Fetal Imaging' },
  { value: 'Diagnostic Procedures', label: 'Diagnostic Procedures' },
  { value: 'Appointments & Reports', label: 'Booking & Reports' },
];

interface FaqAccordionSectionProps {
  variant?: 'home' | 'full';
}

export function FaqAccordionSection({ variant = 'home' }: FaqAccordionSectionProps) {
  const [selectedTopic, setSelectedTopic] = useState<TopicFilter>('All');

  const baseItems = useMemo(
    () => (variant === 'home' ? CLINICAL_FAQS.filter((item) => item.featuredOnHome) : CLINICAL_FAQS),
    [variant],
  );

  const visibleItems = useMemo(
    () =>
      selectedTopic === 'All'
        ? baseItems
        : baseItems.filter((item) => item.topic === selectedTopic),
    [baseItems, selectedTopic],
  );

  const [openId, setOpenId] = useState<string | null>(() => {
    const defaultItem =
      variant === 'home'
        ? CLINICAL_FAQS.find((item) => item.id === 'fetal-pcpndt') ?? CLINICAL_FAQS[0]
        : CLINICAL_FAQS[0];
    return defaultItem?.id ?? null;
  });

  const handleTopicChange = (topic: TopicFilter) => {
    setSelectedTopic(topic);
    const nextList =
      topic === 'All' ? baseItems : baseItems.filter((item) => item.topic === topic);
    if (!nextList.some((item) => item.id === openId)) {
      setOpenId(nextList[0]?.id ?? null);
    }
  };

  return (
    <div>
      {/* Interactive Topic Filter Tabs */}
      <div className="mt-8 flex justify-center">
        <div
          role="tablist"
          aria-label="Filter patient questions by clinical category"
          className="inline-flex flex-wrap items-center justify-center gap-1 rounded-xl bg-[#EEF5F7] dark-teal:bg-[#0B323E] dark-teal:border dark-teal:border-[#1B5564] p-1"
        >
          {TOPIC_TABS.map((tab) => {
            const active = selectedTopic === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleTopicChange(tab.value)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#083642] shadow-sm dark-teal:bg-[#136174] dark-teal:text-[#F0F9FA]'
                    : 'text-[#4F646D] hover:text-[#083642] dark-teal:text-[#B8DDE3] dark-teal:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion Items using .edfic-accordion-grid */}
      <div className="mt-8 space-y-4">
        {visibleItems.map((faq) => {
          const isOpen = openId === faq.id;
          const panelId = `faq-panel-${faq.id}`;
          const triggerId = `faq-trigger-${faq.id}`;

          return (
            <div
              key={faq.id}
              className={`rounded-2xl border transition-colors duration-300 ${
                isOpen
                  ? 'border-[#B6DCE5] bg-[#D7EEF4] dark-teal:border-[#4EA5B7] dark-teal:bg-[#0F4352]'
                  : 'border-[#DCE7E9] bg-white hover:border-[#287887]/60 dark-teal:border-[#1B5564] dark-teal:bg-[#092D38] dark-teal:hover:border-[#4EA5B7]'
              }`}
            >
              <button
                id={triggerId}
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A] dark-teal:focus-visible:ring-[#6FD3E3] focus-visible:ring-offset-2 rounded-2xl"
              >
                <div className="min-w-0 space-y-1">
                  {selectedTopic === 'All' && (
                    <p className="text-[11px] font-semibold tracking-wide text-[#287887] dark-teal:text-[#7CE0EF]">
                      {faq.topic}
                    </p>
                  )}
                  <span className="block font-display text-sm sm:text-base font-bold text-[#083642] dark-teal:text-[#F0F9FA]">
                    {faq.question}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                    isOpen
                      ? 'rotate-180 border-[#0D4A5A] bg-[#0D4A5A] text-white dark-teal:border-[#6FD3E3] dark-teal:bg-[#19778D] dark-teal:text-white'
                      : 'rotate-0 border-[#287887] bg-white text-[#0D4A5A] dark-teal:border-[#4EA5B7] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF]'
                  }`}
                >
                  <ArrowDown className="h-4 w-4" />
                </span>
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className={`edfic-accordion-grid ${isOpen ? 'is-open' : ''}`}
              >
                <div className="edfic-accordion-inner">
                  <div className="px-6 pb-5 pt-0.5 text-sm leading-relaxed text-[#354B54] dark-teal:text-[#D6ECEF]">
                    <p>{faq.answer}</p>
                    {faq.relatedTo && faq.relatedLabel && (
                      <div className="mt-3">
                        <Link
                          to={faq.relatedTo}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D4A5A] hover:text-[#083642] hover:underline dark-teal:text-[#7CE0EF] dark-teal:hover:text-white"
                        >
                          <span>{faq.relatedLabel}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

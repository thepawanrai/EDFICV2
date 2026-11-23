import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Baby,
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  MapPin,
  Scan,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { usePublicClinic } from '../../hooks/usePublicClinic';

const FACILITY_SUITES = [
  {
    icon: Baby,
    tag: 'Fetal Medicine Wing',
    title: 'Dedicated Obstetric & Fetal Imaging Suite',
    summary:
      'Equipped for NT Screening, Level-II Targeted Anomaly evaluation, Fetal Growth & Biometry, Biophysical Profile (BPP), and Fetal Echocardiography.',
    highlights: [
      'Morning specialist sessions led by Dr. Varun Agrawal (DNB Radiology)',
      'Structured fetal biometry and anatomical documentation',
      'Private, unhurried patient consultation room',
    ],
    ctaLabel: 'Explore Fetal Imaging',
    ctaTo: '/fetal-imaging',
  },
  {
    icon: Activity,
    tag: 'Vascular Diagnostics',
    title: 'Color & Spectral Doppler Imaging System',
    summary:
      'High-sensitivity pulsed-wave and color Doppler capabilities supporting obstetric fetoplacental, carotid, renal, scrotal, and peripheral limb evaluations.',
    highlights: [
      'Umbilical, MCA, uterine artery, and ductus venosus waveforms',
      'Renal and abdominal visceral Doppler protocols',
      'Peripheral arterial and venous duplex scanning',
    ],
    ctaLabel: 'View Doppler Studies',
    ctaTo: '/doppler-studies',
  },
  {
    icon: Scan,
    tag: 'General & Small Parts',
    title: 'Multi-Transducer Organ & MSK Suite',
    summary:
      'Dedicated convex, linear high-frequency, and endovaginal transducers supporting Abdominal, KUB, Pelvic, Breast, Thyroid, Neck, and Musculoskeletal scans.',
    highlights: [
      'High-frequency linear imaging for superficial and MSK structures',
      'Endocavitary 2D/3D pelvic and follicular evaluations',
      'Image-guided FNAC precision support',
    ],
    ctaLabel: 'General Ultrasound',
    ctaTo: '/general-ultrasound',
  },
  {
    icon: ShieldCheck,
    tag: 'Infection Control',
    title: 'Sterile Probe Hygiene & Safety Standards',
    summary:
      'Strict medical-grade transducer disinfection between every patient examination alongside single-use sterile probe covers for endocavitary and guided studies.',
    highlights: [
      'Zero ionizing radiation across ultrasound & Doppler modalities',
      'Single-use disposable sterile sheaths & clean linens',
      'Verified clinical workflow and PCPNDT Form F desk',
    ],
    ctaLabel: 'Technology & Standards',
    ctaTo: '/technology',
  },
  {
    icon: Lock,
    tag: 'Digital Privacy',
    title: 'Private Authenticated Report Vault',
    summary:
      'Finalized diagnostic PDFs are stored in access-controlled server storage and released solely inside each patient’s authenticated portal session.',
    highlights: [
      'No medical PDFs shared over open messaging links',
      'Full access audit trail and revision versioning',
      'Unified receipt and appointment tracking in Patient Portal',
    ],
    ctaLabel: 'Open Patient Portal',
    ctaTo: '/portal',
  },
  {
    icon: Clock,
    tag: 'Patient Comfort',
    title: 'Appointment-Led Sushant Golf City Centre',
    summary:
      'Scheduled time slots with advance hydration/fasting preparation notes reduce waiting times at Unit 10, Millennium Place, near Lulu Mall, Lucknow.',
    highlights: [
      'Real-time slot capacity and morning specialist coordination',
      'Pre-visit checklist for prescription and photo ID verification',
      'Accessible ground/complex location near Lulu Mall',
    ],
    ctaLabel: 'Preparation Guidelines',
    ctaTo: '/patient-info',
  },
];

export function FacilitiesPage() {
  const { data } = usePublicClinic();
  const clinic = data?.clinic;

  return (
    <PublicLayout>
      <SeoHead
        title="Clinical Facilities & Diagnostic Suites | EDFIC Lucknow"
        description="Explore EDFIC diagnostic ultrasound suites, Color & Spectral Doppler systems, sterile probe hygiene protocols, and appointment-led patient care at Sushant Golf City, Lucknow."
        canonicalPath="/facilities"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinic?.primaryPhone,
          officialEmail: clinic?.officialEmail,
        })}
      />

      <div className="bg-white">
        <section className="edfic-hero-gradient border-b border-[#DCE7E9] py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
                CLINICAL INFRASTRUCTURE · SUSHANT GOLF CITY
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#083642]">
                Diagnostic Suites &amp; Patient Facilities
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[#455A64]">
                EWA Diagnostic and Fetal Imaging Centre (EDFIC) is purpose-built for focused obstetric fetal imaging, Color Doppler evaluations, and general diagnostic ultrasonography under specialist radiologist oversight.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/book"
                  className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                >
                  <span className="relative z-10">Book Appointment</span>
                  <span className="edfic-btn-arrows" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  to="/services"
                  className="inline-flex h-11 items-center rounded-full border border-[#0D4A5A]/25 bg-white px-6 text-sm font-semibold text-[#083642] transition-colors hover:border-[#0D4A5A]"
                >
                  View Service Catalogue
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FACILITY_SUITES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex flex-col justify-between rounded-2xl border border-[#E6F0F2] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#287887] edfic-card-soft"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9F3F3] text-[#0D4A5A]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-[#287887]">{item.tag}</span>
                    </div>

                    <h2 className="mt-5 font-display text-xl font-bold text-[#083642]">
                      {item.title}
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#65747B]">
                      {item.summary}
                    </p>

                    <ul className="mt-4 space-y-2 border-t border-[#EEF4F6] pt-4">
                      {item.highlights.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2 text-xs leading-relaxed text-[#354B54]"
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#287887]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-3">
                    <Link
                      to={item.ctaTo}
                      className="edfic-link-elastic inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D4A5A]"
                    >
                      <span className="edfic-link-text">{item.ctaLabel}</span>
                      <ArrowRight className="edfic-link-icon h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-14 rounded-2xl border border-[#DCE7E9] bg-[#F6FAFB] p-6 sm:p-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D4A5A] shadow-sm">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[#083642]">
                  {clinic?.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#65747B]">
                  {clinic?.landmark || 'Near Lulu Mall'},{' '}
                  {clinic?.cityStateCountry || 'Lucknow, Uttar Pradesh, India'} ·{' '}
                  <Stethoscope className="inline h-3.5 w-3.5 text-[#287887]" /> Specialist Morning Sessions ·{' '}
                  <FileCheck2 className="inline h-3.5 w-3.5 text-[#287887]" /> Statutory PCPNDT Compliance
                </p>
              </div>
            </div>
            <Link
              to="/contact"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[#0D4A5A] bg-white px-5 text-xs font-semibold text-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white transition-colors whitespace-nowrap"
            >
              Directions &amp; Contact
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

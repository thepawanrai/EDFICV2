import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Baby,
  CalendarClock,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { LoadingSkeleton } from '../../components/ui/States';
import { usePublicClinic, usePublicServices } from '../../hooks/usePublicClinic';

const TRIMESTER_MILESTONES = [
  {
    window: '6 - 10 Weeks',
    title: 'Early Pregnancy Viability & Dating',
    detail:
      'Confirms intrauterine gestational sac location, crown-rump length dating, embryonic cardiac activity, and early multiple gestation.',
  },
  {
    window: '11 - 13+6 Weeks',
    title: 'First-Trimester NT & Nasal Bone Screening',
    detail:
      'Precision measurement of Nuchal Translucency, nasal bone evaluation, early fetal anatomy, and twin chorionicity assignment.',
  },
  {
    window: '18 - 24 Weeks',
    title: 'Level II Anomaly Scan (TIFFA) & Fetal Echo',
    detail:
      'Systematic organ-by-organ anatomical survey alongside dedicated fetal cardiac chamber, outflow tract, and rhythm assessment.',
  },
  {
    window: '28 - 40 Weeks',
    title: 'Growth Biometry, BPP & Obstetric Doppler',
    detail:
      'Serial fetal weight trends, amniotic fluid index (AFI), placental maturity, biophysical profile, and umbilical/MCA Doppler waveforms.',
  },
];

export function PrenatalScreeningPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: svcData, isLoading } = usePublicServices();

  const obstetricCategory = (svcData?.categories ?? []).find(
    (c) => c.slug === 'obstetric-fetal-imaging'
  );
  const obstetricDoppler = (svcData?.categories ?? [])
    .find((c) => c.slug === 'doppler-vascular-studies')
    ?.services.find((s) => s.slug === 'doppler-study');

  const screeningServices = [
    ...(obstetricCategory?.services ?? []),
    ...(obstetricDoppler ? [obstetricDoppler] : []),
  ];

  return (
    <PublicLayout>
      <SeoHead
        title="Prenatal Screening & Fetal Imaging | EDFIC Lucknow"
        description="Trimester-specific prenatal screening including NT Scan, Level II Anomaly Scan (TIFFA), Fetal Echocardiography, Growth Scan, BPP, and Obstetric Doppler led by Dr. Varun Agrawal at EDFIC Lucknow."
        canonicalPath="/prenatal-screening"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinicData?.clinic?.primaryPhone,
          officialEmail: clinicData?.clinic?.officialEmail,
        })}
      />

      <div className="bg-white">
        <section className="edfic-hero-gradient border-b border-[#DCE7E9] py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
                MATERNAL &amp; FETAL MEDICINE · DR. VARUN AGRAWAL (DNB RADIOLOGY)
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#083642]">
                Prenatal Screening &amp; Fetal Imaging
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[#455A64]">
                Dedicated trimester-by-trimester fetal screening, targeted anatomical anomaly surveys, fetal echocardiography, and fetoplacental Doppler studies performed during unhurried specialist morning sessions.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/book"
                  className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                >
                  <span className="relative z-10">Book Prenatal Screening</span>
                  <span className="edfic-btn-arrows" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  to="/doctor"
                  className="inline-flex h-11 items-center rounded-full border border-[#0D4A5A]/25 bg-white px-6 text-sm font-semibold text-[#083642] transition-colors hover:border-[#0D4A5A]"
                >
                  Meet Dr. Varun Agrawal
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
          {/* Trimester Roadmap */}
          <div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#287887]">
                  Gestational Milestones
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#083642]">
                  Recommended Prenatal Screening Timeline
                </h2>
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#0D4A5A]">
                <CalendarClock className="h-4 w-4 text-[#287887]" />
                <span>Specialist fetal medicine slots scheduled in morning hours</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {TRIMESTER_MILESTONES.map((stage) => (
                <div
                  key={stage.window}
                  className="rounded-xl border border-[#DCE7E9] bg-[#F8FBFC] p-5"
                >
                  <p className="font-mono-tabular text-xs font-semibold text-[#287887]">
                    {stage.window}
                  </p>
                  <h3 className="mt-1.5 font-display text-base font-bold text-[#083642]">
                    {stage.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                    {stage.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* All Obstetric & Fetal Screening Investigations */}
          <div>
            <div className="border-b border-[#DCE7E9] pb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#083642]">
                  Prenatal &amp; Fetal Screening Investigations
                </h2>
                <p className="mt-1 text-sm text-[#65747B]">
                  Select an investigation to view preparation instructions, duration, and available specialist slots.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#287887] font-medium shrink-0">
                <Baby className="h-4 w-4" />
                <span>{screeningServices.length} Approved Protocols</span>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-5">
                <LoadingSkeleton rows={4} />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {screeningServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex flex-col justify-between rounded-xl border border-[#DCE7E9] bg-white p-5 transition-colors hover:border-[#287887]"
                  >
                    <div>
                      <p className="text-xs font-mono-tabular text-[#65747B]">
                        {svc.code} · {svc.durationMinutes} min
                        {svc.requiresDoctorMorning ? ' · Morning Specialist' : ''}
                      </p>
                      <h3 className="mt-2 font-display text-base font-semibold text-[#083642]">
                        <Link
                          to={`/services/${svc.slug}`}
                          className="hover:text-[#0D4A5A]"
                        >
                          {svc.name}
                        </Link>
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                        {svc.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E9F3F3] flex items-center justify-between text-xs font-medium">
                      <Link
                        to={`/services/${svc.slug}`}
                        className="text-[#24343B] hover:text-[#0D4A5A] inline-flex items-center gap-1"
                      >
                        <span>Preparation &amp; Details</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to={`/book?service=${svc.slug}`}
                        className="text-[#0D4A5A] hover:underline"
                      >
                        Book Slot
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist & PCPNDT Compliance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#DCE7E9] bg-white p-6">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#083642]">
                <Stethoscope className="h-5 w-5 text-[#287887]" />
                <h2 className="font-display text-lg font-bold">What to Bring for Prenatal Scans</h2>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-[#455A64]">
                <li>1. Referring gynecologist or obstetrician’s signed prescription / scan requisition.</li>
                <li>2. Valid government-issued photo ID (Aadhaar Card or Passport) for statutory Form F verification.</li>
                <li>3. Earlier trimester ultrasound reports and maternal blood screening results for accurate growth comparison.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#DCE7E9] bg-[#E9F3F3] p-6">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#083642]">
                <ShieldCheck className="h-5 w-5 text-[#0D4A5A]" />
                <h2 className="font-display text-lg font-bold">PCPNDT Act Statutory Compliance</h2>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#083642]">
                EWA Diagnostic and Fetal Imaging Centre strictly adheres to the Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994. Fetal sex determination or disclosure is strictly prohibited by law and is never performed at our centre.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#0D4A5A]">
                <HeartPulse className="h-4 w-4" />
                <span>Dedicated strictly to maternal reassurance and clinical fetal health</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

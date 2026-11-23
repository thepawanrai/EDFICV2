import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Clock,
  FileCheck2,
  Scan,
  ShieldCheck,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { LoadingSkeleton } from '../../components/ui/States';
import { usePublicClinic, usePublicServices } from '../../hooks/usePublicClinic';

const USG_CATEGORY_SLUGS = [
  'general-ultrasound',
  'doppler-vascular-studies',
  'breast-imaging',
  'musculoskeletal-small-parts',
  'pelvic-transvaginal-ultrasound',
];

export function UsgScansPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: svcData, isLoading } = usePublicServices();

  const usgCategories = (svcData?.categories ?? []).filter((cat) =>
    USG_CATEGORY_SLUGS.includes(cat.slug)
  );

  return (
    <PublicLayout>
      <SeoHead
        title="USG Scans & Diagnostic Ultrasound | EDFIC Lucknow"
        description="High-resolution Abdomen, KUB, Pelvic, Breast, Thyroid, MSK, Small Parts, and Color Doppler USG scans on an appointment basis at EDFIC, Sushant Golf City, Lucknow."
        canonicalPath="/usg-scans"
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
                DIAGNOSTIC ULTRASONOGRAPHY · SUSHANT GOLF CITY
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#083642]">
                USG Scans &amp; Organ Imaging
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[#455A64]">
                Comprehensive diagnostic ultrasound and Color Doppler investigations across abdominal, urinary tract (KUB), pelvic, breast, thyroid, vascular, and musculoskeletal systems - conducted in calm, appointment-led suites.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/book"
                  className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                >
                  <span className="relative z-10">Book USG Slot</span>
                  <span className="edfic-btn-arrows" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  to="/patient-info"
                  className="inline-flex h-11 items-center rounded-full border border-[#0D4A5A]/25 bg-white px-6 text-sm font-semibold text-[#083642] transition-colors hover:border-[#0D4A5A]"
                >
                  Scan Preparation Checklist
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
          {/* Quick Preparation Summary */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FBFC] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
                <FileCheck2 className="h-4 w-4 shrink-0" />
                <span>Abdomen Scans</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                6 hours of fasting prior to scan (plain water permitted) for clear hepatobiliary and gallbladder visualization.
              </p>
            </div>
            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FBFC] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
                <Scan className="h-4 w-4 shrink-0" />
                <span>KUB &amp; Pelvis</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                Drink 3-4 glasses of water 45-60 minutes before your appointment so a full bladder acts as a clear window.
              </p>
            </div>
            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FBFC] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
                <Activity className="h-4 w-4 shrink-0" />
                <span>Color Doppler</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                Spectral and color flow evaluation for renal, carotid, portal, and peripheral arterial or venous studies.
              </p>
            </div>
            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FBFC] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Thyroid, Breast &amp; MSK</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                No fasting required. High-frequency linear probes image superficial tissues, joints, and lymph nodes clearly.
              </p>
            </div>
          </div>

          {/* Dynamic Service Categories */}
          {isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="space-y-12">
              {usgCategories.map((cat) => (
                <section key={cat.id} aria-labelledby={`usg-${cat.slug}`}>
                  <div className="border-b border-[#DCE7E9] pb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2
                        id={`usg-${cat.slug}`}
                        className="font-display text-2xl font-bold text-[#083642]"
                      >
                        {cat.name}
                      </h2>
                      <p className="mt-1 text-sm text-[#65747B]">{cat.description}</p>
                    </div>
                    <span className="text-xs font-mono-tabular font-medium text-[#287887] shrink-0">
                      {cat.services.length} {cat.services.length === 1 ? 'Investigation' : 'Investigations'}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cat.services.map((svc) => (
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
                </section>
              ))}
            </div>
          )}

          {/* Radiation-Free Safety Footer Callout */}
          <div className="rounded-2xl border border-[#DCE7E9] bg-[#E9F3F3]/60 p-6 sm:p-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0D4A5A]" />
              <div>
                <h2 className="font-display text-base font-bold text-[#083642]">
                  Zero Ionizing Radiation &amp; Sterile Transducer Protocol
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#354B54]">
                  Every diagnostic USG scan uses acoustic ultrasound waves with hospital-grade probe disinfection and private digital report delivery inside the Patient Portal.
                </p>
              </div>
            </div>
            <Link
              to="/services"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[#0D4A5A] bg-white px-5 text-xs font-semibold text-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white transition-colors whitespace-nowrap"
            >
              Full Service Catalogue
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

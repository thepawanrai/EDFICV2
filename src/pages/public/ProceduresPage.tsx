import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Microscope,
  ShieldCheck,
  Syringe,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { LoadingSkeleton } from '../../components/ui/States';
import { usePublicClinic, usePublicServices } from '../../hooks/usePublicClinic';

const PROCEDURE_SLUGS = new Set([
  'fnac-guided-ultrasound',
  'tvs-3d-scan',
  'tvs-transvaginal-scan',
  'tvs-twin-pregnancy',
  'follicular-monitoring',
  'iota-doppler',
  'chest-ultrasound',
  'head-neurosonogram',
  'b-scan-ocular-ultrasound',
]);

const PROCEDURE_PILLARS = [
  {
    icon: Syringe,
    title: 'Real-Time Ultrasound Guidance',
    description:
      'Continuous needle visualization during FNAC-guided sampling of thyroid nodules, cervical lymph nodes, breast lesions, and superficial swellings.',
  },
  {
    icon: Microscope,
    title: '3D Volumetric & Endocavitary Protocols',
    description:
      'Dedicated 3D coronal uterine reconstruction, IOTA pelvic characterization, and serial follicular monitoring for fertility and gynecological care.',
  },
  {
    icon: ShieldCheck,
    title: 'Sterile Single-Use Barrier Standards',
    description:
      'Medical-grade transducer disinfection and single-use sterile probe covers strictly enforced for every endocavitary and guided procedure.',
  },
];

export function ProceduresPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: svcData, isLoading } = usePublicServices();

  const procedureServices = (svcData?.categories ?? [])
    .flatMap((cat) =>
      cat.services.map((svc) => ({
        ...svc,
        categoryName: cat.name,
      }))
    )
    .filter((svc) => PROCEDURE_SLUGS.has(svc.slug));

  return (
    <PublicLayout>
      <SeoHead
        title="Specialized Procedures & Guided Ultrasound | EDFIC Lucknow"
        description="Ultrasound-guided FNAC, 3D TVS pelvic reconstruction, follicular monitoring, IOTA Doppler, neonatal neurosonogram, pleural ultrasound, and ophthalmic B-Scan at EDFIC Lucknow."
        canonicalPath="/procedures"
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
                SPECIALIZED &amp; IMAGE-GUIDED DIAGNOSTICS
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#083642]">
                Ultrasound Procedures &amp; Targeted Studies
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[#455A64]">
                Precision ultrasound-guided FNAC, 3D endovaginal pelvic imaging, follicular tracking, IOTA adnexal Doppler, neonatal neurosonography, and ocular B-scan procedures conducted under specialist radiologist care.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/book"
                  className="edfic-btn-slide inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                >
                  <span className="relative z-10">Schedule a Procedure</span>
                  <span className="edfic-btn-arrows" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex h-11 items-center rounded-full border border-[#0D4A5A]/25 bg-white px-6 text-sm font-semibold text-[#083642] transition-colors hover:border-[#0D4A5A]"
                >
                  Pre-Procedure Inquiry
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
          {/* Core Procedural Pillars */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PROCEDURE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-[#DCE7E9] bg-[#F8FBFC] p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0D4A5A] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 font-display text-lg font-bold text-[#083642]">
                    {pillar.title}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Specialized Procedures Grid */}
          <div>
            <div className="border-b border-[#DCE7E9] pb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#083642]">
                  Approved Diagnostic Procedures &amp; Specialized Studies
                </h2>
                <p className="mt-1 text-sm text-[#65747B]">
                  Review duration, preparation requirements, and session availability before booking.
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-medium text-[#287887] shrink-0">
                {procedureServices.length} Procedures
              </span>
            </div>

            {isLoading ? (
              <div className="mt-5">
                <LoadingSkeleton rows={4} />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {procedureServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex flex-col justify-between rounded-xl border border-[#DCE7E9] bg-white p-5 transition-colors hover:border-[#287887]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#65747B]">
                        <span className="font-mono-tabular">
                          {svc.code} · {svc.durationMinutes} min
                        </span>
                        <span className="text-[#287887] font-medium truncate">
                          {svc.categoryName}
                        </span>
                      </div>
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
                        Schedule
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pre-Procedure Guidance */}
          <div className="rounded-2xl border border-[#DCE7E9] bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2.5 text-[#083642]">
              <ClipboardCheck className="h-5 w-5 text-[#287887]" />
              <h2 className="font-display text-xl font-bold">
                Important Pre-Procedure Instructions
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 text-xs leading-relaxed text-[#455A64]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#287887]" />
                <p>
                  <strong className="text-[#083642]">FNAC-Guided Procedures:</strong> Inform reception beforehand if you take blood thinners (aspirin, clopidogrel, or anticoagulants) and carry prior thyroid, neck, or breast ultrasound films.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#287887]" />
                <p>
                  <strong className="text-[#083642]">Endovaginal / 3D TVS &amp; Follicular Scans:</strong> Empty your bladder immediately before entering the scan suite. Performed strictly with sterile disposable covers and privacy.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

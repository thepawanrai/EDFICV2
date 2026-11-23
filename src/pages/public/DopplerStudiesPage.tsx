import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Clock } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { LoadingSkeleton } from '../../components/ui/States';
import { usePublicClinic, usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

interface CmsItem {
  id: string;
  title: string;
  contentMarkdown: string;
}

export function DopplerStudiesPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: svcData, isLoading } = usePublicServices();
  const { data: cmsData } = useQuery({
    queryKey: ['public-cms', 'doppler-studies'],
    queryFn: () =>
      apiFetch<{ items: CmsItem[] }>('/api/v1/public/cms/doppler-studies'),
  });

  const categories = svcData?.categories ?? [];
  const vascularCategory = categories.find(
    (c) => c.slug === 'doppler-vascular-studies'
  );
  const obstetricDopplers =
    categories
      .find((c) => c.slug === 'obstetric-fetal-imaging')
      ?.services.filter((s) => s.name.toLowerCase().includes('doppler')) ?? [];

  const cmsItem = cmsData?.items?.[0];

  return (
    <PublicLayout>
      <SeoHead
        title="Color & Spectral Doppler Studies | EDFIC Lucknow"
        description="Obstetric, fetal, arterial, venous, carotid, renal, and portal Doppler ultrasound evaluations at EDFIC, Sushant Golf City, Lucknow."
        canonicalPath="/doppler-studies"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinicData?.clinic?.primaryPhone,
          officialEmail: clinicData?.clinic?.officialEmail,
        })}
      />

      <section className="border-b border-[#DCE7E9] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold text-[#287887]">
            Color &amp; Spectral Vascular Imaging · EDFIC Lucknow
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Doppler &amp; Vascular Ultrasound Studies
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-[#65747B]">
            Non-invasive Color and Spectral Doppler assessment of blood-flow direction, velocity waveforms, and vascular patency across obstetric, peripheral vascular, carotid, renal, and abdominal systems.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/book"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0D4A5A] px-5 text-sm font-medium text-white hover:bg-[#083642]"
            >
              <span>Book Doppler Appointment</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/fetal-imaging"
              className="inline-flex h-10 items-center rounded-md border border-[#C9D9DC] bg-white px-5 text-sm font-medium text-[#24343B] hover:border-[#0D4A5A]"
            >
              Fetal Imaging Wing
            </Link>
            <Link
              to="/general-ultrasound"
              className="inline-flex h-10 items-center rounded-md border border-[#C9D9DC] bg-white px-5 text-sm font-medium text-[#24343B] hover:border-[#0D4A5A]"
            >
              General Ultrasound
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        {cmsItem && (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-[#083642]">
              {cmsItem.title}
            </h2>
            <div className="mt-3 text-sm leading-relaxed text-[#24343B] whitespace-pre-line">
              {cmsItem.contentMarkdown}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[#DCE7E9] bg-[#E9F3F3]/60 p-5 flex items-start gap-3">
            <Activity className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-sm font-semibold text-[#083642]">
                Abdominal &amp; Renal Doppler Preparation
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#24343B]">
                Renal artery and abdomen/portal Doppler studies generally require 6 hours of fasting to minimize bowel gas interference around deeper vessels.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-[#DCE7E9] bg-[#E9F3F3]/60 p-5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-sm font-semibold text-[#083642]">
                Obstetric, Carotid &amp; Limb Doppler
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#24343B]">
                No fasting required. Obstetric and fetal Doppler studies are scheduled during Dr. Varun Agrawal&apos;s morning specialist sessions - please bring prior obstetric ultrasound reports.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <>
            {vascularCategory && (
              <section aria-labelledby="vascular-dopplers">
                <div className="border-b border-[#DCE7E9] pb-3">
                  <h2
                    id="vascular-dopplers"
                    className="font-display text-xl font-bold text-[#083642]"
                  >
                    {vascularCategory.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#65747B]">
                    {vascularCategory.description}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {vascularCategory.services.map((svc) => (
                    <div
                      key={svc.id}
                      className="flex flex-col justify-between rounded-lg border border-[#DCE7E9] bg-white p-5 transition-colors hover:border-[#287887]"
                    >
                      <div>
                        <p className="text-xs font-mono-tabular text-[#65747B]">
                          {svc.code} · {svc.durationMinutes} min
                          {svc.requiresDoctorMorning ? ' · Morning Session' : ''}
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
            )}

            {obstetricDopplers.length > 0 && (
              <section aria-labelledby="obstetric-dopplers">
                <div className="border-b border-[#DCE7E9] pb-3">
                  <h2
                    id="obstetric-dopplers"
                    className="font-display text-xl font-bold text-[#083642]"
                  >
                    Obstetric &amp; Fetal Doppler Evaluations
                  </h2>
                  <p className="mt-1 text-sm text-[#65747B]">
                    Specialist uteroplacental and fetal hemodynamic studies performed during Dr. Varun Agrawal&apos;s morning fetal medicine sessions.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {obstetricDopplers.map((svc) => (
                    <div
                      key={svc.id}
                      className="flex flex-col justify-between rounded-lg border border-[#DCE7E9] bg-white p-5 transition-colors hover:border-[#287887]"
                    >
                      <div>
                        <p className="text-xs font-mono-tabular text-[#65747B]">
                          {svc.code} · {svc.durationMinutes} min · Morning Specialist
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
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

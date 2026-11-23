import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, FileCheck2 } from 'lucide-react';
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

const GENERAL_CATEGORY_SLUGS = [
  'general-ultrasound',
  'breast-imaging',
  'musculoskeletal-small-parts',
  'pelvic-transvaginal-ultrasound',
  'other-specialized-ultrasound',
];

export function GeneralUltrasoundPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: svcData, isLoading } = usePublicServices();
  const { data: cmsData } = useQuery({
    queryKey: ['public-cms', 'general-ultrasound'],
    queryFn: () =>
      apiFetch<{ items: CmsItem[] }>('/api/v1/public/cms/general-ultrasound'),
  });

  const generalCategories = (svcData?.categories ?? []).filter((cat) =>
    GENERAL_CATEGORY_SLUGS.includes(cat.slug)
  );
  const cmsItem = cmsData?.items?.[0];

  return (
    <PublicLayout>
      <SeoHead
        title="General Ultrasound & Organ Imaging | EDFIC Lucknow"
        description="Abdominal, KUB, pelvic, breast, thyroid, small parts, and musculoskeletal diagnostic ultrasound services at EDFIC, Sushant Golf City, Lucknow."
        canonicalPath="/general-ultrasound"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinicData?.clinic?.primaryPhone,
          officialEmail: clinicData?.clinic?.officialEmail,
        })}
      />

      <section className="border-b border-[#DCE7E9] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold text-[#287887]">
            EDFIC Diagnostic Wing · A Unit of EWA DERMA
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            General Ultrasound &amp; Organ Imaging
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-[#65747B]">
            Comprehensive diagnostic ultrasonography across abdominal, urinary tract (KUB), pelvic, breast, small-parts, and musculoskeletal regions - performed on an appointment basis with standardized clinical reporting.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/book"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0D4A5A] px-5 text-sm font-medium text-white hover:bg-[#083642]"
            >
              <span>Schedule Ultrasound Slot</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/patient-info"
              className="inline-flex h-10 items-center rounded-md border border-[#C9D9DC] bg-white px-5 text-sm font-medium text-[#24343B] hover:border-[#0D4A5A]"
            >
              Preparation Checklist
            </Link>
            <Link
              to="/doppler-studies"
              className="inline-flex h-10 items-center rounded-md border border-[#C9D9DC] bg-white px-5 text-sm font-medium text-[#24343B] hover:border-[#0D4A5A]"
            >
              View Doppler Studies
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

        {/* Preparation Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
              <FileCheck2 className="h-4 w-4" />
              <span>Whole Abdomen / Upper Abdomen</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
              Typically requires 6 hours of fasting prior to the examination (plain water is permitted unless instructed otherwise).
            </p>
          </div>
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
              <FileCheck2 className="h-4 w-4" />
              <span>KUB &amp; Transabdominal Pelvis</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
              Drink 3–4 glasses of water 45–60 minutes before your slot and hold urine so the urinary bladder provides a clear acoustic window.
            </p>
          </div>
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0D4A5A]">
              <Clock className="h-4 w-4" />
              <span>TVS, Neck, Thyroid, Breast &amp; MSK</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
              No fasting is needed. For transvaginal studies, an empty bladder is required immediately before entering the scan suite.
            </p>
          </div>
        </div>

        {/* Dynamic Catalogue Categories */}
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <div className="space-y-10">
            {generalCategories.map((cat) => (
              <section key={cat.id} aria-labelledby={`cat-${cat.slug}`}>
                <div className="border-b border-[#DCE7E9] pb-3">
                  <h2
                    id={`cat-${cat.slug}`}
                    className="font-display text-xl font-bold text-[#083642]"
                  >
                    {cat.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#65747B]">{cat.description}</p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {cat.services.map((svc) => (
                    <div
                      key={svc.id}
                      className="flex flex-col justify-between rounded-lg border border-[#DCE7E9] bg-white p-5 transition-colors hover:border-[#287887]"
                    >
                      <div>
                        <p className="text-xs font-mono-tabular text-[#65747B]">
                          {svc.code} · {svc.durationMinutes} min
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
      </div>
    </PublicLayout>
  );
}

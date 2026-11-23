import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

interface CmsItem {
  id: string;
  title: string;
  contentMarkdown: string;
}

export function FetalImagingPage() {
  const { data: cmsData } = useQuery({
    queryKey: ['public-cms', 'fetal-imaging'],
    queryFn: () => apiFetch<{ items: CmsItem[] }>('/api/v1/public/cms/fetal-imaging'),
  });
  const { data: svcData } = usePublicServices();

  const fetalCategory = svcData?.categories.find(
    (c) => c.slug === 'obstetric-fetal-imaging'
  );
  const cmsItem = cmsData?.items?.[0];

  return (
    <PublicLayout>
      <SeoHead
        title="Fetal Imaging & Obstetric Ultrasound | EDFIC Lucknow"
        description="Specialist NT Scan, Anomaly Scan (Level II), Growth Scan, Fetal Echocardiography, BPP, and Obstetric Doppler evaluations led by Dr. Varun Agrawal at EDFIC Lucknow."
        canonicalPath="/fetal-imaging"
        structuredData={buildClinicJsonLd()}
      />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div>
          <p className="text-xs font-semibold text-[#287887]">
            Specialist Fetal Medicine · Dr. Varun Agrawal (DNB Radiology)
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Fetal Imaging &amp; Obstetric Ultrasound
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-[#65747B]">
            Trimester-specific fetal screening, anomaly evaluation, fetal echocardiography, and obstetric Doppler examinations performed during daily morning specialist sessions.
          </p>
        </div>

        {cmsItem && (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-[#083642]">
              {cmsItem.title}
            </h2>
            <div className="mt-4 text-sm leading-relaxed text-[#24343B] whitespace-pre-line">
              {cmsItem.contentMarkdown}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-display text-xl font-bold text-[#083642]">
            Obstetric &amp; Fetal Investigations
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {(fetalCategory?.services ?? []).map((svc) => (
              <div
                key={svc.id}
                className="rounded-lg border border-[#DCE7E9] bg-white p-5 flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs text-[#65747B] font-mono-tabular">
                    {svc.code} · {svc.durationMinutes} min
                    {svc.requiresDoctorMorning ? ' · Morning Specialist Session' : ''}
                  </p>
                  <h3 className="mt-1.5 font-display text-base font-semibold text-[#083642]">
                    <Link to={`/services/${svc.slug}`} className="hover:text-[#0D4A5A]">
                      {svc.name}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#65747B]">
                    {svc.summary}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-medium pt-3 border-t border-[#E9F3F3]">
                  <Link to={`/services/${svc.slug}`} className="text-[#24343B] hover:text-[#0D4A5A]">
                    Preparation Details
                  </Link>
                  <Link to={`/book?service=${svc.slug}`} className="text-[#0D4A5A] hover:underline">
                    Book Slot
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#DCE7E9] bg-[#E9F3F3] p-6 text-xs leading-relaxed text-[#083642]">
          <p className="font-semibold">PCPNDT Act Statutory Notice</p>
          <p className="mt-1">
            EWA Diagnostic and Fetal Imaging Centre strictly complies with the Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994. Sex determination or gender prediction of the fetus is strictly prohibited by law and is never performed or disclosed at this centre.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

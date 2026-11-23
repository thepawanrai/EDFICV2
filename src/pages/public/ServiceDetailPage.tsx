import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, FileCheck2 } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { apiFetch } from '../../lib/api';
import { FALLBACK_PUBLIC_CATEGORIES } from '../../lib/publicCatalogFallback';

interface ServiceDetail {
  id: string;
  slug: string;
  code: string;
  name: string;
  summary: string;
  clinicalDescription: string;
  preparationNotes: string;
  durationMinutes: number;
  requiresDoctorMorning: boolean;
  category: {
    id: string;
    slug: string;
    name: string;
  };
}

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-service', slug],
    queryFn: async () => {
      try {
        return await apiFetch<{ service: ServiceDetail }>(`/api/v1/public/services/${slug}`);
      } catch (err) {
        for (const cat of FALLBACK_PUBLIC_CATEGORIES) {
          const match = cat.services.find((s) => s.slug === slug);
          if (match) {
            return {
              service: {
                ...match,
                category: { id: cat.id, slug: cat.slug, name: cat.name },
              },
            };
          }
        }
        throw err;
      }
    },
    enabled: Boolean(slug),
    retry: 1,
  });

  const svc = data?.service;

  return (
    <PublicLayout>
      <SeoHead
        title={
          svc
            ? `${svc.name} | EDFIC Lucknow`
            : 'Diagnostic Service Details | EDFIC Lucknow'
        }
        description={
          svc
            ? `${svc.summary} Preparation guidelines and appointment scheduling at EDFIC, Sushant Golf City, Lucknow.`
            : 'View preparation instructions and clinical details for diagnostic ultrasound investigations at EDFIC Lucknow.'
        }
        canonicalPath={slug ? `/services/${slug}` : '/services'}
        structuredData={
          svc
            ? {
                '@context': 'https://schema.org',
                '@type': 'MedicalProcedure',
                name: svc.name,
                code: {
                  '@type': 'MedicalCode',
                  codeValue: svc.code,
                },
                description: svc.clinicalDescription,
                preparation: svc.preparationNotes,
                howPerformed: svc.summary,
              }
            : undefined
        }
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D4A5A] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Diagnostic Services</span>
        </Link>

        {isLoading ? (
          <div className="mt-6 h-72 rounded-lg border border-[#DCE7E9] bg-white animate-pulse" />
        ) : isError || !svc ? (
          <div className="mt-6 rounded-lg border border-[#DCE7E9] bg-white p-8">
            <h1 className="font-display text-xl font-bold text-[#083642]">
              Service Information Unavailable
            </h1>
            <p className="mt-2 text-sm text-[#65747B]">
              The requested diagnostic service could not be located in the public catalogue.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
              <p className="text-xs text-[#65747B]">
                <span>{svc.category.name}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono-tabular">{svc.code}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono-tabular">{svc.durationMinutes} minutes</span>
              </p>
              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#083642]">
                {svc.name}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[#24343B]">
                {svc.summary}
              </p>

              <div className="mt-6 border-t border-[#DCE7E9] pt-6 space-y-5">
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#083642]">
                    Clinical Scope
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#65747B]">
                    {svc.clinicalDescription}
                  </p>
                </div>

                <div className="rounded-md bg-[#E9F3F3]/70 p-4">
                  <div className="flex items-start gap-3">
                    <FileCheck2 className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
                    <div>
                      <h2 className="font-display text-sm font-semibold text-[#083642]">
                        Patient Preparation Instructions
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-[#24343B]">
                        {svc.preparationNotes}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-[#0D4A5A] mt-1 shrink-0" />
                    <div>
                      <p className="font-medium text-[#24343B]">Typical Slot Duration</p>
                      <p className="text-xs text-[#65747B] font-mono-tabular">
                        {svc.durationMinutes} minutes per appointment
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Calendar className="h-4 w-4 text-[#0D4A5A] mt-1 shrink-0" />
                    <div>
                      <p className="font-medium text-[#24343B]">Session Availability</p>
                      <p className="text-xs text-[#65747B]">
                        {svc.requiresDoctorMorning
                          ? 'Morning specialist session (Dr. Varun Agrawal, DNB Radiology)'
                          : 'Available during clinic hours (Mon–Sat 9 AM–8 PM; Sun by appointment)'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-[#DCE7E9] pt-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-[#65747B]">
                  Bring your referring clinician prescription and valid photo ID (required for obstetric studies under PCPNDT rules).
                </p>
                <Link
                  to={`/book?service=${svc.slug}`}
                  className="inline-flex h-10 items-center rounded-md bg-[#0D4A5A] px-6 text-sm font-medium text-white hover:bg-[#083642] whitespace-nowrap"
                >
                  Book This Investigation
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

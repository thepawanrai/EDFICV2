import { useQuery } from '@tanstack/react-query';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { apiFetch } from '../../lib/api';

interface CmsItem {
  id: string;
  title: string;
  contentMarkdown: string;
  publishedAt: string | null;
}

export function LegalPolicyPage({
  pageKey,
  fallbackTitle,
  fallbackContent,
}: {
  pageKey: 'privacy-policy' | 'terms-of-use' | 'patient-consent' | 'disclaimer';
  fallbackTitle: string;
  fallbackContent?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['public-cms', pageKey],
    queryFn: () => apiFetch<{ items: CmsItem[] }>(`/api/v1/public/cms/${pageKey}`),
  });

  const item = data?.items?.[0];
  const resolvedContent = item?.contentMarkdown || fallbackContent;

  return (
    <PublicLayout>
      <SeoHead
        title={`${item?.title || fallbackTitle} | EDFIC Lucknow`}
        description={`${fallbackTitle} for EWA Diagnostic and Fetal Imaging Centre (EDFIC), A Unit of EWA DERMA, Sushant Golf City, Lucknow.`}
        canonicalPath={`/${pageKey}`}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold text-[#287887]">
          EDFIC Governance &amp; Legal · A Unit of EWA DERMA
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#083642]">
          {item?.title || fallbackTitle}
        </h1>

        <div className="mt-8 rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
          {isLoading ? (
            <div className="h-40 animate-pulse bg-[#F8FAFA] rounded" />
          ) : resolvedContent ? (
            <div className="text-sm leading-relaxed text-[#24343B] whitespace-pre-line">
              {resolvedContent}
            </div>
          ) : (
            <p className="text-sm text-[#65747B]">
              Policy documentation is currently under administrative review.
            </p>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

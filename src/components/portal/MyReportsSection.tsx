import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, FileText, Lock, RefreshCw, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import { formatDateTimeDisplay } from '../../lib/utils';

export interface MyReportItem {
  id: string;
  reportCode: string;
  title: string;
  revisionNumber: number;
  fileName: string;
  fileSizeBytes: number;
  publishedAt: string | null;
  visit: {
    visitNumber: string;
    appointment: {
      bookingReference: string;
      service: { name: string };
    };
  };
  reviewedBy: { fullName: string } | null;
}

interface MyReportsResponse {
  reports: MyReportItem[];
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MyReportsSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => apiFetch<MyReportsResponse>('/api/v1/reports/my-reports'),
  });

  const reports = data?.reports ?? [];

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((rpt) =>
      [
        rpt.reportCode,
        rpt.title,
        rpt.visit.visitNumber,
        rpt.visit.appointment.bookingReference,
        rpt.visit.appointment.service.name,
        rpt.reviewedBy?.fullName || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [reports, searchQuery]);

  const handleDownloadPdf = async (rpt: MyReportItem) => {
    setDownloadError(null);
    setDownloadingId(rpt.id);
    try {
      await downloadAuthenticatedFile(
        `/api/v1/reports/${rpt.id}/download`,
        `${rpt.reportCode}-rev${rpt.revisionNumber}.pdf`
      );
    } catch (err: unknown) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Unable to download PDF report right now. Please try again.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section
      aria-labelledby="my-reports-heading"
      className="rounded-xl border border-[#DCE7E9] bg-white overflow-hidden"
    >
      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-[#E6F0F2] bg-[#FAFDFE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#287887]">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Authenticated Diagnostic Vault</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'}
            </span>
          </div>
          <h2
            id="my-reports-heading"
            className="mt-1 font-display text-xl font-bold text-[#083642]"
          >
            My Reports
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#65747B]"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search report ID, scan, visit..."
              aria-label="Filter diagnostic reports"
              className="h-9 pl-8 text-xs"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {downloadError && (
        <div
          role="alert"
          className="border-b border-[#B42318]/25 bg-[#FEF3F2] px-5 py-3 text-xs text-[#B42318] sm:px-6"
        >
          {downloadError}
        </div>
      )}

      {/* Table Body States */}
      {isLoading ? (
        <div className="divide-y divide-[#EEF4F6]">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="h-4 w-28 rounded bg-[#EEF4F6] animate-pulse" />
              <div className="h-4 w-56 rounded bg-[#EEF4F6] animate-pulse" />
              <div className="hidden sm:block h-4 w-32 rounded bg-[#EEF4F6] animate-pulse" />
              <div className="h-8 w-28 rounded bg-[#EEF4F6] animate-pulse" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="px-6 py-8 text-center space-y-3">
          <p className="text-sm font-medium text-[#B42318]">
            {error instanceof Error
              ? error.message
              : 'Unable to load your diagnostic reports right now.'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry Loading Reports
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <div className="px-6 py-10 text-center space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#E9F3F3] text-[#0D4A5A]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-[#083642]">
              No published diagnostic reports yet
            </p>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-[#65747B]">
              Finalized diagnostic PDFs appear here automatically once reviewed and published by Dr. Varun Agrawal. Reports are never exposed on public links.
            </p>
          </div>
          <div className="pt-1">
            <Link
              to="/book"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#0D4A5A] px-4 text-xs font-medium text-white hover:bg-[#083642] whitespace-nowrap"
            >
              Book New Investigation
            </Link>
          </div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="px-6 py-8 text-center space-y-2">
          <p className="text-xs text-[#65747B]">
            No diagnostic reports matched "{searchQuery}".
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-[#0D4A5A] underline underline-offset-4 cursor-pointer"
          >
            Clear search filter
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E6F0F2] bg-[#F8FAFA] text-[11px] font-semibold uppercase tracking-wider text-[#65747B]">
                <th scope="col" className="py-3 pl-5 pr-3 sm:pl-6">
                  Report ID
                </th>
                <th scope="col" className="px-3 py-3">
                  Report &amp; Investigation
                </th>
                <th scope="col" className="px-3 py-3">
                  Reviewed By
                </th>
                <th scope="col" className="px-3 py-3">
                  Published Date
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Size
                </th>
                <th scope="col" className="py-3 pl-3 pr-5 text-right sm:pr-6">
                  PDF Document
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F6]">
              {filteredReports.map((rpt) => {
                const isDownloading = downloadingId === rpt.id;
                return (
                  <tr
                    key={rpt.id}
                    className="transition-colors hover:bg-[#F7FBFC]"
                  >
                    <td className="py-3.5 pl-5 pr-3 align-middle sm:pl-6 whitespace-nowrap">
                      <p className="font-mono-tabular font-semibold text-[#0D4A5A]">
                        {rpt.reportCode}
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-[11px] text-[#65747B]">
                        Rev {rpt.revisionNumber}
                      </p>
                    </td>

                    <td className="px-3 py-3.5 align-middle">
                      <p className="font-medium text-sm text-[#083642]">
                        {rpt.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#65747B]">
                        {rpt.visit.appointment.service.name} · Visit{' '}
                        <span className="font-mono-tabular">{rpt.visit.visitNumber}</span>
                      </p>
                    </td>

                    <td className="px-3 py-3.5 align-middle text-[#354B54] whitespace-nowrap">
                      {rpt.reviewedBy?.fullName || 'Dr. Varun Agrawal'}
                    </td>

                    <td className="px-3 py-3.5 align-middle font-mono-tabular text-[#455A64] whitespace-nowrap">
                      {formatDateTimeDisplay(rpt.publishedAt)}
                    </td>

                    <td className="px-3 py-3.5 align-middle text-right font-mono-tabular text-[#65747B] whitespace-nowrap">
                      {formatFileSize(rpt.fileSizeBytes)}
                    </td>

                    <td className="py-3.5 pl-3 pr-5 align-middle text-right sm:pr-6 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(rpt)}
                        disabled={isDownloading}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#0D4A5A]/25 bg-[#E9F3F3] px-3.5 text-xs font-semibold text-[#0D4A5A] transition-colors hover:bg-[#0D4A5A] hover:text-white disabled:opacity-60 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

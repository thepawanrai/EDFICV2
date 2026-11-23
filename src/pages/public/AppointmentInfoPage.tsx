import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Clock, FileText, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { usePublicClinic } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

interface CmsItem {
  id: string;
  title: string;
  contentMarkdown: string;
}

export function AppointmentInfoPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: cmsData } = useQuery({
    queryKey: ['public-cms', 'appointment-info'],
    queryFn: () =>
      apiFetch<{ items: CmsItem[] }>('/api/v1/public/cms/appointment-info'),
  });

  const clinic = clinicData?.clinic;
  const doctor = clinicData?.doctor;
  const cmsItem = cmsData?.items?.[0];

  return (
    <PublicLayout>
      <SeoHead
        title="Appointment Guidelines & Scheduling | EDFIC Lucknow"
        description="Learn how appointment scheduling, morning specialist sessions, check-in documentation, and secure report delivery work at EDFIC, Sushant Golf City, Lucknow."
        canonicalPath="/appointment-info"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinic?.primaryPhone,
          officialEmail: clinic?.officialEmail,
        })}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#DCE7E9] pb-8">
          <div>
            <p className="text-xs font-semibold text-[#287887]">
              Appointment Process · EDFIC Lucknow
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
              Appointment Information &amp; Visit Flow
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-[#65747B]">
              EDFIC operates an appointment-based schedule to minimize waiting times and ensure adequate clinical duration for every diagnostic examination.
            </p>
          </div>
          <Link
            to="/book"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[#0D4A5A] px-6 text-sm font-medium text-white hover:bg-[#083642] whitespace-nowrap shrink-0"
          >
            <span>Book Time Slot</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#0D4A5A]">
              <Clock className="h-5 w-5" />
              <h2 className="font-display text-lg font-semibold text-[#083642]">
                Clinic &amp; Specialist Session Hours
              </h2>
            </div>
            <div className="text-sm text-[#65747B] space-y-1.5">
              <p>
                <strong className="text-[#24343B]">Monday–Saturday:</strong>{' '}
                {clinic?.weekdayHours || '9:00 AM – 8:00 PM'}
              </p>
              <p>
                <strong className="text-[#24343B]">Sunday:</strong>{' '}
                {clinic?.sundayHours || '10:00 AM – 2:00 PM (By Appointment)'}
              </p>
              <p>
                <strong className="text-[#24343B]">Specialist Fetal &amp; Doppler Session:</strong>{' '}
                {doctor?.availability || 'Morning session, daily'} ({doctor?.name || 'Dr. Varun Agrawal'}, {doctor?.qualification || 'DNB Radiology'})
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#0D4A5A]">
              <CalendarCheck2 className="h-5 w-5" />
              <h2 className="font-display text-lg font-semibold text-[#083642]">
                Slot Reservation &amp; Advance Verification
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-[#65747B]">
              After selecting an available slot online, a temporary hold protects your chosen time window while you submit patient details. Once a booking reference (<span className="font-mono-tabular">EDF-...</span>) is issued, you may submit your UPI advance UTR reference for manual verification by EDFIC reception staff before final slot confirmation.
            </p>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#0D4A5A]">
              <FileText className="h-5 w-5" />
              <h2 className="font-display text-lg font-semibold text-[#083642]">
                What to Bring at Check-In
              </h2>
            </div>
            <ul className="list-disc pl-5 text-sm text-[#65747B] space-y-1">
              <li>Referring clinician&apos;s signed prescription or antenatal record.</li>
              <li>Valid government-issued photo ID (mandatory for obstetric scans).</li>
              <li>Previous ultrasound films/reports for clinical comparison.</li>
              <li>Please arrive 15 minutes early if bladder filling or Form F registration is required.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#0D4A5A]">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-display text-lg font-semibold text-[#083642]">
                Rescheduling, Cancellation &amp; Reports
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-[#65747B]">
              Patients can track, reschedule, or cancel upcoming appointments directly through the authenticated{' '}
              <Link to="/portal" className="text-[#0D4A5A] underline">
                Patient Portal
              </Link>{' '}
              or by contacting reception via the{' '}
              <Link to="/contact" className="text-[#0D4A5A] underline">
                Contact page
              </Link>
              . Finalized diagnostic PDFs are published only inside the authenticated portal.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[#DCE7E9] bg-[#E9F3F3] p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              Need to check preparation notes first?
            </h2>
            <p className="mt-1 text-sm text-[#24343B]">
              Browse scan-specific fasting and bladder guidelines in our diagnostic service catalogue.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/services"
              className="inline-flex h-10 items-center rounded-md border border-[#0D4A5A] bg-white px-4 text-sm font-medium text-[#0D4A5A] hover:bg-[#F8FAFA]"
            >
              Browse Services
            </Link>
            <Link
              to="/book"
              className="inline-flex h-10 items-center rounded-md bg-[#0D4A5A] px-5 text-sm font-medium text-white hover:bg-[#083642]"
            >
              Proceed to Booking
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

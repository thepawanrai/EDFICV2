import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { PatientPortalLayout } from '../../components/layout/PatientPortalLayout';
import { MyReportsSection } from '../../components/portal/MyReportsSection';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatInr,
  humanizeStatus,
} from '../../lib/utils';

interface PortalResponse {
  patient: {
    id: string;
    patientCode: string;
    fullName: string;
    phone: string;
    email: string | null;
    dateOfBirth: string | null;
    consentAccepted: boolean;
    consentTimestamp: string | null;
  } | null;
  appointments: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    service: {
      id: string;
      name: string;
      durationMinutes?: number;
      preparationNotes: string;
      advanceAmountInr: number;
    };
    payments: Array<{
      id: string;
      receiptNumber: string | null;
      utrReference: string;
      amountSubmittedInr: number;
      status: string;
    }>;
  }>;
  visits: Array<{
    id: string;
    visitNumber: string;
    checkedInAt: string;
    completedAt: string | null;
    status: string;
    appointment: {
      bookingReference: string;
      service: { name: string };
    };
  }>;
  reports: Array<{
    id: string;
    reportCode: string;
    title: string;
    revisionNumber: number;
    fileName: string;
    fileSizeBytes: number;
    publishedAt: string | null;
    visit: { visitNumber: string };
  }>;
  upiConfig?: {
    upiId: string;
    upiMerchantName: string;
    defaultAdvanceAmountInr: number;
  } | null;
}

type PortalTab = 'overview' | 'reports' | 'appointments' | 'profile';

export function PatientPortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('10:00');
  const [utrFormApptId, setUtrFormApptId] = useState<string | null>(null);
  const [utrReference, setUtrReference] = useState('');
  const [utrAmount, setUtrAmount] = useState('');
  const [utrDate, setUtrDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patient-portal'],
    queryFn: () => apiFetch<PortalResponse>('/api/v1/patients/me/portal'),
  });

  const appointments = data?.appointments ?? [];
  const visits = data?.visits ?? [];
  const reports = data?.reports ?? [];

  const summaryStats = useMemo(() => {
    const activeBookings = appointments.filter(
      (a) => !['CANCELLED', 'COMPLETED'].includes(a.status)
    ).length;
    const pendingAdvance = appointments.filter((a) =>
      ['PENDING_ADVANCE', 'ADVANCE_SUBMITTED'].includes(a.status)
    ).length;
    return {
      reportsCount: reports.length,
      activeBookings,
      visitsCount: visits.length,
      pendingAdvance,
    };
  }, [appointments, visits.length, reports.length]);

  const handleCancel = async (id: string) => {
    setActionErr(null);
    setActionMsg(null);
    try {
      await apiFetch(`/api/v1/appointments/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Cancelled by patient via portal' }),
      });
      setActionMsg('Appointment cancelled.');
      await queryClient.invalidateQueries({ queryKey: ['patient-portal'] });
    } catch (err: unknown) {
      setActionErr(err instanceof Error ? err.message : 'Unable to cancel.');
    }
  };

  const handleReschedule = async (id: string) => {
    setActionErr(null);
    setActionMsg(null);
    try {
      await apiFetch(`/api/v1/appointments/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ date: newDate, startTime: newTime }),
      });
      setRescheduleId(null);
      setActionMsg('Appointment rescheduled.');
      await queryClient.invalidateQueries({ queryKey: ['patient-portal'] });
    } catch (err: unknown) {
      setActionErr(err instanceof Error ? err.message : 'Unable to reschedule.');
    }
  };

  const handleSubmitUtr = async (appt: PortalResponse['appointments'][number]) => {
    if (!data?.patient?.phone) {
      setActionErr('Patient phone number is unavailable on this profile.');
      return;
    }
    setActionErr(null);
    setActionMsg(null);
    setSubmittingUtr(true);
    try {
      await apiFetch('/api/v1/payments/submit-utr', {
        method: 'POST',
        body: JSON.stringify({
          bookingReference: appt.bookingReference,
          phone: data.patient.phone,
          utrReference: utrReference.trim(),
          amountSubmittedInr: Number(
            utrAmount || appt.service.advanceAmountInr || data.upiConfig?.defaultAdvanceAmountInr || 500
          ),
          paymentDate: utrDate,
        }),
      });
      setUtrFormApptId(null);
      setUtrReference('');
      setActionMsg(
        `UTR reference submitted for ${appt.bookingReference}. Reception will verify and confirm your slot shortly.`
      );
      await queryClient.invalidateQueries({ queryKey: ['patient-portal'] });
    } catch (err: unknown) {
      setActionErr(err instanceof Error ? err.message : 'Unable to submit UTR reference.');
    } finally {
      setSubmittingUtr(false);
    }
  };

  const renderAppointmentsBlock = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-[#083642]">
          Appointments &amp; UPI Advance History
        </h2>
        <Link
          to="/book"
          className="text-xs font-semibold text-[#0D4A5A] underline underline-offset-4 hover:text-[#083642]"
        >
          + Schedule New Scan
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-xl border border-[#DCE7E9] bg-white p-6 text-xs text-[#65747B] space-y-3">
          <p>You have no scheduled appointments yet.</p>
          <Link
            to="/book"
            className="inline-flex h-9 items-center rounded-md bg-[#0D4A5A] px-4 text-xs font-medium text-white hover:bg-[#083642]"
          >
            Book Appointment
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const expectedAdvance =
              appt.service.advanceAmountInr || data?.upiConfig?.defaultAdvanceAmountInr || 500;
            const canSubmitUtr = appt.status === 'PENDING_ADVANCE';

            return (
              <div
                key={appt.id}
                className="rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-tabular text-xs text-[#287887]">
                      {appt.bookingReference} · {humanizeStatus(appt.status)}
                    </p>
                    <h3 className="mt-0.5 font-display text-base font-semibold text-[#083642]">
                      {appt.service.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-mono-tabular text-[#65747B]">
                      {formatDateDisplay(appt.appointmentDate)} · {appt.startTime}–
                      {appt.endTime}
                      {appt.service.durationMinutes
                        ? ` (${appt.service.durationMinutes} min)`
                        : ''}
                    </p>
                  </div>

                  {!['CANCELLED', 'COMPLETED'].includes(appt.status) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {canSubmitUtr && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setUtrFormApptId(utrFormApptId === appt.id ? null : appt.id);
                            setUtrAmount(String(expectedAdvance));
                          }}
                        >
                          Submit UTR
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRescheduleId(rescheduleId === appt.id ? null : appt.id);
                          setNewDate(appt.appointmentDate);
                          setNewTime(appt.startTime);
                        }}
                      >
                        Reschedule
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(appt.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {appt.service.preparationNotes &&
                  !['CANCELLED', 'COMPLETED'].includes(appt.status) && (
                    <div className="rounded-lg border border-[#E6F0F2] bg-[#F8FAFA] px-3.5 py-2.5 text-xs text-[#354B54]">
                      <span className="font-semibold text-[#083642]">Scan Preparation:</span>{' '}
                      {appt.service.preparationNotes}
                    </div>
                  )}

                {utrFormApptId === appt.id && (
                  <div className="rounded-lg border border-[#DCE7E9] bg-[#F6FAFB] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#24343B]">
                      <span>
                        UPI ID:{' '}
                        <strong className="font-mono-tabular text-[#083642]">
                          {data?.upiConfig?.upiId || 'edfic.lucknow@upi'}
                        </strong>
                      </span>
                      <span className="font-mono-tabular text-[#287887]">
                        Expected Advance: {formatInr(expectedAdvance)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] font-medium mb-1">
                          UPI UTR / Transaction Ref
                        </label>
                        <Input
                          value={utrReference}
                          onChange={(e) => setUtrReference(e.target.value)}
                          placeholder="e.g. 432819048210"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium mb-1">
                          Amount Paid (INR)
                        </label>
                        <Input
                          type="number"
                          value={utrAmount}
                          onChange={(e) => setUtrAmount(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium mb-1">
                          Payment Date
                        </label>
                        <Input
                          type="date"
                          value={utrDate}
                          onChange={(e) => setUtrDate(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={submittingUtr || utrReference.trim().length < 6}
                        onClick={() => handleSubmitUtr(appt)}
                      >
                        {submittingUtr ? 'Submitting...' : 'Submit Advance Reference'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setUtrFormApptId(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}

                {rescheduleId === appt.id && (
                  <div className="rounded-md bg-[#F8FAFA] border border-[#DCE7E9] p-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-[11px] font-medium mb-1">New Date</label>
                      <Input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1">
                        Start Time (HH:MM)
                      </label>
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleReschedule(appt.id)}
                    >
                      Save Slot
                    </Button>
                  </div>
                )}

                {appt.payments.length > 0 && (
                  <div className="border-t border-[#E9F3F3] pt-2.5 text-xs space-y-1">
                    {appt.payments.map((pay) => (
                      <p key={pay.id} className="font-mono-tabular text-[#24343B]">
                        UTR {pay.utrReference} · {formatInr(pay.amountSubmittedInr)} ·{' '}
                        {humanizeStatus(pay.status)}
                        {pay.receiptNumber ? ` · Receipt ${pay.receiptNumber}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderVisitsBlock = () => (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-[#083642]">
        Clinical Visit History
      </h2>
      {visits.length === 0 ? (
        <div className="rounded-xl border border-[#DCE7E9] bg-white p-5 text-xs text-[#65747B]">
          No completed or checked-in visits recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border border-[#DCE7E9] bg-white divide-y divide-[#E9F3F3] text-xs">
          {visits.map((v) => (
            <div key={v.id} className="p-4 space-y-1">
              <p className="font-mono-tabular text-[#287887]">
                {v.visitNumber} · {v.appointment.bookingReference} ·{' '}
                {humanizeStatus(v.status)}
              </p>
              <p className="font-medium text-[#083642]">{v.appointment.service.name}</p>
              <p className="text-[#65747B]">
                Checked in: {formatDateTimeDisplay(v.checkedInAt)}
                {v.completedAt ? ` · Completed: ${formatDateTimeDisplay(v.completedAt)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPatientProfileBlock = () => (
    <div className="rounded-xl border border-[#DCE7E9] bg-white p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-[#E6F0F2] pb-4">
        <div>
          <p className="text-xs font-semibold text-[#287887]">Patient Record &amp; Consent</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-[#083642]">
            {data?.patient?.fullName || user?.fullName}
          </h2>
        </div>
        <UserCheck className="h-5 w-5 text-[#287887] shrink-0" aria-hidden="true" />
      </div>

      {data?.patient ? (
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[#65747B]">Patient ID</dt>
            <dd className="mt-1 font-mono-tabular font-semibold text-[#083642]">
              {data.patient.patientCode}
            </dd>
          </div>
          <div>
            <dt className="text-[#65747B]">Registered Mobile</dt>
            <dd className="mt-1 font-mono-tabular font-semibold text-[#083642]">
              {data.patient.phone}
            </dd>
          </div>
          <div>
            <dt className="text-[#65747B]">Email Address</dt>
            <dd className="mt-1 font-medium text-[#083642]">
              {data.patient.email || user?.email || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#65747B]">Date of Birth</dt>
            <dd className="mt-1 font-mono-tabular font-medium text-[#083642]">
              {data.patient.dateOfBirth ? formatDateDisplay(data.patient.dateOfBirth) : 'Not recorded'}
            </dd>
          </div>
          <div className="sm:col-span-2 rounded-lg border border-[#E6F0F2] bg-[#F8FAFA] p-3.5">
            <div className="flex items-center gap-2 text-[#083642] font-semibold">
              <ShieldCheck className="h-4 w-4 text-[#287887]" aria-hidden="true" />
              <span>PCPNDT &amp; Clinical Privacy Consent</span>
            </div>
            <p className="mt-1 text-[#455A64]">
              {data.patient.consentAccepted
                ? `Accepted${data.patient.consentTimestamp ? ` on ${formatDateTimeDisplay(data.patient.consentTimestamp)}` : ''}.`
                : 'Consent pending confirmation at clinic check-in.'}{' '}
              Please carry valid government photo ID and clinician prescription for obstetric scans.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-4">
              <Link
                to="/patient-info"
                className="font-semibold text-[#0D4A5A] underline underline-offset-4"
              >
                Scan Preparation Guide
              </Link>
              <Link
                to="/patient-consent"
                className="font-semibold text-[#0D4A5A] underline underline-offset-4"
              >
                Patient Consent &amp; PCPNDT Policy
              </Link>
            </div>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-[#65747B]">
          No linked patient chart found for this account yet. Creating or checking in with an appointment links your Patient ID automatically.
        </p>
      )}
    </div>
  );

  return (
    <PatientPortalLayout>
      <SeoHead
        title="My Reports & Patient Portal | EDFIC Lucknow"
        description="Authenticated EDFIC Patient Portal to view and download signed diagnostic PDF reports, manage appointments, submit UPI advance references, and track visit history."
        canonicalPath="/portal"
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-7">
        {/* Patient Portal Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#DCE7E9] pb-6">
          <div>
            <p className="text-xs font-semibold text-[#287887]">
              My Reports &amp; Patient Management · EDFIC Lucknow
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#083642]">
              {data?.patient?.fullName || user?.fullName}
            </h1>
            {data?.patient ? (
              <p className="mt-1 text-xs font-mono-tabular text-[#65747B]">
                Patient ID: {data.patient.patientCode} · {data.patient.phone} · Consent:{' '}
                {data.patient.consentAccepted
                  ? `Recorded${data.patient.consentTimestamp ? ` (${formatDateTimeDisplay(data.patient.consentTimestamp)})` : ''}`
                  : 'Pending'}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#65747B]">
                Signed in as {user?.email} ({user?.role})
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/book"
              className="inline-flex h-10 items-center rounded-full bg-[#0D4A5A] px-5 text-xs font-semibold text-white hover:bg-[#083642] whitespace-nowrap"
            >
              Book New Investigation
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {/* 4-Column Patient Summary KPI Strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="rounded-xl border border-[#DCE7E9] bg-white p-4 text-left transition-colors hover:border-[#287887] cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-[#65747B]">
              <span>Digital Reports</span>
              <FileText className="h-4 w-4 text-[#287887]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-[#083642] font-mono-tabular">
              {summaryStats.reportsCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className="rounded-xl border border-[#DCE7E9] bg-white p-4 text-left transition-colors hover:border-[#287887] cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-[#65747B]">
              <span>Active Bookings</span>
              <Calendar className="h-4 w-4 text-[#287887]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-[#083642] font-mono-tabular">
              {summaryStats.activeBookings}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="rounded-xl border border-[#DCE7E9] bg-white p-4 text-left transition-colors hover:border-[#287887] cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-[#65747B]">
              <span>Clinical Visits</span>
              <ClipboardList className="h-4 w-4 text-[#287887]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-[#083642] font-mono-tabular">
              {summaryStats.visitsCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className="rounded-xl border border-[#DCE7E9] bg-white p-4 text-left transition-colors hover:border-[#287887] cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-[#65747B]">
              <span>Advance / UTR Status</span>
              <CreditCard className="h-4 w-4 text-[#287887]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-[#083642] font-mono-tabular">
              {summaryStats.pendingAdvance}
            </p>
          </button>
        </div>

        {/* Workspace Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Patient Portal Views"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DCE7E9] bg-[#F6FAFB] p-1.5 w-fit"
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'reports', label: 'My Reports' },
              { id: 'appointments', label: 'Appointments & Payments' },
              { id: 'profile', label: 'Visits & Profile' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#0D4A5A] text-white shadow-sm'
                  : 'text-[#455A64] hover:text-[#083642]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {actionMsg && (
          <div className="flex items-center gap-2 rounded-md border border-[#287887] bg-[#E9F3F3] p-3 text-xs text-[#083642]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0D4A5A]" aria-hidden="true" />
            <span>{actionMsg}</span>
          </div>
        )}
        {actionErr && (
          <div className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
            {actionErr}
          </div>
        )}

        {/* Active View Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <MyReportsSection />

            {isLoading ? (
              <div className="h-48 rounded-xl border border-[#DCE7E9] bg-white animate-pulse" />
            ) : (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">{renderVisitsBlock()}</div>
                <div className="lg:col-span-7">{renderAppointmentsBlock()}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            <MyReportsSection />
            <div className="rounded-xl border border-[#DCE7E9] bg-[#F6FAFB] p-5 text-xs leading-relaxed text-[#455A64]">
              <p className="font-semibold text-[#083642]">Confidential Report Vault Policy</p>
              <p className="mt-1">
                Every finalized report PDF is signed off by Dr. Varun Agrawal (DNB Radiology) and stored in private access-controlled storage. Reports are never exposed on public URLs or sent as unencrypted message attachments.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          isLoading ? (
            <div className="h-48 rounded-xl border border-[#DCE7E9] bg-white animate-pulse" />
          ) : (
            renderAppointmentsBlock()
          )
        )}

        {activeTab === 'profile' && (
          isLoading ? (
            <div className="h-48 rounded-xl border border-[#DCE7E9] bg-white animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">{renderPatientProfileBlock()}</div>
              <div className="lg:col-span-6">{renderVisitsBlock()}</div>
            </div>
          )
        )}
      </div>
    </PatientPortalLayout>
  );
}

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { apiFetch } from '../../lib/api';
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatInr,
  humanizeStatus,
} from '../../lib/utils';

type WhatsAppTemplatesMap = Record<string, string>;

const WHATSAPP_TEMPLATE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'INQUIRY_ACKNOWLEDGMENT', label: 'Inquiry Acknowledgment' },
  { key: 'APPOINTMENT_ACKNOWLEDGMENT', label: 'Appointment Acknowledgment' },
  { key: 'BOOKING_REFERENCE', label: 'Booking Reference Notice' },
  { key: 'PAYMENT_INSTRUCTIONS', label: 'UPI Payment Instructions' },
  { key: 'PAYMENT_ACKNOWLEDGED', label: 'Verified Payment Acknowledgment' },
  { key: 'PAYMENT_REJECTED', label: 'Payment Rejection Notice' },
  { key: 'APPOINTMENT_CONFIRMED', label: 'Appointment Confirmation' },
  { key: 'APPOINTMENT_REMINDER', label: 'Upcoming Appointment Reminder' },
  { key: 'APPOINTMENT_RESCHEDULED', label: 'Appointment Rescheduled' },
  { key: 'APPOINTMENT_CANCELLED', label: 'Appointment Cancelled' },
  { key: 'REPORT_PORTAL_NOTICE', label: 'Report Availability (Portal Link Only)' },
];

interface ClinicSettings {
  primaryPhone: string;
  secondaryPhone: string;
  whatsappNumber: string;
  officialEmail: string;
  weekdayHours: string;
  sundayHours: string;
  slotDurationMinutes: number;
  slotCapacityPerSlot: number;
  maxDailyAppointments: number;
  reservationExpiryMinutes: number;
  morningSessionStart: string;
  morningSessionEnd: string;
  upiId: string;
  upiMerchantName: string;
  defaultAdvanceAmountInr: number;
  n8nWebhookUrl: string;
  n8nConnectionStatus?: string;
  n8nLastCheckedAt?: string | null;
  hasN8nWebhookSecret?: boolean;
  n8nWebhookSecretHint?: string | null;
  hasN8nApiKey?: boolean;
  n8nApiKeyHint?: string | null;
  whatsappProvider: string;
  whatsappApiUrl: string;
  whatsappPhoneNumberId: string;
  whatsappConnectionStatus?: string;
  whatsappLastCheckedAt?: string | null;
  hasWhatsappAccessToken?: boolean;
  whatsappAccessTokenHint?: string | null;
  hasWhatsappWebhookSecret?: boolean;
  whatsappWebhookSecretHint?: string | null;
  whatsappTemplates?: WhatsAppTemplatesMap;
}

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
}

interface WebhookLog {
  id: string;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  executionId: string | null;
  responseStatus: number | null;
  lastError: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
}

interface WhatsAppLog {
  id: string;
  recipientPhone: string;
  templateKey: string;
  templateName: string | null;
  status: string;
  provider: string;
  externalMessageId: string | null;
  webhookVerified: boolean;
  deliveredAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  actorRole: string | null;
  action: string;
  resourceType: string;
  summary: string;
  createdAt: string;
  actor: { fullName: string; email: string } | null;
}

interface AdminOverviewResponse {
  todayDate: string;
  counts: {
    todayAppointments: number;
    upcomingAppointments: number;
    newInquiries: number;
    pendingPaymentVerifications: number;
    confirmedAppointments: number;
    completedAppointments: number;
    cancellations: number;
    dueFollowUps: number;
    unpublishedReports: number;
  };
  todayAppointmentsList: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    patientName: string;
    patientPhone: string;
    status: string;
    service: { name: string };
  }>;
  upcomingAppointmentsList: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    patientName: string;
    status: string;
    service: { name: string };
  }>;
  newInquiriesList: Array<{
    id: string;
    leadCode: string;
    fullName: string;
    phone: string;
    source: string;
    status: string;
    interestedService: string | null;
    assignedTo: { fullName: string } | null;
  }>;
  pendingPaymentsList: Array<{
    id: string;
    utrReference: string;
    amountSubmittedInr: number;
    status: string;
    patient: { patientCode: string; fullName: string; phone: string };
    appointment: { bookingReference: string; appointmentDate: string; startTime: string };
  }>;
  operationalAlerts: Array<{
    id: string;
    severity: 'high' | 'medium' | 'info';
    title: string;
    detail: string;
    linkTo: string;
  }>;
}

export function AdminConsolePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'settings' | 'users' | 'automation' | 'audit'>(
    'overview'
  );
  const [formState, setFormState] = useState<ClinicSettings | null>(null);
  const [n8nSecretInput, setN8nSecretInput] = useState('');
  const [n8nApiKeyInput, setN8nApiKeyInput] = useState('');
  const [waTokenInput, setWaTokenInput] = useState('');
  const [waWebhookSecretInput, setWaWebhookSecretInput] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('RECEPTION');
  const [newPass, setNewPass] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditResourceFilter, setAuditResourceFilter] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFetch<AdminOverviewResponse>('/api/v1/admin/overview'),
    enabled: tab === 'overview',
  });

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiFetch<{ settings: ClinicSettings }>('/api/v1/admin/settings'),
    enabled: tab === 'settings',
  });

  useEffect(() => {
    if (settingsData?.settings) {
      setFormState(settingsData.settings);
    }
  }, [settingsData]);

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch<{ users: StaffUser[] }>('/api/v1/admin/users'),
    enabled: tab === 'users',
  });

  const { data: autoData } = useQuery({
    queryKey: ['admin-automation'],
    queryFn: () =>
      apiFetch<{ webhooks: WebhookLog[]; whatsappLogs: WhatsAppLog[] }>(
        '/api/v1/admin/automation-logs'
      ),
    enabled: tab === 'automation',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin-audit', auditActionFilter, auditResourceFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (auditActionFilter.trim()) params.set('action', auditActionFilter.trim());
      if (auditResourceFilter) params.set('resourceType', auditResourceFilter);
      const qs = params.toString();
      return apiFetch<{ logs: AuditLogRow[] }>(
        `/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`
      );
    },
    enabled: tab === 'audit',
  });

  const handleSaveSettings = async () => {
    if (!formState) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        primaryPhone: formState.primaryPhone,
        secondaryPhone: formState.secondaryPhone,
        whatsappNumber: formState.whatsappNumber,
        officialEmail: formState.officialEmail,
        weekdayHours: formState.weekdayHours,
        sundayHours: formState.sundayHours,
        slotDurationMinutes: formState.slotDurationMinutes,
        slotCapacityPerSlot: formState.slotCapacityPerSlot,
        maxDailyAppointments: formState.maxDailyAppointments,
        reservationExpiryMinutes: formState.reservationExpiryMinutes,
        morningSessionStart: formState.morningSessionStart,
        morningSessionEnd: formState.morningSessionEnd,
        upiId: formState.upiId,
        upiMerchantName: formState.upiMerchantName,
        defaultAdvanceAmountInr: formState.defaultAdvanceAmountInr,
        n8nWebhookUrl: formState.n8nWebhookUrl,
        whatsappProvider: formState.whatsappProvider,
        whatsappApiUrl: formState.whatsappApiUrl,
        whatsappPhoneNumberId: formState.whatsappPhoneNumberId,
        whatsappTemplates: formState.whatsappTemplates,
      };
      if (n8nSecretInput.trim()) payload.n8nWebhookSecret = n8nSecretInput.trim();
      if (n8nApiKeyInput.trim()) payload.n8nApiKey = n8nApiKeyInput.trim();
      if (waTokenInput.trim()) payload.whatsappAccessToken = waTokenInput.trim();
      if (waWebhookSecretInput.trim()) payload.whatsappWebhookSecret = waWebhookSecretInput.trim();

      const res = await apiFetch<{ settings: ClinicSettings }>('/api/v1/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setFormState(res.settings);
      setN8nSecretInput('');
      setN8nApiKeyInput('');
      setWaTokenInput('');
      setWaWebhookSecretInput('');
      setFeedback('Clinic contact, schedule, UPI, and integration settings saved.');
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['public-clinic'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleTestN8n = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ status: string; eventId: string; lastError?: string | null }>(
        '/api/v1/admin/integrations/test-n8n',
        { method: 'POST' }
      );
      setFeedback(
        `n8n test ping ${res.eventId}: ${humanizeStatus(res.status)}${res.lastError ? ` (${res.lastError})` : ''}`
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-automation'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'n8n test failed.');
    }
  };

  const handleTestWhatsApp = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ connectionStatus: string; provider: string; detail: string }>(
        '/api/v1/admin/integrations/test-whatsapp',
        { method: 'POST' }
      );
      setFeedback(`WhatsApp (${res.provider}): ${humanizeStatus(res.connectionStatus)} - ${res.detail}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'WhatsApp test failed.');
    }
  };

  const handleCreateStaff = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          fullName: newName,
          role: newRole,
          password: newPass,
        }),
      });
      setNewEmail('');
      setNewName('');
      setNewPass('');
      setFeedback('Staff user account created.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create user.');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ user: { email: string; role: string } }>(
        `/api/v1/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        }
      );
      setFeedback(`Updated role for ${res.user.email} to ${humanizeStatus(res.user.role)}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update role.');
    }
  };

  const handleRetryWebhook = async (id: string) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ status: string; eventId?: string; lastError?: string | null }>(
        `/api/v1/admin/webhooks/${id}/retry`,
        { method: 'POST' }
      );
      setFeedback(
        `Retried ${res.eventId || id}: ${humanizeStatus(res.status)}${res.lastError ? ` (${res.lastError})` : ''}`
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-automation'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Webhook retry failed.');
    }
  };

  const handleRetryAllFailed = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ retried: number; succeeded: number; failed: number }>(
        '/api/v1/admin/webhooks/retry-failed',
        { method: 'POST' }
      );
      setFeedback(
        `Batch retry processed ${res.retried} event(s): ${res.succeeded} succeeded, ${res.failed} failed.`
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-automation'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Batch retry failed.');
    }
  };

  const handleTriggerReminders = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        targetDate: string;
        matchedAppointments: number;
        dispatchedWebhooks: number;
        dispatchedWhatsApp: number;
      }>('/api/v1/admin/integrations/trigger-reminders', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setFeedback(
        `Upcoming reminders (${res.targetDate}): ${res.matchedAppointments} appointment(s), ${res.dispatchedWebhooks} n8n event(s), ${res.dispatchedWhatsApp} WhatsApp queued.`
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-automation'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to dispatch reminders.');
    }
  };

  const handleTriggerDailySummary = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ date: string; eventId: string; status: string }>(
        '/api/v1/admin/integrations/trigger-daily-summary',
        { method: 'POST', body: JSON.stringify({}) }
      );
      setFeedback(
        `Daily reception summary for ${res.date} (${res.eventId}): ${humanizeStatus(res.status)}`
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-automation'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to dispatch daily summary.');
    }
  };

  const counts = overviewData?.counts;

  return (
    <AdminLayout
      title="Super Admin Console & Operations"
      breadcrumb="Administration / Operations & Security"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1 w-fit">
          {[
            { id: 'overview', label: 'Operations Dashboard' },
            { id: 'settings', label: 'Contact, UPI & Integrations' },
            { id: 'users', label: 'Staff Roles & Access' },
            { id: 'automation', label: 'n8n & WhatsApp Logs' },
            { id: 'audit', label: 'Security Audit Trail' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
                tab === t.id ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className="rounded-md border border-[#287887] bg-[#E9F3F3] p-3 text-xs text-[#083642]">
            {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
            {errorMsg}
          </div>
        )}

        {tab === 'overview' && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 text-xs text-[#65747B]">
                Loading live clinic operations...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Today's Appointments", val: counts?.todayAppointments ?? 0 },
                    { label: 'Upcoming Appointments', val: counts?.upcomingAppointments ?? 0 },
                    { label: 'New & Active Inquiries', val: counts?.newInquiries ?? 0 },
                    {
                      label: 'Pending Payment Verifications',
                      val: counts?.pendingPaymentVerifications ?? 0,
                    },
                    { label: 'Confirmed Appointments', val: counts?.confirmedAppointments ?? 0 },
                    { label: 'Completed Appointments', val: counts?.completedAppointments ?? 0 },
                    { label: 'Cancellations', val: counts?.cancellations ?? 0 },
                    { label: 'Unpublished Reports', val: counts?.unpublishedReports ?? 0 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-[#DCE7E9] bg-white p-4"
                    >
                      <p className="text-xs text-[#65747B]">{item.label}</p>
                      <p className="mt-1 font-mono-tabular text-2xl font-bold text-[#083642]">
                        {item.val}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Operational Alerts */}
                <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-[#083642]">
                      Operational Alerts ({overviewData?.operationalAlerts.length ?? 0})
                    </h2>
                    <span className="font-mono-tabular text-xs text-[#65747B]">
                      Reference Date: {overviewData?.todayDate}
                    </span>
                  </div>
                  {(overviewData?.operationalAlerts ?? []).length === 0 ? (
                    <p className="text-xs text-[#65747B]">
                      No pending operational exceptions require attention right now.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E9F3F3]">
                      {overviewData?.operationalAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="py-3 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <p
                              className={`text-xs font-semibold ${
                                alert.severity === 'high'
                                  ? 'text-[#B42318]'
                                  : alert.severity === 'medium'
                                    ? 'text-[#B45309]'
                                    : 'text-[#0D4A5A]'
                              }`}
                            >
                              {alert.title}
                            </p>
                            <p className="text-xs text-[#65747B]">{alert.detail}</p>
                          </div>
                          <Link
                            to={alert.linkTo}
                            className="inline-flex h-8 items-center rounded border border-[#C9D9DC] px-3 text-xs font-medium text-[#0D4A5A] hover:bg-[#F8FAFA]"
                          >
                            Open Queue
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Today's Appointments */}
                  <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-[#083642]">
                        Today&apos;s Appointments
                      </h3>
                      <Link
                        to="/staff/reception"
                        className="text-xs text-[#0D4A5A] underline"
                      >
                        Full Calendar
                      </Link>
                    </div>
                    {(overviewData?.todayAppointmentsList ?? []).length === 0 ? (
                      <p className="text-xs text-[#65747B]">No active appointments scheduled for today.</p>
                    ) : (
                      <div className="divide-y divide-[#E9F3F3] text-xs">
                        {overviewData?.todayAppointmentsList.map((a) => (
                          <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-[#083642]">
                                {a.patientName} ·{' '}
                                <span className="font-mono-tabular text-[#287887]">
                                  {a.bookingReference}
                                </span>
                              </p>
                              <p className="text-[#65747B]">
                                {a.service.name} · {a.startTime}–{a.endTime}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-[#0D4A5A]">
                              {humanizeStatus(a.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upcoming Appointments */}
                  <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-[#083642]">
                        Upcoming Appointments
                      </h3>
                      <Link
                        to="/staff/reception"
                        className="text-xs text-[#0D4A5A] underline"
                      >
                        Manage Schedule
                      </Link>
                    </div>
                    {(overviewData?.upcomingAppointmentsList ?? []).length === 0 ? (
                      <p className="text-xs text-[#65747B]">No upcoming future appointments.</p>
                    ) : (
                      <div className="divide-y divide-[#E9F3F3] text-xs">
                        {overviewData?.upcomingAppointmentsList.map((a) => (
                          <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-[#083642]">
                                {a.patientName} ·{' '}
                                <span className="font-mono-tabular text-[#287887]">
                                  {a.bookingReference}
                                </span>
                              </p>
                              <p className="font-mono-tabular text-[#65747B]">
                                {formatDateDisplay(a.appointmentDate)} {a.startTime} · {a.service.name}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-[#0D4A5A]">
                              {humanizeStatus(a.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* New Inquiries */}
                  <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-[#083642]">
                        New &amp; Follow-Up CRM Inquiries
                      </h3>
                      <Link to="/staff/crm" className="text-xs text-[#0D4A5A] underline">
                        Open CRM
                      </Link>
                    </div>
                    {(overviewData?.newInquiriesList ?? []).length === 0 ? (
                      <p className="text-xs text-[#65747B]">No open inquiries awaiting contact.</p>
                    ) : (
                      <div className="divide-y divide-[#E9F3F3] text-xs">
                        {overviewData?.newInquiriesList.map((lead) => (
                          <div key={lead.id} className="py-2.5 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-[#083642]">
                                {lead.fullName} ·{' '}
                                <span className="font-mono-tabular">{lead.phone}</span>
                              </p>
                              <p className="text-[#65747B]">
                                {lead.leadCode} · {humanizeStatus(lead.source)}
                                {lead.interestedService ? ` · ${lead.interestedService}` : ''}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-[#0D4A5A]">
                              {humanizeStatus(lead.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pending Payment Verifications */}
                  <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-[#083642]">
                        Pending Payment Verifications
                      </h3>
                      <Link to="/staff/payments" className="text-xs text-[#0D4A5A] underline">
                        Verify Payments
                      </Link>
                    </div>
                    {(overviewData?.pendingPaymentsList ?? []).length === 0 ? (
                      <p className="text-xs text-[#65747B]">All submitted payments are verified.</p>
                    ) : (
                      <div className="divide-y divide-[#E9F3F3] text-xs">
                        {overviewData?.pendingPaymentsList.map((pay) => (
                          <div key={pay.id} className="py-2.5 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-[#083642]">
                                {pay.patient.fullName} ·{' '}
                                <span className="font-mono-tabular">
                                  {pay.appointment.bookingReference}
                                </span>
                              </p>
                              <p className="font-mono-tabular text-[#65747B]">
                                UTR {pay.utrReference} · {formatInr(pay.amountSubmittedInr)}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-[#B45309]">
                              {humanizeStatus(pay.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'settings' && formState && (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-6">
            <div>
              <h2 className="font-display text-base font-semibold text-[#083642]">
                Configurable Contact Details &amp; Operating Hours
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Primary Reception Phone</Label>
                  <Input
                    value={formState.primaryPhone}
                    onChange={(e) =>
                      setFormState({ ...formState, primaryPhone: e.target.value })
                    }
                    placeholder="Official contact number"
                  />
                </div>
                <div>
                  <Label>Secondary Phone</Label>
                  <Input
                    value={formState.secondaryPhone}
                    onChange={(e) =>
                      setFormState({ ...formState, secondaryPhone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>WhatsApp Business Number</Label>
                  <Input
                    value={formState.whatsappNumber}
                    onChange={(e) =>
                      setFormState({ ...formState, whatsappNumber: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Official Clinic Email</Label>
                  <Input
                    value={formState.officialEmail}
                    onChange={(e) =>
                      setFormState({ ...formState, officialEmail: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E9F3F3] pt-5">
              <h2 className="font-display text-base font-semibold text-[#083642]">
                Scheduling &amp; UPI Advance Configuration
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>UPI ID (VPA)</Label>
                  <Input
                    value={formState.upiId}
                    onChange={(e) =>
                      setFormState({ ...formState, upiId: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>UPI Merchant Display Name</Label>
                  <Input
                    value={formState.upiMerchantName}
                    onChange={(e) =>
                      setFormState({ ...formState, upiMerchantName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Default Advance (INR)</Label>
                  <Input
                    type="number"
                    value={formState.defaultAdvanceAmountInr}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        defaultAdvanceAmountInr: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Slot Capacity Per Window</Label>
                  <Input
                    type="number"
                    value={formState.slotCapacityPerSlot}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        slotCapacityPerSlot: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Max Daily Appointments</Label>
                  <Input
                    type="number"
                    value={formState.maxDailyAppointments ?? 40}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        maxDailyAppointments: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Unpaid Hold Expiry (Minutes)</Label>
                  <Input
                    type="number"
                    value={formState.reservationExpiryMinutes ?? 30}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        reservationExpiryMinutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Default Slot Duration (Minutes)</Label>
                  <Input
                    type="number"
                    value={formState.slotDurationMinutes ?? 30}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        slotDurationMinutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Doctor Morning Session Start</Label>
                  <Input
                    type="time"
                    value={formState.morningSessionStart ?? '09:30'}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        morningSessionStart: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Doctor Morning Session End</Label>
                  <Input
                    type="time"
                    value={formState.morningSessionEnd ?? '13:30'}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        morningSessionEnd: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E9F3F3] pt-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#083642]">
                    n8n Automation Adapter &amp; Signing Credentials
                  </h2>
                  <p className="text-xs text-[#65747B]">
                    Connection Status:{' '}
                    <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                      {humanizeStatus(formState.n8nConnectionStatus || 'NOT_CONFIGURED')}
                    </span>
                    {formState.n8nLastCheckedAt
                      ? ` · Checked ${formatDateTimeDisplay(formState.n8nLastCheckedAt)}`
                      : ''}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleTestN8n}>
                  Test n8n Webhook
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>n8n Webhook URL</Label>
                  <Input
                    value={formState.n8nWebhookUrl}
                    onChange={(e) =>
                      setFormState({ ...formState, n8nWebhookUrl: e.target.value })
                    }
                    placeholder="https://n8n.example.com/webhook/edfic"
                  />
                </div>
                <div>
                  <Label>n8n Signing Secret (HMAC-SHA256)</Label>
                  <Input
                    type="password"
                    value={n8nSecretInput}
                    onChange={(e) => setN8nSecretInput(e.target.value)}
                    placeholder={
                      formState.hasN8nWebhookSecret
                        ? `Configured (${formState.n8nWebhookSecretHint}) - enter to rotate`
                        : 'Enter n8n signing secret'
                    }
                  />
                </div>
                <div>
                  <Label>n8n API Key (Optional Header Auth)</Label>
                  <Input
                    type="password"
                    value={n8nApiKeyInput}
                    onChange={(e) => setN8nApiKeyInput(e.target.value)}
                    placeholder={
                      formState.hasN8nApiKey
                        ? `Configured (${formState.n8nApiKeyHint}) - enter to rotate`
                        : 'Enter n8n API key'
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E9F3F3] pt-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#083642]">
                    Official WhatsApp Business API Provider
                  </h2>
                  <p className="text-xs text-[#65747B]">
                    Connection Status:{' '}
                    <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                      {humanizeStatus(formState.whatsappConnectionStatus || 'NOT_CONFIGURED')}
                    </span>
                    {formState.whatsappLastCheckedAt
                      ? ` · Checked ${formatDateTimeDisplay(formState.whatsappLastCheckedAt)}`
                      : ''}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleTestWhatsApp}>
                  Test WhatsApp Provider
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Provider Adapter</Label>
                  <Select
                    value={formState.whatsappProvider}
                    onChange={(e) =>
                      setFormState({ ...formState, whatsappProvider: e.target.value })
                    }
                  >
                    <option value="meta_cloud">Meta Cloud API</option>
                    <option value="interakt">Interakt</option>
                    <option value="wati">WATI</option>
                    <option value="aisensy">AiSensy</option>
                  </Select>
                </div>
                <div>
                  <Label>API Endpoint URL</Label>
                  <Input
                    value={formState.whatsappApiUrl}
                    onChange={(e) =>
                      setFormState({ ...formState, whatsappApiUrl: e.target.value })
                    }
                    placeholder="https://graph.facebook.com/v20.0/..."
                  />
                </div>
                <div>
                  <Label>Phone Number ID / Sender ID</Label>
                  <Input
                    value={formState.whatsappPhoneNumberId}
                    onChange={(e) =>
                      setFormState({ ...formState, whatsappPhoneNumberId: e.target.value })
                    }
                    placeholder="e.g. 1048291049201"
                  />
                </div>
                <div>
                  <Label>API Access Token (Write-Only)</Label>
                  <Input
                    type="password"
                    value={waTokenInput}
                    onChange={(e) => setWaTokenInput(e.target.value)}
                    placeholder={
                      formState.hasWhatsappAccessToken
                        ? `Configured (${formState.whatsappAccessTokenHint}) - enter to rotate`
                        : 'Enter bearer access token'
                    }
                  />
                </div>
                <div>
                  <Label>WhatsApp Webhook Secret (Delivery Callbacks)</Label>
                  <Input
                    type="password"
                    value={waWebhookSecretInput}
                    onChange={(e) => setWaWebhookSecretInput(e.target.value)}
                    placeholder={
                      formState.hasWhatsappWebhookSecret
                        ? `Configured (${formState.whatsappWebhookSecretHint}) - enter to rotate`
                        : 'Enter webhook verify / HMAC secret'
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#287887]">
                  Approved WhatsApp Template Identifiers
                </h3>
                <p className="text-xs text-[#65747B]">
                  Compliance Rule: Diagnostic PDFs and medical findings are strictly blocked from WhatsApp notifications. Report templates only transmit a secure patient portal notice.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {WHATSAPP_TEMPLATE_LABELS.map((item) => (
                    <div key={item.key}>
                      <Label>{item.label}</Label>
                      <Input
                        value={formState.whatsappTemplates?.[item.key] ?? ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            whatsappTemplates: {
                              ...(formState.whatsappTemplates ?? {}),
                              [item.key]: e.target.value,
                            },
                          })
                        }
                        className="font-mono-tabular text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button type="button" onClick={handleSaveSettings}>
              Save Clinic Settings
            </Button>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#083642]">
                Create Staff Account
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 items-end">
                <div>
                  <Label>Full Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                    <option value="RECEPTION">Reception</option>
                    <option value="SUPER_ADMIN">Super Administrator</option>
                  </Select>
                </div>
                <div>
                  <Label>Initial Password</Label>
                  <Input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleCreateStaff}>
                  Add Staff User
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-[#DCE7E9] bg-white overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DCE7E9] bg-[#F8FAFA] text-[#65747B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role &amp; Permissions</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9F3F3]">
                  {(usersData?.users ?? []).map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium text-[#24343B]">{u.fullName}</td>
                      <td className="px-4 py-3 font-mono-tabular">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.role === 'PATIENT' ? (
                          <span>{humanizeStatus(u.role)}</span>
                        ) : (
                          <Select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="h-8 w-52 text-xs"
                          >
                            <option value="SUPER_ADMIN">Super Administrator</option>
                            <option value="RECEPTION">Reception</option>
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3">{u.isActive ? 'Active' : 'Disabled'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/v1/admin/users/${u.id}/toggle-active`, {
                              method: 'PATCH',
                            });
                            await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                          }}
                          className="text-[#0D4A5A] underline cursor-pointer"
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'automation' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#083642]">
                    Hermes Agent Scoped API &amp; Operational Workflows
                  </h2>
                  <p className="text-[#65747B]">
                    Authenticated via <code className="font-mono-tabular">X-Hermes-Api-Key</code>. Strictly read-only aggregated summaries - zero PII, zero report downloads, zero service pricing, and human staff approval required for all consequential actions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleTriggerReminders}>
                    Send Upcoming Reminders
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerDailySummary}
                  >
                    Dispatch Daily Summary
                  </Button>
                  <Button type="button" size="sm" onClick={handleRetryAllFailed}>
                    Retry All Failed Webhooks
                  </Button>
                </div>
              </div>
              <ul className="font-mono-tabular text-[#0D4A5A] grid grid-cols-1 gap-1 sm:grid-cols-2 pt-1">
                <li>GET /api/v1/hermes/summary/appointments</li>
                <li>GET /api/v1/hermes/summary/inquiries</li>
                <li>GET /api/v1/hermes/summary/tasks</li>
                <li>GET /api/v1/hermes/services</li>
                <li>GET /api/v1/hermes/summary/operations</li>
                <li>GET /api/v1/hermes/summary/reception</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-[#DCE7E9] bg-white p-5">
                <h3 className="font-display text-sm font-semibold text-[#083642]">
                  n8n Webhook Outbox ({autoData?.webhooks.length ?? 0})
                </h3>
                <div className="mt-3 divide-y divide-[#E9F3F3] text-xs max-h-96 overflow-y-auto">
                  {(autoData?.webhooks ?? []).map((w) => (
                    <div key={w.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono-tabular font-semibold text-[#083642]">
                          {w.eventType} · {w.status}
                          {w.responseStatus ? ` (HTTP ${w.responseStatus})` : ''}
                        </p>
                        <p className="text-[#65747B]">
                          {w.eventId} · Attempts: {w.attempts}
                          {w.executionId ? ` · Exec: ${w.executionId}` : ''}
                        </p>
                        {w.lastError && <p className="text-[#B42318]">{w.lastError}</p>}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryWebhook(w.id)}
                      >
                        Retry
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#DCE7E9] bg-white p-5">
                <h3 className="font-display text-sm font-semibold text-[#083642]">
                  WhatsApp Notification Dispatch Log ({autoData?.whatsappLogs.length ?? 0})
                </h3>
                <div className="mt-3 divide-y divide-[#E9F3F3] text-xs max-h-96 overflow-y-auto">
                  {(autoData?.whatsappLogs ?? []).map((l) => (
                    <div key={l.id} className="py-2.5 space-y-0.5">
                      <p className="font-mono-tabular font-semibold text-[#083642]">
                        {l.templateKey}
                        {l.templateName ? ` (${l.templateName})` : ''} · {l.status} · {l.provider}
                      </p>
                      <p className="text-[#65747B]">
                        To: {l.recipientPhone} · {formatDateTimeDisplay(l.createdAt)}
                        {l.webhookVerified ? ' · Webhook Verified' : ''}
                      </p>
                      {l.externalMessageId && (
                        <p className="font-mono-tabular text-[#287887]">
                          Message ID: {l.externalMessageId}
                        </p>
                      )}
                      {l.errorMessage && <p className="text-[#65747B]">{l.errorMessage}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
              <div>
                <Label>Filter by Action</Label>
                <Input
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  placeholder="e.g. REPORT_DOWNLOADED, MERGED, ROLE"
                />
              </div>
              <div>
                <Label>Resource Type</Label>
                <Select
                  value={auditResourceFilter}
                  onChange={(e) => setAuditResourceFilter(e.target.value)}
                >
                  <option value="">All Resource Types</option>
                  <option value="User">User &amp; Auth</option>
                  <option value="Patient">Patient</option>
                  <option value="Appointment">Appointment</option>
                  <option value="Payment">Payment</option>
                  <option value="Visit">Visit</option>
                  <option value="DiagnosticReport">Diagnostic Report</option>
                  <option value="CrmLead">CRM Lead</option>
                  <option value="CrmTask">CRM Task</option>
                  <option value="CmsContentItem">CMS Content</option>
                  <option value="ClinicSetting">Clinic Settings</option>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAuditActionFilter('');
                  setAuditResourceFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>

            <div className="rounded-lg border border-[#DCE7E9] bg-white overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DCE7E9] bg-[#F8FAFA] text-[#65747B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Actor / Role</th>
                    <th className="px-4 py-3 font-medium">Resource</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9F3F3]">
                  {(auditData?.logs ?? []).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 font-mono-tabular text-[#65747B] whitespace-nowrap">
                        {formatDateTimeDisplay(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {log.actor?.fullName || 'System / Public'} · {log.actorRole || '-'}
                      </td>
                      <td className="px-4 py-2.5 font-mono-tabular text-[#65747B]">
                        {log.resourceType}
                      </td>
                      <td className="px-4 py-2.5 font-mono-tabular font-medium text-[#083642]">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 text-[#24343B]">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

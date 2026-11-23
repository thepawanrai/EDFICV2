import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import { Plus, UserPlus } from 'lucide-react';
import { ReceptionLayout } from '../../components/layout/ReceptionLayout';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatInr, humanizeStatus } from '../../lib/utils';

interface AppointmentPaymentSummary {
  id: string;
  receiptNumber: string | null;
  paymentMethod: string;
  expectedAdvanceInr: number;
  amountSubmittedInr: number;
  totalServiceFeeInr: number;
  utrReference: string;
  paymentDate: string;
  status: string;
}

interface AppointmentRow {
  id: string;
  bookingReference: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingChannel: string;
  patientName: string;
  patientPhone: string;
  isReceptionOverride: boolean;
  overrideReason: string | null;
  notes: string | null;
  reservationExpiresAt: string | null;
  service: { id: string; name: string; durationMinutes: number; advanceAmountInr: number };
  payments: AppointmentPaymentSummary[];
  visit: { id: string; visitNumber: string; status: string } | null;
}

interface HolidayRow {
  id: string;
  date: string;
  reason: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    advanceAmountInr: number;
  }>;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

interface ReceptionOverview {
  todayDate: string;
  counts: {
    todayAppointments: number;
    confirmedAppointments: number;
    completedAppointments: number;
    cancellations: number;
    newInquiries: number;
    pendingPaymentVerifications: number;
    dueFollowUps: number;
  };
  newInquiriesList: Array<{
    id: string;
    leadCode: string;
    fullName: string;
    phone: string;
    source: string;
    status: string;
    interestedService: string | null;
  }>;
  pendingPaymentsList: Array<{
    id: string;
    utrReference: string;
    amountSubmittedInr: number;
    status: string;
    patient: { fullName: string; phone: string };
    appointment: { bookingReference: string };
  }>;
  dueTasks: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    lead: { leadCode: string; fullName: string; phone: string };
  }>;
}

export function ReceptionDashboardPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('Adjusted by Reception Desk');
  const [useOverride, setUseOverride] = useState(true);

  // Confirm Appointment Dialog State
  const [confirmTarget, setConfirmTarget] = useState<AppointmentRow | null>(null);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [confirmOverrideReason, setConfirmOverrideReason] = useState('');

  // Manual Payment Dialog State
  const [paymentTarget, setPaymentTarget] = useState<AppointmentRow | null>(null);
  const [payMethod, setPayMethod] = useState<'UPI' | 'CASH' | 'CARD' | 'BANK_TRANSFER'>('UPI');
  const [payRef, setPayRef] = useState('');
  const [payAmount, setPayAmount] = useState('500');
  const [payTotalFee, setPayTotalFee] = useState('0');
  const [payVerifyNow, setPayVerifyNow] = useState(true);
  const [payNotes, setPayNotes] = useState('');

  // Operational Notes Dialog State
  const [notesTarget, setNotesTarget] = useState<AppointmentRow | null>(null);
  const [notesText, setNotesText] = useState('');

  // Quick Register Patient Dialog State
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [ptName, setPtName] = useState('');
  const [ptPhone, setPtPhone] = useState('');
  const [ptEmail, setPtEmail] = useState('');
  const [ptGender, setPtGender] = useState('');
  const [ptDob, setPtDob] = useState('');
  const [ptRef, setPtRef] = useState('');

  // Phone Booking Dialog State
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneServiceId, setPhoneServiceId] = useState('');
  const [phoneDate, setPhoneDate] = useState(new Date().toISOString().slice(0, 10));
  const [phoneStartTime, setPhoneStartTime] = useState('10:00');
  const [phoneSlots, setPhoneSlots] = useState<SlotItem[]>([]);
  const [phoneName, setPhoneName] = useState('');
  const [phoneMobile, setPhoneMobile] = useState('');
  const [phoneEmail, setPhoneEmail] = useState('');
  const [phoneReferring, setPhoneReferring] = useState('');
  const [phoneNotes, setPhoneNotes] = useState('');
  const [phoneOverride, setPhoneOverride] = useState(false);
  const [phoneOverrideReason, setPhoneOverrideReason] = useState('');
  const [phoneCollectNow, setPhoneCollectNow] = useState(false);
  const [phonePayMethod, setPhonePayMethod] = useState<'UPI' | 'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [phonePayRef, setPhonePayRef] = useState('');
  const [phonePayAmount, setPhonePayAmount] = useState('500');

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: overviewData } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFetch<ReceptionOverview>('/api/v1/admin/overview'),
  });

  const { data: apptsData, isLoading } = useQuery({
    queryKey: ['staff-appointments'],
    queryFn: () =>
      apiFetch<{ appointments: AppointmentRow[] }>('/api/v1/appointments'),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiFetch<{ holidays: HolidayRow[] }>('/api/v1/admin/settings'),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['cms-services'],
    queryFn: () => apiFetch<{ categories: ServiceCategory[] }>('/api/v1/cms/services'),
  });

  const allServices = useMemo(
    () => servicesData?.categories.flatMap((c) => c.services) ?? [],
    [servicesData]
  );

  useEffect(() => {
    if (allServices.length > 0 && !phoneServiceId) {
      setPhoneServiceId(allServices[0].id);
      setPhonePayAmount(String(allServices[0].advanceAmountInr || 500));
    }
  }, [allServices, phoneServiceId]);

  useEffect(() => {
    if (!phoneModalOpen || !phoneServiceId || !phoneDate) return;
    apiFetch<{ slots: SlotItem[] }>(
      `/api/v1/appointments/slots?date=${encodeURIComponent(phoneDate)}&serviceId=${encodeURIComponent(phoneServiceId)}`
    )
      .then((res) => {
        setPhoneSlots(res.slots);
        const firstAvail = res.slots.find((s) => s.available);
        if (firstAvail) setPhoneStartTime(firstAvail.startTime);
      })
      .catch(() => setPhoneSlots([]));
  }, [phoneModalOpen, phoneServiceId, phoneDate]);

  const appointments = apptsData?.appointments ?? [];
  const filtered =
    statusFilter === 'ALL'
      ? appointments
      : appointments.filter((a) => a.status === statusFilter);

  const calendarEvents = appointments
    .filter((a) => a.status !== 'CANCELLED')
    .map((a) => ({
      id: a.id,
      title: `${a.patientName} - ${a.service.name}`,
      start: `${a.appointmentDate}T${a.startTime}:00`,
      end: `${a.appointmentDate}T${a.endTime}:00`,
      backgroundColor:
        a.status === 'CONFIRMED' || a.status === 'CHECKED_IN'
          ? '#0D4A5A'
          : a.status === 'COMPLETED'
            ? '#287887'
            : '#65747B',
      borderColor: '#083642',
    }));

  const handleRegisterPatient = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ patient: { patientCode: string; fullName: string } }>(
        '/api/v1/patients',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName: ptName,
            phone: ptPhone,
            email: ptEmail,
            gender: ptGender || undefined,
            dateOfBirth: ptDob || undefined,
            referredBy: ptRef || undefined,
            consentAccepted: true,
          }),
        }
      );
      setFeedback(`Registered patient ${res.patient.fullName} (${res.patient.patientCode}).`);
      setPatientModalOpen(false);
      setPtName('');
      setPtPhone('');
      setPtEmail('');
      setPtGender('');
      setPtDob('');
      setPtRef('');
      await queryClient.invalidateQueries({ queryKey: ['staff-patients'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Patient registration failed.');
    }
  };

  const handleCheckIn = async (id: string) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ visit: { visitNumber: string } }>(
        `/api/v1/appointments/${id}/check-in`,
        { method: 'POST' }
      );
      setFeedback(`Patient checked in under Visit ${res.visit.visitNumber}.`);
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Check-in failed.');
    }
  };

  const handleConfirmAppointment = async () => {
    if (!confirmTarget) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/appointments/${confirmTarget.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          isReceptionOverride: confirmOverride,
          overrideReason: confirmOverrideReason,
        }),
      });
      setFeedback(`Appointment ${confirmTarget.bookingReference} confirmed.`);
      setConfirmTarget(null);
      setConfirmOverride(false);
      setConfirmOverrideReason('');
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Confirmation failed.');
    }
  };

  const handleRecordManualPayment = async () => {
    if (!paymentTarget) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch('/api/v1/payments/manual', {
        method: 'POST',
        body: JSON.stringify({
          appointmentId: paymentTarget.id,
          paymentMethod: payMethod,
          utrReference: payRef.trim() || `${payMethod}-${Date.now()}`,
          amountSubmittedInr: Number(payAmount),
          totalServiceFeeInr: Number(payTotalFee || 0),
          verifyImmediately: payVerifyNow,
          notes: payNotes,
        }),
      });
      setFeedback(
        `Recorded ${payMethod} payment of ${formatInr(Number(payAmount))} for ${paymentTarget.bookingReference}.`
      );
      setPaymentTarget(null);
      setPayRef('');
      setPayNotes('');
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record manual payment.');
    }
  };

  const handleSaveNotes = async () => {
    if (!notesTarget) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/appointments/${notesTarget.id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: notesText }),
      });
      setFeedback(`Operational notes updated for ${notesTarget.bookingReference}.`);
      setNotesTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update notes.');
    }
  };

  const handleCreatePhoneBooking = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        appointment: { id: string; bookingReference: string };
      }>('/api/v1/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: phoneServiceId,
          date: phoneDate,
          startTime: phoneStartTime,
          patientName: phoneName,
          patientPhone: phoneMobile,
          patientEmail: phoneEmail,
          referringDoctor: phoneReferring,
          bookingChannel: 'PHONE',
          consentAccepted: true,
          isReceptionOverride: phoneOverride,
          overrideReason: phoneOverrideReason,
          notes: phoneNotes,
        }),
      });

      if (phoneCollectNow) {
        await apiFetch('/api/v1/payments/manual', {
          method: 'POST',
          body: JSON.stringify({
            appointmentId: res.appointment.id,
            paymentMethod: phonePayMethod,
            utrReference: phonePayRef.trim() || `${phonePayMethod}-${res.appointment.bookingReference}`,
            amountSubmittedInr: Number(phonePayAmount || 500),
            verifyImmediately: true,
            notes: 'Collected during reception phone booking',
          }),
        });
      }

      setFeedback(`Phone booking ${res.appointment.bookingReference} created.`);
      setPhoneModalOpen(false);
      setPhoneName('');
      setPhoneMobile('');
      setPhoneEmail('');
      setPhoneReferring('');
      setPhoneNotes('');
      setPhoneOverride(false);
      setPhoneOverrideReason('');
      setPhoneCollectNow(false);
      setPhonePayRef('');
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Phone booking failed.');
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/appointments/${rescheduleTarget.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          date: newDate,
          startTime: newTime,
          isReceptionOverride: useOverride,
          reason: rescheduleReason,
        }),
      });
      setRescheduleTarget(null);
      setFeedback(`Appointment ${rescheduleTarget.bookingReference} rescheduled.`);
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Reschedule failed.');
    }
  };

  const handleCancel = async (id: string) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/appointments/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Cancelled by Reception Desk' }),
      });
      setFeedback('Appointment cancelled.');
      await queryClient.invalidateQueries({ queryKey: ['staff-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Cancel failed.');
    }
  };

  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayReason) return;
    setErrorMsg(null);
    try {
      await apiFetch('/api/v1/admin/holidays', {
        method: 'POST',
        body: JSON.stringify({ date: holidayDate, reason: holidayReason }),
      });
      setHolidayDate('');
      setHolidayReason('');
      setFeedback('Clinic holiday recorded.');
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not add holiday.');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    await apiFetch(`/api/v1/admin/holidays/${id}`, { method: 'DELETE' });
    await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
  };

  return (
    <ReceptionLayout title="Reception & Scheduling Calendar" breadcrumb="Operations / Reception">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#65747B]">
            Daily front-desk hub: appointments, patient registrations, UPI verifications, inquiries, follow-ups, and check-ins.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPatientModalOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              <span>Register Patient</span>
            </Button>
            <Button type="button" onClick={() => setPhoneModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>New Phone Booking</span>
            </Button>
          </div>
        </div>

        {/* Daily Appointment Overview KPI Strip */}
        {overviewData && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {[
              { label: "Today's Appts", val: overviewData.counts.todayAppointments },
              { label: 'Confirmed', val: overviewData.counts.confirmedAppointments },
              { label: 'Completed', val: overviewData.counts.completedAppointments },
              { label: 'Pending Payments', val: overviewData.counts.pendingPaymentVerifications },
              { label: 'Open Inquiries', val: overviewData.counts.newInquiries },
              { label: 'Due Follow-Ups', val: overviewData.counts.dueFollowUps },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-[#DCE7E9] bg-white p-3.5">
                <p className="text-[11px] text-[#65747B]">{k.label}</p>
                <p className="mt-1 font-mono-tabular text-xl font-bold text-[#083642]">
                  {k.val}
                </p>
              </div>
            ))}
          </div>
        )}

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

        {/* Compact Front-Desk Summary: Inquiries, Follow-ups & Payment Queue */}
        {overviewData && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[#083642]">
                  New Inquiries
                </h2>
                <Link to="/staff/crm" className="text-[#0D4A5A] underline">
                  Manage CRM
                </Link>
              </div>
              {overviewData.newInquiriesList.length === 0 ? (
                <p className="text-[#65747B]">No uncontacted inquiries.</p>
              ) : (
                <div className="divide-y divide-[#E9F3F3]">
                  {overviewData.newInquiriesList.slice(0, 4).map((lead) => (
                    <div key={lead.id} className="py-2 flex justify-between gap-2">
                      <span>
                        <strong className="text-[#083642]">{lead.fullName}</strong> ·{' '}
                        <span className="font-mono-tabular text-[#65747B]">{lead.phone}</span>
                      </span>
                      <span className="font-mono-tabular text-[#0D4A5A]">
                        {humanizeStatus(lead.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[#083642]">
                  Follow-Up Tasks
                </h2>
                <Link to="/staff/crm" className="text-[#0D4A5A] underline">
                  All Tasks
                </Link>
              </div>
              {overviewData.dueTasks.length === 0 ? (
                <p className="text-[#65747B]">No open follow-up tasks.</p>
              ) : (
                <div className="divide-y divide-[#E9F3F3]">
                  {overviewData.dueTasks.slice(0, 4).map((t) => (
                    <div key={t.id} className="py-2">
                      <p className="font-medium text-[#083642]">{t.title}</p>
                      <p className="font-mono-tabular text-[#65747B]">
                        {t.lead.fullName} ({t.lead.phone})
                        {t.dueAt ? ` · Due ${formatDateDisplay(t.dueAt.slice(0, 10))}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[#083642]">
                  Pending UPI Verifications
                </h2>
                <Link to="/staff/payments" className="text-[#0D4A5A] underline">
                  Verify Desk
                </Link>
              </div>
              {overviewData.pendingPaymentsList.length === 0 ? (
                <p className="text-[#65747B]">No pending UTR submissions.</p>
              ) : (
                <div className="divide-y divide-[#E9F3F3]">
                  {overviewData.pendingPaymentsList.slice(0, 4).map((pay) => (
                    <div key={pay.id} className="py-2 flex justify-between gap-2">
                      <span>
                        <strong className="font-mono-tabular text-[#083642]">
                          {pay.appointment.bookingReference}
                        </strong>{' '}
                        · {pay.patient.fullName}
                      </span>
                      <span className="font-mono-tabular text-[#B45309]">
                        {formatInr(pay.amountSubmittedInr)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FullCalendar Interactive Schedule */}
        <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 sm:p-6">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={calendarEvents}
            height="auto"
            slotMinTime="09:00:00"
            slotMaxTime="20:30:00"
          />
        </div>

        {/* Reschedule Inline Panel */}
        {rescheduleTarget && (
          <div className="rounded-lg border border-[#0D4A5A] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[#083642]">
                Reschedule {rescheduleTarget.bookingReference} ({rescheduleTarget.patientName})
              </h2>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-xs text-[#65747B] underline cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-end">
              <div>
                <Label>New Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Input
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#24343B] pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useOverride}
                  onChange={(e) => setUseOverride(e.target.checked)}
                />
                <span>Reception Slot Override</span>
              </label>
              <Button type="button" onClick={handleReschedule}>
                Save New Slot
              </Button>
            </div>
          </div>
        )}

        {/* Appointment Queue */}
        <div className="rounded-lg border border-[#DCE7E9] bg-white">
          <div className="p-4 sm:p-5 border-b border-[#DCE7E9] flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-[#083642]">
              Appointment Queue ({filtered.length})
            </h2>
            <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1">
              {['ALL', 'PENDING_ADVANCE', 'ADVANCE_SUBMITTED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'].map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                      statusFilter === st
                        ? 'bg-white text-[#0D4A5A] shadow-sm'
                        : 'text-[#65747B]'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : humanizeStatus(st)}
                  </button>
                )
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 text-xs text-[#65747B]">Loading appointments...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#65747B]">
              No appointments match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DCE7E9] bg-[#F8FAFA] text-[#65747B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Date &amp; Slot</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Investigation</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9F3F3]">
                  {filtered.map((appt) => {
                    const latestPayment = appt.payments?.[0] ?? null;
                    const canConfirm = ['PENDING_ADVANCE', 'ADVANCE_SUBMITTED'].includes(
                      appt.status
                    );

                    return (
                      <tr key={appt.id} className="hover:bg-[#F8FAFA]">
                        <td className="px-4 py-3 font-mono-tabular font-medium text-[#083642]">
                          <p>{appt.bookingReference}</p>
                          <p className="text-[11px] font-normal text-[#65747B]">
                            {appt.bookingChannel}
                            {appt.isReceptionOverride ? ' · Override' : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono-tabular">
                          {formatDateDisplay(appt.appointmentDate)} · {appt.startTime}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#24343B]">{appt.patientName}</p>
                          <p className="font-mono-tabular text-[#65747B]">{appt.patientPhone}</p>
                        </td>
                        <td className="px-4 py-3 text-[#24343B]">
                          <p>{appt.service.name}</p>
                          {appt.notes && (
                            <p className="text-[11px] text-[#65747B] line-clamp-1">
                              Note: {appt.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular">
                          {latestPayment ? (
                            <div className="space-y-0.5">
                              <p className="font-medium text-[#083642]">
                                {humanizeStatus(latestPayment.status)} ({formatInr(latestPayment.amountSubmittedInr)})
                              </p>
                              <p className="text-[11px] text-[#65747B]">
                                {latestPayment.receiptNumber || latestPayment.utrReference}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#65747B]">Pending Advance</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#0D4A5A]">
                            {humanizeStatus(appt.status)}
                          </span>
                          {appt.visit && (
                            <p className="font-mono-tabular text-[11px] text-[#65747B]">
                              {appt.visit.visitNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          {canConfirm && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const hasVerified = (appt.payments ?? []).some(
                                  (p) => p.status === 'VERIFIED'
                                );
                                setConfirmTarget(appt);
                                setConfirmOverride(!hasVerified);
                                setConfirmOverrideReason('');
                              }}
                            >
                              Confirm
                            </Button>
                          )}
                          {!['CANCELLED'].includes(appt.status) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPaymentTarget(appt);
                                setPayAmount(String(appt.service.advanceAmountInr || 500));
                                setPayRef('');
                              }}
                            >
                              Record Payment
                            </Button>
                          )}
                          {!appt.visit &&
                            !['CANCELLED', 'COMPLETED'].includes(appt.status) && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleCheckIn(appt.id)}
                              >
                                Check In
                              </Button>
                            )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNotesTarget(appt);
                              setNotesText(appt.notes || '');
                            }}
                          >
                            Notes
                          </Button>
                          {!['CANCELLED', 'COMPLETED'].includes(appt.status) && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRescheduleTarget(appt);
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
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Clinic Holiday Schedule Manager */}
        <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#083642]">
            Clinic Holidays &amp; Closure Dates
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
            <div>
              <Label>Holiday Date</Label>
              <Input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={holidayReason}
                onChange={(e) => setHolidayReason(e.target.value)}
                placeholder="e.g., Gazetted Holiday"
              />
            </div>
            <Button type="button" variant="secondary" onClick={handleAddHoliday}>
              Block Date
            </Button>
          </div>
          {(settingsData?.holidays ?? []).length > 0 && (
            <div className="divide-y divide-[#E9F3F3] border-t border-[#DCE7E9] pt-2 text-xs">
              {settingsData?.holidays.map((h) => (
                <div key={h.id} className="py-2 flex items-center justify-between">
                  <span className="font-mono-tabular">
                    {formatDateDisplay(h.date)} - {h.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteHoliday(h.id)}
                    className="text-[#B42318] hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Patient Registration Dialog */}
      <Dialog
        open={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        title="Register New Patient"
        description="Create a verified EDFIC patient profile with unique EDF-PT ID and consent status."
        className="max-w-lg"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input value={ptName} onChange={(e) => setPtName(e.target.value)} />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input value={ptPhone} onChange={(e) => setPtPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email (Optional)</Label>
              <Input type="email" value={ptEmail} onChange={(e) => setPtEmail(e.target.value)} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={ptDob} onChange={(e) => setPtDob(e.target.value)} />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={ptGender} onChange={(e) => setPtGender(e.target.value)}>
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Referring Doctor</Label>
              <Input value={ptRef} onChange={(e) => setPtRef(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPatientModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ptName.trim() || ptPhone.trim().length < 10}
              onClick={handleRegisterPatient}
            >
              Register Patient
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Phone Booking Dialog */}
      <Dialog
        open={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        title="New Phone Appointment Booking"
        description="Reserve a slot on behalf of a patient calling the EDFIC reception desk."
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Patient Full Name</Label>
              <Input
                value={phoneName}
                onChange={(e) => setPhoneName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                value={phoneMobile}
                onChange={(e) => setPhoneMobile(e.target.value)}
                placeholder="10-digit mobile"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Diagnostic Service</Label>
              <Select
                value={phoneServiceId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPhoneServiceId(id);
                  const found = allServices.find((s) => s.id === id);
                  if (found) setPhonePayAmount(String(found.advanceAmountInr || 500));
                }}
              >
                {allServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Appointment Date</Label>
              <Input
                type="date"
                value={phoneDate}
                onChange={(e) => setPhoneDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Time Slot</Label>
              {phoneOverride ? (
                <Input
                  type="time"
                  value={phoneStartTime}
                  onChange={(e) => setPhoneStartTime(e.target.value)}
                />
              ) : (
                <Select
                  value={phoneStartTime}
                  onChange={(e) => setPhoneStartTime(e.target.value)}
                >
                  {phoneSlots.map((s) => (
                    <option key={s.startTime} value={s.startTime} disabled={!s.available}>
                      {s.startTime}–{s.endTime} {!s.available ? `(${s.reason || 'Full'})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label>Referring Clinician (Optional)</Label>
              <Input
                value={phoneReferring}
                onChange={(e) => setPhoneReferring(e.target.value)}
                placeholder="Dr. Name"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#24343B] cursor-pointer">
            <input
              type="checkbox"
              checked={phoneOverride}
              onChange={(e) => setPhoneOverride(e.target.checked)}
            />
            <span>Authorize Reception Slot Override (allows custom time or full slot capacity)</span>
          </label>

          {phoneOverride && (
            <div>
              <Label>Override Authorization Reason</Label>
              <Input
                value={phoneOverrideReason}
                onChange={(e) => setPhoneOverrideReason(e.target.value)}
                placeholder="e.g., Urgent obstetric consultation approved by Dr. Agrawal"
              />
            </div>
          )}

          <div>
            <Label>Operational Notes</Label>
            <Textarea
              value={phoneNotes}
              onChange={(e) => setPhoneNotes(e.target.value)}
              placeholder="Any call instructions or fasting reminders communicated"
            />
          </div>

          <div className="rounded-md border border-[#DCE7E9] bg-[#F8FAFA] p-3 space-y-3">
            <label className="flex items-center gap-2 text-xs font-medium text-[#083642] cursor-pointer">
              <input
                type="checkbox"
                checked={phoneCollectNow}
                onChange={(e) => setPhoneCollectNow(e.target.checked)}
              />
              <span>Record immediate advance payment &amp; confirm slot</span>
            </label>
            {phoneCollectNow && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>Method</Label>
                  <Select
                    value={phonePayMethod}
                    onChange={(e) => setPhonePayMethod(e.target.value as typeof phonePayMethod)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </Select>
                </div>
                <div>
                  <Label>Reference / Receipt Note</Label>
                  <Input
                    value={phonePayRef}
                    onChange={(e) => setPhonePayRef(e.target.value)}
                    placeholder="UTR or Desk Ref"
                  />
                </div>
                <div>
                  <Label>Amount (INR)</Label>
                  <Input
                    type="number"
                    value={phonePayAmount}
                    onChange={(e) => setPhonePayAmount(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPhoneModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!phoneName.trim() || phoneMobile.trim().length < 10}
              onClick={handleCreatePhoneBooking}
            >
              Create Phone Booking
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirm Appointment Dialog */}
      <Dialog
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        title="Confirm Appointment"
        description={
          confirmTarget
            ? `${confirmTarget.bookingReference} · ${confirmTarget.patientName}`
            : undefined
        }
      >
        {confirmTarget && (
          <div className="space-y-4 text-xs">
            {(confirmTarget.payments ?? []).some((p) => p.status === 'VERIFIED') ? (
              <p className="text-[#083642]">
                Advance payment is verified. Confirming will finalize this slot and dispatch confirmation notifications.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-[#B42318]">
                  No verified payment is recorded yet. Confirming without verified payment requires an authorized Reception Override.
                </p>
                <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmOverride}
                    onChange={(e) => setConfirmOverride(e.target.checked)}
                  />
                  <span>Authorize Reception Override confirmation</span>
                </label>
                {confirmOverride && (
                  <div>
                    <Label>Override Reason</Label>
                    <Input
                      value={confirmOverrideReason}
                      onChange={(e) => setConfirmOverrideReason(e.target.value)}
                      placeholder="e.g., Pay-at-desk approved by senior reception"
                    />
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmAppointment}>
                Confirm Appointment
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Record Manual Payment Dialog */}
      <Dialog
        open={Boolean(paymentTarget)}
        onClose={() => setPaymentTarget(null)}
        title="Record Manual / Desk Payment"
        description={
          paymentTarget
            ? `${paymentTarget.bookingReference} · ${paymentTarget.patientName}`
            : undefined
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment Method</Label>
              <Select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </Select>
            </div>
            <div>
              <Label>Reference / UTR</Label>
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="UTR / POS slip / Cash ref"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount Paid (INR)</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Total Service Fee (INR, Optional)</Label>
              <Input
                type="number"
                value={payTotalFee}
                onChange={(e) => setPayTotalFee(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[#24343B] cursor-pointer">
            <input
              type="checkbox"
              checked={payVerifyNow}
              onChange={(e) => setPayVerifyNow(e.target.checked)}
            />
            <span>Verify immediately, issue receipt, and confirm appointment</span>
          </label>
          <div>
            <Label>Payment Note</Label>
            <Input
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Optional desk remarks"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPaymentTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleRecordManualPayment}>
              Save Payment
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Operational Notes Dialog */}
      <Dialog
        open={Boolean(notesTarget)}
        onClose={() => setNotesTarget(null)}
        title="Appointment Operational Notes"
        description={notesTarget?.bookingReference}
      >
        <div className="space-y-4">
          <Textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Operational instructions for reception desk or scan room"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNotesTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveNotes}>
              Save Notes
            </Button>
          </div>
        </div>
      </Dialog>
    </ReceptionLayout>
  );
}

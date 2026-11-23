import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, CheckCircle2, Clock, Upload } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatInr, humanizeStatus } from '../../lib/utils';

const bookingSchema = z.object({
  patientName: z.string().min(2, 'Patient full name is required.'),
  patientPhone: z.string().min(10, 'Valid 10-digit mobile number is required.').max(15),
  patientEmail: z.string().email('Enter a valid email.').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  referringDoctor: z.string().optional(),
  clinicalIndication: z.string().optional(),
  consentAccepted: z.literal(true, {
    message: 'Please acknowledge patient consent and PCPNDT Act statutory notice.',
  }),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface SlotItem {
  startTime: string;
  endTime: string;
  available: boolean;
  remainingCapacity: number;
  reason?: string;
}

interface BookingConfirmation {
  appointment: {
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    reservationExpiresAt?: string | null;
    patientName: string;
    patientPhone: string;
    service: {
      name: string;
      durationMinutes: number;
      preparationNotes: string;
    };
  };
  upiPayment: {
    upiId: string;
    merchantName: string;
    expectedAdvanceInr: number;
  };
}

export function BookAppointmentPage() {
  const [searchParams] = useSearchParams();
  const initialSlug = searchParams.get('service') || '';
  const [mode, setMode] = useState<'book' | 'lookup'>('book');

  const { data: servicesData } = usePublicServices();
  const allServices = useMemo(
    () => servicesData?.categories.flatMap((c) => c.services) ?? [],
    [servicesData]
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  );
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [slotsMeta, setSlotsMeta] = useState<{
    isHoliday: boolean;
    holidayReason?: string;
    isSunday: boolean;
  } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [holdMsg, setHoldMsg] = useState<string | null>(null);

  const [sessionToken] = useState(() => `sess-${Math.random().toString(36).slice(2, 12)}`);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // UTR Submission State
  const [utrRef, setUtrRef] = useState('');
  const [amountSubmitted, setAmountSubmitted] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [utrSubmitting, setUtrSubmitting] = useState(false);
  const [utrSuccess, setUtrSuccess] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);

  // Lookup State
  const [lookupRef, setLookupRef] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<{
    appointment: BookingConfirmation['appointment'] & {
      payments: Array<{
        id: string;
        receiptNumber: string | null;
        paymentMethod?: string;
        utrReference: string;
        amountSubmittedInr: number;
        totalServiceFeeInr?: number;
        paymentDate: string;
        status: string;
        rejectionReason: string | null;
      }>;
    };
    upiPayment: BookingConfirmation['upiPayment'];
  } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Sync service from URL slug or pick first
  useEffect(() => {
    if (allServices.length === 0) return;
    if (initialSlug) {
      const match = allServices.find((s) => s.slug === initialSlug);
      if (match) {
        setSelectedServiceId(match.id);
        return;
      }
    }
    if (!selectedServiceId) {
      setSelectedServiceId(allServices[0].id);
    }
  }, [allServices, initialSlug, selectedServiceId]);

  const selectedService = allServices.find((s) => s.id === selectedServiceId);

  // Load real-time slots when date or service changes
  useEffect(() => {
    if (!selectedServiceId || !selectedDate) return;
    let active = true;
    setSlotsLoading(true);
    setSlotError(null);
    setSelectedSlot('');
    setHoldMsg(null);

    apiFetch<{
      isHoliday: boolean;
      holidayReason?: string;
      isSunday: boolean;
      slots: SlotItem[];
    }>(
      `/api/v1/appointments/slots?date=${encodeURIComponent(
        selectedDate
      )}&serviceId=${encodeURIComponent(selectedServiceId)}&sessionToken=${encodeURIComponent(
        sessionToken
      )}`
    )
      .then((res) => {
        if (!active) return;
        setSlots(res.slots);
        setSlotsMeta({
          isHoliday: res.isHoliday,
          holidayReason: res.holidayReason,
          isSunday: res.isSunday,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setSlotError(err instanceof Error ? err.message : 'Unable to fetch slots.');
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedServiceId, selectedDate, sessionToken]);

  const handleSelectSlot = async (startTime: string) => {
    setSlotError(null);
    try {
      await apiFetch('/api/v1/appointments/hold', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          date: selectedDate,
          startTime,
          sessionToken,
        }),
      });
      setSelectedSlot(startTime);
      setHoldMsg(`Slot ${startTime} held for 5 minutes while you complete patient details.`);
    } catch (err: unknown) {
      setSlotError(err instanceof Error ? err.message : 'Unable to hold slot.');
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
  });

  const onBookSubmit = async (values: BookingFormValues) => {
    if (!selectedServiceId || !selectedSlot) {
      setBookingError('Please select an available time slot before submitting.');
      return;
    }
    setBookingError(null);
    try {
      const res = await apiFetch<BookingConfirmation>('/api/v1/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          date: selectedDate,
          startTime: selectedSlot,
          sessionToken,
          ...values,
        }),
      });
      setConfirmation(res);
      setAmountSubmitted(String(res.upiPayment.expectedAdvanceInr));
    } catch (err: unknown) {
      setBookingError(
        err instanceof Error ? err.message : 'Appointment booking failed.'
      );
    }
  };

  const handleUtrSubmit = async (
    targetBookingRef: string,
    targetPhone: string
  ) => {
    setUtrError(null);
    setUtrSuccess(null);
    if (!utrRef.trim() || !amountSubmitted) {
      setUtrError('Please enter your UPI UTR/reference number and amount paid.');
      return;
    }
    setUtrSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('bookingReference', targetBookingRef);
      formData.append('phone', targetPhone);
      formData.append('utrReference', utrRef.trim());
      formData.append('amountSubmittedInr', amountSubmitted);
      formData.append('paymentDate', paymentDate);
      if (evidenceFile) {
        formData.append('evidence', evidenceFile);
      }

      const data = await apiFetch<{ message: string }>('/api/v1/payments/submit-utr', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });

      setUtrSuccess(data.message);
      setUtrRef('');
      setEvidenceFile(null);
      if (mode === 'lookup') {
        await performLookup(targetBookingRef, targetPhone);
      }
    } catch (err: unknown) {
      setUtrError(err instanceof Error ? err.message : 'Submission error.');
    } finally {
      setUtrSubmitting(false);
    }
  };

  const performLookup = async (refVal: string, phoneVal: string) => {
    setLookupError(null);
    setLookupLoading(true);
    try {
      const res = await apiFetch<typeof lookupResult>('/api/v1/appointments/lookup', {
        method: 'POST',
        body: JSON.stringify({ bookingReference: refVal, phone: phoneVal }),
      });
      setLookupResult(res);
      if (res) {
        setAmountSubmitted(String(res.upiPayment.expectedAdvanceInr));
      }
    } catch (err: unknown) {
      setLookupResult(null);
      setLookupError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setLookupLoading(false);
    }
  };

  const activeBooking = confirmation || lookupResult;
  const upiUri = activeBooking
    ? `upi://pay?pa=${encodeURIComponent(activeBooking.upiPayment.upiId)}&pn=${encodeURIComponent(
        activeBooking.upiPayment.merchantName
      )}&am=${activeBooking.upiPayment.expectedAdvanceInr}&cu=INR&tn=${encodeURIComponent(
        `EDFIC ${activeBooking.appointment.bookingReference}`
      )}`
    : '';

  return (
    <PublicLayout>
      <SeoHead
        title="Schedule Appointment & Track Booking | EDFIC Lucknow"
        description="Reserve a diagnostic ultrasound or fetal imaging appointment slot at EDFIC, Sushant Golf City, Lucknow, or track your existing booking reference."
        canonicalPath="/book"
      />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#287887]">
              EDFIC Scheduling · Sushant Golf City, Lucknow
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-[#083642]">
              Appointment Booking &amp; UPI Advance
            </h1>
          </div>

          <div className="inline-flex rounded-lg bg-[#E9F3F3] p-1 self-start">
            <button
              type="button"
              onClick={() => setMode('book')}
              className={`rounded-md px-4 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                mode === 'book' ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
              }`}
            >
              Book New Slot
            </button>
            <button
              type="button"
              onClick={() => setMode('lookup')}
              className={`rounded-md px-4 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                mode === 'lookup' ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
              }`}
            >
              Track Booking / Submit UTR
            </button>
          </div>
        </div>

        {mode === 'lookup' ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-[#083642]">
                Lookup Existing Booking
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="lookupRef">Booking Reference</Label>
                  <Input
                    id="lookupRef"
                    value={lookupRef}
                    onChange={(e) => setLookupRef(e.target.value)}
                    placeholder="EDF-20261120-XXXX"
                    className="font-mono-tabular uppercase"
                  />
                </div>
                <div>
                  <Label htmlFor="lookupPhone">Registered Mobile</Label>
                  <Input
                    id="lookupPhone"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    disabled={lookupLoading}
                    onClick={() => performLookup(lookupRef, lookupPhone)}
                    className="w-full"
                  >
                    {lookupLoading ? 'Searching...' : 'Retrieve Booking'}
                  </Button>
                </div>
              </div>
              {lookupError && (
                <p className="mt-3 text-xs text-[#B42318]">{lookupError}</p>
              )}
            </div>

            {lookupResult && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-4">
                  <div>
                    <p className="font-mono-tabular text-xs font-semibold text-[#287887]">
                      {lookupResult.appointment.bookingReference} ·{' '}
                      {humanizeStatus(lookupResult.appointment.status)}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-[#083642]">
                      {lookupResult.appointment.service.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#65747B]">
                      {formatDateDisplay(lookupResult.appointment.appointmentDate)} ·{' '}
                      <span className="font-mono-tabular">
                        {lookupResult.appointment.startTime}–{lookupResult.appointment.endTime}
                      </span>
                    </p>
                  </div>

                  {lookupResult.appointment.payments.length > 0 && (
                    <div className="border-t border-[#DCE7E9] pt-4 space-y-2">
                      <p className="text-xs font-semibold text-[#24343B]">
                        Submitted Payment Attempts
                      </p>
                      {lookupResult.appointment.payments.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-md border border-[#DCE7E9] bg-[#F8FAFA] p-3 text-xs space-y-1"
                        >
                          <p className="font-mono-tabular font-medium text-[#083642]">
                            {p.paymentMethod || 'UPI'} Ref: {p.utrReference} · {formatInr(p.amountSubmittedInr)} ·{' '}
                            {humanizeStatus(p.status)}
                          </p>
                          {p.receiptNumber && (
                            <p className="text-[#0D4A5A] font-medium">
                              Verified Receipt: {p.receiptNumber}
                              {p.totalServiceFeeInr && p.totalServiceFeeInr > 0
                                ? ` · Balance Due: ${formatInr(Math.max(0, p.totalServiceFeeInr - p.amountSubmittedInr))}`
                                : ''}
                            </p>
                          )}
                          {p.rejectionReason && (
                            <p className="text-[#B42318]">
                              Rejection note: {p.rejectionReason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {lookupResult.appointment.reservationExpiresAt &&
                    lookupResult.appointment.status === 'PENDING_ADVANCE' && (
                      <div className="rounded-md border border-[#DCE7E9] bg-[#E9F3F3]/70 p-3 text-xs text-[#083642]">
                        Unpaid reservation held until{' '}
                        <span className="font-mono-tabular font-semibold">
                          {new Date(lookupResult.appointment.reservationExpiresAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        . Submit your UTR to retain this slot.
                      </div>
                    )}
                </div>

                <div className="lg:col-span-6 rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-4">
                  <h3 className="font-display text-base font-semibold text-[#083642]">
                    UPI Advance Payment &amp; UTR Submission
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4 items-center rounded-md bg-[#F8FAFA] p-4 border border-[#E9F3F3]">
                    <div className="bg-white p-2 rounded border border-[#DCE7E9]">
                      <QRCodeSVG value={upiUri} size={116} />
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-[#083642]">
                        Advance Payable: {formatInr(lookupResult.upiPayment.expectedAdvanceInr)}
                      </p>
                      <p className="font-mono-tabular text-[#24343B]">
                        UPI ID: {lookupResult.upiPayment.upiId}
                      </p>
                      <p className="text-[#65747B]">
                        Pay using any UPI app, then submit your 12-digit UTR below.
                      </p>
                    </div>
                  </div>

                  {utrSuccess && (
                    <div className="rounded-md bg-[#E9F3F3] p-3 text-xs text-[#083642]">
                      {utrSuccess}
                    </div>
                  )}
                  {utrError && (
                    <div className="rounded-md bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
                      {utrError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <Label>UTR / UPI Reference Number</Label>
                      <Input
                        value={utrRef}
                        onChange={(e) => setUtrRef(e.target.value)}
                        placeholder="e.g. 432519847210"
                        className="font-mono-tabular"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Amount Paid (INR)</Label>
                        <Input
                          type="number"
                          value={amountSubmitted}
                          onChange={(e) => setAmountSubmitted(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Payment Date</Label>
                        <Input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Optional Screenshot / Receipt (PNG, JPG, PDF)</Label>
                      <Input
                        type="file"
                        accept=".png,.jpg,.jpeg,.pdf"
                        onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={utrSubmitting}
                      onClick={() =>
                        handleUtrSubmit(
                          lookupResult.appointment.bookingReference,
                          lookupResult.appointment.patientPhone
                        )
                      }
                      className="w-full"
                    >
                      <Upload className="h-4 w-4" />
                      <span>
                        {utrSubmitting ? 'Submitting UTR...' : 'Submit Payment Reference'}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : confirmation ? (
          /* Booking Confirmation + UPI Advance Screen */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8 space-y-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-[#0D4A5A] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#287887]">
                    Appointment Request Registered
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-[#083642] font-mono-tabular">
                    {confirmation.appointment.bookingReference}
                  </h2>
                </div>
              </div>

              <div className="border-t border-[#DCE7E9] pt-4 space-y-2 text-sm">
                <p>
                  <span className="text-[#65747B]">Investigation:</span>{' '}
                  <strong>{confirmation.appointment.service.name}</strong>
                </p>
                <p>
                  <span className="text-[#65747B]">Date &amp; Slot:</span>{' '}
                  <strong className="font-mono-tabular">
                    {formatDateDisplay(confirmation.appointment.appointmentDate)} ·{' '}
                    {confirmation.appointment.startTime}–{confirmation.appointment.endTime}
                  </strong>
                </p>
                <p>
                  <span className="text-[#65747B]">Patient:</span>{' '}
                  {confirmation.appointment.patientName} ({confirmation.appointment.patientPhone})
                </p>
              </div>

              <div className="rounded-md bg-[#E9F3F3]/70 p-4 text-xs leading-relaxed text-[#24343B]">
                <p className="font-semibold text-[#083642]">Preparation Instructions</p>
                <p className="mt-1">{confirmation.appointment.service.preparationNotes}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmation(null);
                  setUtrSuccess(null);
                  setSelectedSlot('');
                }}
              >
                Book Another Appointment
              </Button>
            </div>

            <div className="lg:col-span-6 rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8 space-y-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#083642]">
                  Complete UPI Partial Advance
                </h3>
                <p className="mt-1 text-xs text-[#65747B]">
                  1. Scan the QR or pay to the UPI ID below. 2. Copy your 12-digit UTR number. 3. Submit the UTR here. Slots are confirmed after manual verification by EDFIC reception staff.
                </p>
                {confirmation.appointment.reservationExpiresAt && (
                  <p className="mt-1.5 text-xs font-medium text-[#0D4A5A]">
                    Unpaid reservation held until{' '}
                    <span className="font-mono-tabular">
                      {new Date(confirmation.appointment.reservationExpiresAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    .
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 rounded-md border border-[#DCE7E9] bg-[#F8FAFA] p-4">
                <div className="bg-white p-2.5 rounded border border-[#DCE7E9] shrink-0">
                  <QRCodeSVG value={upiUri} size={132} />
                </div>
                <div className="space-y-1.5 text-xs">
                  <p className="text-sm font-bold text-[#083642] font-mono-tabular">
                    Advance: {formatInr(confirmation.upiPayment.expectedAdvanceInr)}
                  </p>
                  <p className="font-mono-tabular text-[#24343B]">
                    UPI ID: {confirmation.upiPayment.upiId}
                  </p>
                  <p className="text-[#65747B]">{confirmation.upiPayment.merchantName}</p>
                </div>
              </div>

              {utrSuccess && (
                <div className="rounded-md border border-[#287887] bg-[#E9F3F3] p-3 text-xs text-[#083642]">
                  {utrSuccess}
                </div>
              )}
              {utrError && (
                <div className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
                  {utrError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label>UTR / UPI Reference Number</Label>
                  <Input
                    value={utrRef}
                    onChange={(e) => setUtrRef(e.target.value)}
                    placeholder="Enter 12-digit UTR number"
                    className="font-mono-tabular"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount Paid (INR)</Label>
                    <Input
                      type="number"
                      value={amountSubmitted}
                      onChange={(e) => setAmountSubmitted(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Optional Evidence Screenshot (PNG/JPG/PDF)</Label>
                  <Input
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  type="button"
                  disabled={utrSubmitting}
                  onClick={() =>
                    handleUtrSubmit(
                      confirmation.appointment.bookingReference,
                      confirmation.appointment.patientPhone
                    )
                  }
                  className="w-full"
                >
                  {utrSubmitting ? 'Submitting UTR...' : 'Submit UTR for Verification'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* 3-Step Booking Form */
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Step 1 & 2: Service + Date + Slots */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-4">
                <h2 className="font-display text-base font-semibold text-[#083642]">
                  01. Select Diagnostic Investigation
                </h2>
                <div>
                  <Label htmlFor="serviceSelect">Diagnostic Service</Label>
                  <Select
                    id="serviceSelect"
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                  >
                    {(servicesData?.categories ?? []).map((cat) => (
                      <optgroup key={cat.id} label={cat.name}>
                        {cat.services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.durationMinutes} min)
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </div>

                {selectedService && (
                  <div className="rounded-md bg-[#F8FAFA] border border-[#E9F3F3] p-4 text-xs space-y-1.5">
                    <p className="font-semibold text-[#083642]">
                      {selectedService.name} ·{' '}
                      <span className="font-mono-tabular">
                        {selectedService.durationMinutes} min
                      </span>
                    </p>
                    <p className="text-[#65747B]">{selectedService.preparationNotes}</p>
                    {selectedService.requiresDoctorMorning && (
                      <p className="text-[#0D4A5A] font-medium">
                        Conducted during Dr. Varun Agrawal&apos;s daily morning session.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-[#083642]">
                    02. Choose Date &amp; Available Slot
                  </h2>
                  <Calendar className="h-4 w-4 text-[#0D4A5A]" />
                </div>

                <div>
                  <Label htmlFor="apptDate">Preferred Date</Label>
                  <Input
                    id="apptDate"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                {slotsMeta?.isSunday && (
                  <p className="text-xs text-[#287887]">
                    Sunday scheduling window: 10:00 AM – 2:00 PM (by appointment).
                  </p>
                )}

                {slotsLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="h-10 rounded bg-[#E9F3F3]/60 animate-pulse" />
                    ))}
                  </div>
                ) : slotsMeta?.isHoliday ? (
                  <div className="rounded-md border border-[#DCE7E9] bg-[#F8FAFA] p-4 text-xs text-[#24343B]">
                    Clinic closed on {formatDateDisplay(selectedDate)}: {slotsMeta.holidayReason}
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-[#65747B]">
                    No slots available for this date. Please select another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const active = selectedSlot === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => handleSelectSlot(slot.startTime)}
                          className={`h-10 rounded-md border text-xs font-mono-tabular font-medium transition-colors cursor-pointer ${
                            active
                              ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white'
                              : slot.available
                                ? 'border-[#C9D9DC] bg-white text-[#24343B] hover:border-[#0D4A5A]'
                                : 'border-[#E9F3F3] bg-[#F8FAFA] text-[#65747B]/50 cursor-not-allowed line-through'
                          }`}
                        >
                          {slot.startTime}
                        </button>
                      );
                    })}
                  </div>
                )}

                {holdMsg && (
                  <p className="text-xs text-[#0D4A5A] flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>{holdMsg}</span>
                  </p>
                )}
                {slotError && <p className="text-xs text-[#B42318]">{slotError}</p>}
              </div>
            </div>

            {/* Step 3: Patient Info */}
            <div className="lg:col-span-6">
              <form
                onSubmit={handleSubmit(onBookSubmit)}
                className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-4"
              >
                <h2 className="font-display text-base font-semibold text-[#083642]">
                  03. Patient Details &amp; Confirmation
                </h2>

                {bookingError && (
                  <div className="rounded-md bg-[#FEF3F2] border border-[#B42318]/40 p-3 text-xs text-[#B42318]">
                    {bookingError}
                  </div>
                )}

                <div>
                  <Label htmlFor="patientName">Patient Full Name</Label>
                  <Input
                    id="patientName"
                    {...register('patientName')}
                    placeholder="Full legal name (as on Photo ID)"
                  />
                  {errors.patientName && (
                    <p className="mt-1 text-xs text-[#B42318]">{errors.patientName.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="patientPhone">Mobile Number</Label>
                    <Input
                      id="patientPhone"
                      {...register('patientPhone')}
                      placeholder="10-digit mobile number"
                    />
                    {errors.patientPhone && (
                      <p className="mt-1 text-xs text-[#B42318]">{errors.patientPhone.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="patientEmail">Email (Optional)</Label>
                    <Input
                      id="patientEmail"
                      type="email"
                      {...register('patientEmail')}
                      placeholder="For portal notifications"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
                    <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
                  </div>
                  <div>
                    <Label htmlFor="referringDoctor">Referring Clinician (Optional)</Label>
                    <Input
                      id="referringDoctor"
                      {...register('referringDoctor')}
                      placeholder="Dr. Name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="clinicalIndication">
                    Clinical Note / LMP / Gestational Week (Optional)
                  </Label>
                  <Textarea
                    id="clinicalIndication"
                    {...register('clinicalIndication')}
                    placeholder="Optional clinical context for reception and radiologist"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#24343B] cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('consentAccepted')}
                    className="mt-0.5 h-4 w-4 rounded border-[#C9D9DC] text-[#0D4A5A]"
                  />
                  <span>
                    I acknowledge the EDFIC Patient Consent Policy and statutory PCPNDT Act guidelines (prenatal sex determination is strictly prohibited and not requested).
                  </span>
                </label>
                {errors.consentAccepted && (
                  <p className="text-xs text-[#B42318]">{errors.consentAccepted.message}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedSlot}
                  className="w-full h-11"
                >
                  {isSubmitting
                    ? 'Reserving Appointment...'
                    : selectedSlot
                      ? `Confirm Slot (${selectedSlot}) & Proceed to UPI Advance`
                      : 'Select a Time Slot First'}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

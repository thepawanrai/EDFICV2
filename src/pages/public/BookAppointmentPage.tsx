import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileCheck2,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Sun,
  Sunset,
  Sunrise,
  Upload,
  X,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
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

type BookingStep = 1 | 2 | 3;
type TimeBand = 'all' | 'morning' | 'afternoon' | 'evening';

function toLocalDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildQuickDates(totalDays = 14): Array<{
  iso: string;
  weekday: string;
  dayNum: string;
  month: string;
  isToday: boolean;
  isSunday: boolean;
}> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: totalDays }, (_, idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + idx);
    return {
      iso: toLocalDateIso(d),
      weekday: idx === 0 ? 'Today' : idx === 1 ? 'Tmrw' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: String(d.getDate()),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      isToday: idx === 0,
      isSunday: d.getDay() === 0,
    };
  });
}

function formatCountdown(targetIso: string | null, nowMs: number): string | null {
  if (!targetIso) return null;
  const diffSec = Math.max(0, Math.floor((new Date(targetIso).getTime() - nowMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSlotHour(timeStr: string): number {
  const [h] = timeStr.split(':');
  return Number(h) || 0;
}

function formatSlotLabel(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function BookAppointmentPage() {
  const [searchParams] = useSearchParams();
  const initialSlug = searchParams.get('service') || '';
  const [mode, setMode] = useState<'book' | 'lookup'>('book');
  const [activeStep, setActiveStep] = useState<BookingStep>(1);

  const { data: servicesData, isLoading: servicesLoading } = usePublicServices();
  const categories = servicesData?.categories ?? [];
  const allServices = useMemo(
    () => categories.flatMap((c) => c.services),
    [categories]
  );

  // Step 1 filter state
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [serviceSearch, setServiceSearch] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const initialSlugAppliedRef = useRef(false);

  // Step 2 date & slot state
  const quickDates = useMemo(() => buildQuickDates(14), []);
  const [dateWeekOffset, setDateWeekOffset] = useState<0 | 1>(0);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalDateIso(tomorrow);
  });
  const [timeBand, setTimeBand] = useState<TimeBand>('all');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [holdingSlot, setHoldingSlot] = useState<string | null>(null);
  const [heldUntilIso, setHeldUntilIso] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [slotsMeta, setSlotsMeta] = useState<{
    isHoliday: boolean;
    holidayReason?: string;
    isSunday: boolean;
  } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [sessionToken] = useState(() => `sess-${Math.random().toString(36).slice(2, 12)}`);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<'ref' | 'upi' | null>(null);

  // UTR Submission State
  const [utrRef, setUtrRef] = useState('');
  const [amountSubmitted, setAmountSubmitted] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => toLocalDateIso(new Date()));
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
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

  const workspaceTopRef = useRef<HTMLDivElement>(null);

  // Live countdown ticker when a slot hold or booking reservation expiry is active
  const activeCountdownTarget =
    confirmation?.appointment.reservationExpiresAt ||
    lookupResult?.appointment.reservationExpiresAt ||
    heldUntilIso;

  useEffect(() => {
    if (!activeCountdownTarget) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeCountdownTarget]);

  const holdCountdown = formatCountdown(heldUntilIso, nowMs);
  const reservationCountdown = formatCountdown(
    confirmation?.appointment.reservationExpiresAt ||
      lookupResult?.appointment.reservationExpiresAt ||
      null,
    nowMs
  );

  // Sync service from URL slug or pick first
  useEffect(() => {
    if (allServices.length === 0) return;
    if (initialSlug && !initialSlugAppliedRef.current) {
      const match = allServices.find((s) => s.slug === initialSlug);
      if (match) {
        initialSlugAppliedRef.current = true;
        setSelectedServiceId(match.id);
        setActiveCategoryId(match.categoryId);
        setActiveStep(2);
        return;
      }
    }
    if (!selectedServiceId) {
      setSelectedServiceId(allServices[0].id);
    }
  }, [allServices, initialSlug, selectedServiceId]);

  const selectedService = allServices.find((s) => s.id === selectedServiceId);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return allServices.filter((svc) => {
      const catMatch = activeCategoryId === 'ALL' || svc.categoryId === activeCategoryId;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        svc.name.toLowerCase().includes(q) ||
        svc.summary.toLowerCase().includes(q) ||
        svc.code.toLowerCase().includes(q)
      );
    });
  }, [allServices, activeCategoryId, serviceSearch]);

  // Load real-time slots when date or service changes
  useEffect(() => {
    if (!selectedServiceId || !selectedDate) return;
    let active = true;
    setSlotsLoading(true);
    setSlotError(null);
    setSelectedSlot('');
    setHeldUntilIso(null);

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

  // Categorize slots by time of day
  const slotGroups = useMemo(() => {
    const morning = slots.filter((s) => getSlotHour(s.startTime) < 12);
    const afternoon = slots.filter(
      (s) => getSlotHour(s.startTime) >= 12 && getSlotHour(s.startTime) < 17
    );
    const evening = slots.filter((s) => getSlotHour(s.startTime) >= 17);
    return {
      morning,
      afternoon,
      evening,
      availableTotal: slots.filter((s) => s.available).length,
    };
  }, [slots]);

  const visibleSlots = useMemo(() => {
    if (timeBand === 'morning') return slotGroups.morning;
    if (timeBand === 'afternoon') return slotGroups.afternoon;
    if (timeBand === 'evening') return slotGroups.evening;
    return slots;
  }, [slots, slotGroups, timeBand]);

  const visibleQuickDates = useMemo(
    () => quickDates.slice(dateWeekOffset * 7, dateWeekOffset * 7 + 7),
    [quickDates, dateWeekOffset]
  );

  const goToStep = (step: BookingStep) => {
    setActiveStep(step);
    if (window.innerWidth < 1024 && workspaceTopRef.current) {
      workspaceTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectSlot = async (startTime: string) => {
    setSlotError(null);
    setHoldingSlot(startTime);
    try {
      const held = await apiFetch<{ heldUntil: string; startTime: string; date: string }>(
        '/api/v1/appointments/hold',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceId: selectedServiceId,
            date: selectedDate,
            startTime,
            sessionToken,
          }),
        }
      );
      setSelectedSlot(startTime);
      setHeldUntilIso(held.heldUntil || new Date(Date.now() + 5 * 60_000).toISOString());
    } catch (err: unknown) {
      setSlotError(err instanceof Error ? err.message : 'Unable to hold slot.');
    } finally {
      setHoldingSlot(null);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
  });

  const watchedConsent = watch('consentAccepted');
  const watchedName = watch('patientName');

  const onBookSubmit = async (values: BookingFormValues) => {
    if (!selectedServiceId || !selectedSlot) {
      setBookingError('Please select an available time slot before submitting.');
      goToStep(2);
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
      setBookingError(err instanceof Error ? err.message : 'Appointment booking failed.');
    }
  };

  const handleUtrSubmit = async (targetBookingRef: string, targetPhone: string) => {
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
    if (!refVal.trim() || !phoneVal.trim()) {
      setLookupError('Enter both your EDFIC Booking Reference and registered mobile number.');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await apiFetch<typeof lookupResult>('/api/v1/appointments/lookup', {
        method: 'POST',
        body: JSON.stringify({ bookingReference: refVal.trim(), phone: phoneVal.trim() }),
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

  const copyText = (text: string, key: 'ref' | 'upi') => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    });
  };

  const activeBooking = confirmation || lookupResult;
  const upiUri = activeBooking
    ? `upi://pay?pa=${encodeURIComponent(activeBooking.upiPayment.upiId)}&pn=${encodeURIComponent(
        activeBooking.upiPayment.merchantName
      )}&am=${activeBooking.upiPayment.expectedAdvanceInr}&cu=INR&tn=${encodeURIComponent(
        `EDFIC ${activeBooking.appointment.bookingReference}`
      )}`
    : '';

  const minDateIso = toLocalDateIso(new Date());

  const renderEvidenceUploader = (inputId: string) => (
    <div>
      <Label htmlFor={inputId}>Optional Screenshot / Receipt (PNG, JPG, PDF)</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFile(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) setEvidenceFile(dropped);
        }}
        className={`relative mt-1 flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-xs transition-colors ${
          isDraggingFile
            ? 'border-[#0D4A5A] bg-[#E9F3F3]/70'
            : 'border-[#C9D9DC] bg-[#F8FAFA] hover:border-[#287887]'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        {evidenceFile ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCheck2 className="h-4 w-4 shrink-0 text-[#0D4A5A]" />
              <div className="min-w-0">
                <p className="font-medium text-[#083642] truncate">{evidenceFile.name}</p>
                <p className="text-[11px] text-[#65747B] font-mono-tabular">
                  {Math.max(1, Math.round(evidenceFile.size / 1024))} KB attached
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEvidenceFile(null)}
              aria-label="Remove attached screenshot"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#DCE7E9] bg-white text-[#65747B] hover:text-[#B42318] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <label
            htmlFor={inputId}
            className="flex w-full cursor-pointer items-center justify-between gap-3 text-[#455A64]"
          >
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#287887] shrink-0" />
              <span>Drop payment screenshot here or click to browse</span>
            </span>
            <span className="font-semibold text-[#0D4A5A] shrink-0">Choose File</span>
          </label>
        )}
      </div>
    </div>
  );

  return (
    <PublicLayout>
      <SeoHead
        title="Schedule Appointment & Track Booking | EDFIC Lucknow"
        description="Reserve a diagnostic ultrasound or fetal imaging appointment slot at EDFIC, Sushant Golf City, Lucknow, or track your existing booking reference."
        canonicalPath="/book"
      />

      <MotionConfig reducedMotion="user">
        <div
          ref={workspaceTopRef}
          className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8"
        >
          {/* Page Header & Animated Mode Switcher */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between border-b border-[#DCE7E9] pb-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#287887]">
                EDFIC Scheduling · Sushant Golf City, Lucknow
              </p>
              <h1 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642] text-balance">
                Schedule Your Diagnostic Visit
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#4F646D]">
                Select your ultrasound or Doppler investigation, hold a live 5-minute slot, and complete UPI advance verification in one seamless flow.
              </p>
            </div>

            {/* Segmented Mode Control */}
            <div className="relative inline-flex rounded-xl border border-[#DCE7E9] bg-[#EEF5F7] p-1 self-start shrink-0">
              {(['book', 'lookup'] as const).map((tabKey) => {
                const active = mode === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setMode(tabKey)}
                    className={`relative z-10 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active ? 'text-[#083642]' : 'text-[#55676F] hover:text-[#083642]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="booking-mode-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm"
                      />
                    )}
                    {tabKey === 'book' ? 'Book New Slot' : 'Track Booking & Submit UTR'}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'lookup' ? (
              <motion.div
                key="mode-lookup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    performLookup(lookupRef, lookupPhone);
                  }}
                  className="rounded-2xl border border-[#DCE7E9] bg-white p-6 sm:p-7 shadow-xs"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-[#083642]">
                        Lookup Existing Booking
                      </h2>
                      <p className="text-xs text-[#65747B]">
                        Retrieve your booking status, receipt details, or submit your 12-digit UPI UTR reference.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor="lookupRef">Booking Reference</Label>
                      <Input
                        id="lookupRef"
                        value={lookupRef}
                        onChange={(e) => setLookupRef(e.target.value)}
                        placeholder="EDF-20261124-XXXX"
                        className="font-mono-tabular uppercase"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label htmlFor="lookupPhone">Registered Mobile</Label>
                      <Input
                        id="lookupPhone"
                        value={lookupPhone}
                        onChange={(e) => setLookupPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                      />
                    </div>
                    <div className="sm:col-span-3 flex items-end">
                      <Button
                        type="submit"
                        disabled={lookupLoading}
                        className="w-full h-10"
                      >
                        {lookupLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Searching...</span>
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4" />
                            <span>Retrieve Booking</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {lookupError && (
                    <p className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">
                      {lookupError}
                    </p>
                  )}
                </form>

                {lookupResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="grid grid-cols-1 gap-6 lg:grid-cols-12"
                  >
                    <div className="lg:col-span-6 rounded-2xl border border-[#DCE7E9] bg-white p-6 space-y-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#287887]">
                            <span className="font-mono-tabular">
                              {lookupResult.appointment.bookingReference}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{humanizeStatus(lookupResult.appointment.status)}</span>
                          </div>
                          <h3 className="mt-1 font-display text-xl font-bold text-[#083642]">
                            {lookupResult.appointment.service.name}
                          </h3>
                          <p className="mt-1 text-sm text-[#65747B]">
                            {formatDateDisplay(lookupResult.appointment.appointmentDate)} ·{' '}
                            <span className="font-mono-tabular">
                              {formatSlotLabel(lookupResult.appointment.startTime)}–
                              {formatSlotLabel(lookupResult.appointment.endTime)}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(lookupResult.appointment.bookingReference, 'ref')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] px-3 py-1.5 text-xs font-medium text-[#083642] hover:border-[#287887] cursor-pointer shrink-0"
                        >
                          {copiedKey === 'ref' ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#15803D]" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy Ref</span>
                            </>
                          )}
                        </button>
                      </div>

                      {lookupResult.appointment.payments.length > 0 && (
                        <div className="border-t border-[#DCE7E9] pt-4 space-y-2.5">
                          <p className="text-xs font-semibold text-[#24343B]">
                            Submitted Payment Attempts
                          </p>
                          {lookupResult.appointment.payments.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] p-3.5 text-xs space-y-1"
                            >
                              <p className="font-mono-tabular font-medium text-[#083642]">
                                {p.paymentMethod || 'UPI'} Ref: {p.utrReference} ·{' '}
                                {formatInr(p.amountSubmittedInr)} · {humanizeStatus(p.status)}
                              </p>
                              {p.receiptNumber && (
                                <p className="text-[#0D4A5A] font-medium">
                                  Verified Receipt: {p.receiptNumber}
                                  {p.totalServiceFeeInr && p.totalServiceFeeInr > 0
                                    ? ` · Balance Due: ${formatInr(
                                        Math.max(0, p.totalServiceFeeInr - p.amountSubmittedInr)
                                      )}`
                                    : ''}
                                </p>
                              )}
                              {p.rejectionReason && (
                                <p className="text-[#B42318]">Rejection note: {p.rejectionReason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {lookupResult.appointment.reservationExpiresAt &&
                        lookupResult.appointment.status === 'PENDING_ADVANCE' && (
                          <div className="rounded-xl border border-[#C9E2E8] bg-[#E9F3F3]/60 p-3.5 text-xs text-[#083642] flex items-center justify-between gap-3">
                            <span>
                              Unpaid reservation held until{' '}
                              <span className="font-mono-tabular font-semibold">
                                {new Date(
                                  lookupResult.appointment.reservationExpiresAt
                                ).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              . Submit your UTR to retain this slot.
                            </span>
                            {reservationCountdown && (
                              <span className="font-mono-tabular font-bold text-[#0D4A5A] shrink-0">
                                {reservationCountdown}
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    <div className="lg:col-span-6 rounded-2xl border border-[#DCE7E9] bg-white p-6 space-y-4">
                      <h3 className="font-display text-base font-semibold text-[#083642]">
                        UPI Advance Payment &amp; UTR Submission
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-4 items-center rounded-xl bg-[#F8FAFA] p-4 border border-[#E9F3F3]">
                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE7E9] shrink-0">
                          <QRCodeSVG value={upiUri} size={118} />
                        </div>
                        <div className="text-xs space-y-2 flex-1 min-w-0">
                          <p className="font-bold text-sm text-[#083642] font-mono-tabular">
                            Advance Payable: {formatInr(lookupResult.upiPayment.expectedAdvanceInr)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular text-[#24343B] break-all">
                              UPI ID: {lookupResult.upiPayment.upiId}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(lookupResult.upiPayment.upiId, 'upi')}
                              className="inline-flex items-center gap-1 font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                            >
                              {copiedKey === 'upi' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <a
                            href={upiUri}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D4A5A]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D4A5A] hover:bg-[#E9F3F3]"
                          >
                            <Smartphone className="h-3.5 w-3.5" />
                            <span>Open UPI App</span>
                          </a>
                        </div>
                      </div>

                      {utrSuccess && (
                        <div className="rounded-xl bg-[#E9F3F3] border border-[#287887] p-3 text-xs text-[#083642]">
                          {utrSuccess}
                        </div>
                      )}
                      {utrError && (
                        <div className="rounded-xl bg-[#FEF3F2] border border-[#B42318]/40 p-3 text-xs text-[#B42318]">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        {renderEvidenceUploader('lookup-evidence-file')}
                        <Button
                          type="button"
                          disabled={utrSubmitting}
                          onClick={() =>
                            handleUtrSubmit(
                              lookupResult.appointment.bookingReference,
                              lookupResult.appointment.patientPhone
                            )
                          }
                          className="w-full h-11"
                        >
                          <Upload className="h-4 w-4" />
                          <span>
                            {utrSubmitting ? 'Submitting UTR...' : 'Submit Payment Reference'}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : confirmation ? (
              /* Booking Confirmation + UPI Advance Screen */
              <motion.div
                key="mode-confirmation"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-1 gap-6 lg:grid-cols-12"
              >
                <div className="lg:col-span-6 rounded-2xl border border-[#DCE7E9] bg-white p-6 sm:p-8 space-y-6 shadow-xs">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E9F3F3] text-[#0D4A5A]">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#287887]">
                          Appointment Request Registered
                        </p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-[#083642] font-mono-tabular">
                          {confirmation.appointment.bookingReference}
                        </h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(confirmation.appointment.bookingReference, 'ref')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] px-3 py-1.5 text-xs font-medium text-[#083642] hover:border-[#287887] cursor-pointer shrink-0"
                    >
                      {copiedKey === 'ref' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#15803D]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Ref</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border-t border-[#DCE7E9] pt-5 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#65747B]">Investigation</span>
                      <strong className="text-right text-[#083642]">
                        {confirmation.appointment.service.name}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#65747B]">Date &amp; Slot</span>
                      <strong className="font-mono-tabular text-right text-[#083642]">
                        {formatDateDisplay(confirmation.appointment.appointmentDate)} ·{' '}
                        {formatSlotLabel(confirmation.appointment.startTime)}–
                        {formatSlotLabel(confirmation.appointment.endTime)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#65747B]">Patient</span>
                      <span className="text-right text-[#24343B]">
                        {confirmation.appointment.patientName} ({confirmation.appointment.patientPhone})
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F4FAFC] border border-[#DCE7E9] p-4 text-xs leading-relaxed text-[#24343B]">
                    <p className="font-semibold text-[#083642]">Preparation Instructions</p>
                    <p className="mt-1.5 text-[#455A64]">
                      {confirmation.appointment.service.preparationNotes}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setConfirmation(null);
                      setUtrSuccess(null);
                      setSelectedSlot('');
                      setHeldUntilIso(null);
                      setActiveStep(1);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Book Another Appointment</span>
                  </Button>
                </div>

                <div className="lg:col-span-6 rounded-2xl border border-[#DCE7E9] bg-white p-6 sm:p-8 space-y-5 shadow-xs">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[#083642]">
                      Complete UPI Partial Advance
                    </h3>
                    <p className="mt-1 text-xs text-[#65747B] leading-relaxed">
                      1. Scan the QR or open your UPI app below. 2. Pay the advance &amp; copy your 12-digit UTR. 3. Submit the UTR here for manual confirmation by EDFIC reception.
                    </p>
                    {confirmation.appointment.reservationExpiresAt && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-[#C9E2E8] bg-[#E9F3F3]/60 px-3.5 py-2.5 text-xs text-[#083642]">
                        <span>
                          Reservation held until{' '}
                          <span className="font-mono-tabular font-semibold">
                            {new Date(
                              confirmation.appointment.reservationExpiresAt
                            ).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                        {reservationCountdown && (
                          <span className="font-mono-tabular font-bold text-[#0D4A5A]">
                            {reservationCountdown}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] p-4">
                    <div className="bg-white p-2.5 rounded-lg border border-[#DCE7E9] shrink-0">
                      <QRCodeSVG value={upiUri} size={132} />
                    </div>
                    <div className="space-y-2 text-xs flex-1 min-w-0">
                      <p className="text-base font-bold text-[#083642] font-mono-tabular">
                        Advance: {formatInr(confirmation.upiPayment.expectedAdvanceInr)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-tabular text-[#24343B] break-all">
                          UPI ID: {confirmation.upiPayment.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(confirmation.upiPayment.upiId, 'upi')}
                          className="font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                        >
                          {copiedKey === 'upi' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[#65747B]">{confirmation.upiPayment.merchantName}</p>
                      <a
                        href={upiUri}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D4A5A]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D4A5A] hover:bg-[#E9F3F3]"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>Pay Directly in UPI App</span>
                      </a>
                    </div>
                  </div>

                  {utrSuccess && (
                    <div className="rounded-xl border border-[#287887] bg-[#E9F3F3] p-3.5 text-xs text-[#083642]">
                      {utrSuccess}
                    </div>
                  )}
                  {utrError && (
                    <div className="rounded-xl border border-[#B42318]/40 bg-[#FEF3F2] p-3.5 text-xs text-[#B42318]">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    {renderEvidenceUploader('confirm-evidence-file')}
                    <Button
                      type="button"
                      disabled={utrSubmitting}
                      onClick={() =>
                        handleUtrSubmit(
                          confirmation.appointment.bookingReference,
                          confirmation.appointment.patientPhone
                        )
                      }
                      className="w-full h-11"
                    >
                      {utrSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Submitting UTR...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Submit UTR for Verification</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Interactive 3-Step Booking Workspace + Live Sticky Pass */
              <motion.div
                key="mode-book"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Interactive Progress Stepper */}
                <div className="rounded-2xl border border-[#DCE7E9] bg-white p-2 sm:p-2.5 shadow-xs">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        step: 1 as const,
                        title: '01. Investigation',
                        subtitle: selectedService ? selectedService.name : 'Choose ultrasound scan',
                        done: Boolean(selectedServiceId) && activeStep > 1,
                        disabled: false,
                      },
                      {
                        step: 2 as const,
                        title: '02. Date & Slot',
                        subtitle: selectedSlot
                          ? `${formatDateDisplay(selectedDate)} · ${formatSlotLabel(selectedSlot)}`
                          : 'Pick date & live timing',
                        done: Boolean(selectedSlot) && activeStep > 2,
                        disabled: !selectedServiceId,
                      },
                      {
                        step: 3 as const,
                        title: '03. Patient Details',
                        subtitle: watchedName?.trim()
                          ? watchedName.trim()
                          : 'Contact & statutory consent',
                        done: false,
                        disabled: !selectedServiceId || !selectedSlot,
                      },
                    ].map((item) => {
                      const isCurrent = activeStep === item.step;
                      return (
                        <button
                          key={item.step}
                          type="button"
                          disabled={item.disabled}
                          onClick={() => goToStep(item.step)}
                          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 ${
                            isCurrent
                              ? 'bg-[#0D4A5A] dark-teal:bg-[#136174] text-white shadow-sm'
                              : item.done
                                ? 'bg-[#E9F3F3]/80 text-[#083642] hover:bg-[#E9F3F3]'
                                : 'bg-transparent text-[#455A64] hover:bg-[#F8FAFA]'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono-tabular transition-colors ${
                              isCurrent
                                ? 'bg-white text-[#083642]'
                                : item.done
                                  ? 'bg-[#0D4A5A] text-white'
                                  : 'border border-[#C9D9DC] bg-white text-[#65747B]'
                            }`}
                          >
                            {item.done ? <Check className="h-3.5 w-3.5" /> : item.step}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{item.title}</p>
                            <p
                              className={`hidden sm:block text-[11px] truncate ${
                                isCurrent ? 'text-[#A5E4EB]' : 'text-[#65747B]'
                              }`}
                            >
                              {item.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main Split Grid: Active Interactive Step (Left 7 cols) + Sticky Live Pass (Right 5 cols) */}
                <div className="grid grid-cols-1 gap-7 lg:grid-cols-12 items-start">
                  <div className="lg:col-span-7">
                    <AnimatePresence mode="wait">
                      {/* STEP 1: Interactive Investigation Explorer */}
                      {activeStep === 1 && (
                        <motion.section
                          key="step-1"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-2xl border border-[#DCE7E9] bg-white p-5 sm:p-7 space-y-5 shadow-xs"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h2 className="font-display text-xl font-bold text-[#083642]">
                                01. Select Diagnostic Investigation
                              </h2>
                              <p className="mt-0.5 text-xs text-[#65747B]">
                                Filter by department or search for your prescribed scan.
                              </p>
                            </div>
                            <span className="text-xs font-mono-tabular text-[#65747B] shrink-0">
                              {filteredServices.length} available
                            </span>
                          </div>

                          {/* Instant Search */}
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
                            <input
                              type="text"
                              value={serviceSearch}
                              onChange={(e) => setServiceSearch(e.target.value)}
                              placeholder="Search e.g. Level-II Anomaly, NT Scan, Abdomen, Color Doppler..."
                              className="h-11 w-full rounded-xl border border-[#C9D9DC] bg-[#F8FAFA] pl-10 pr-10 text-sm text-[#24343B] placeholder:text-[#65747B]/75 transition-colors focus:border-[#0D4A5A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D4A5A]/15"
                            />
                            {serviceSearch && (
                              <button
                                type="button"
                                onClick={() => setServiceSearch('')}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#65747B] hover:text-[#083642] cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Interactive Department Filter Tabs */}
                          <div className="flex flex-wrap gap-1.5 border-b border-[#E9F3F3] pb-4">
                            <button
                              type="button"
                              onClick={() => setActiveCategoryId('ALL')}
                              className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                activeCategoryId === 'ALL'
                                  ? 'bg-[#0D4A5A] text-white'
                                  : 'bg-[#F4FAFC] text-[#455A64] hover:bg-[#E9F3F3] hover:text-[#083642]'
                              }`}
                            >
                              All Departments
                            </button>
                            {categories.map((cat) => {
                              const isActive = activeCategoryId === cat.id;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setActiveCategoryId(cat.id)}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                    isActive
                                      ? 'bg-[#0D4A5A] text-white'
                                      : 'bg-[#F4FAFC] text-[#455A64] hover:bg-[#E9F3F3] hover:text-[#083642]'
                                  }`}
                                >
                                  {cat.name}
                                </button>
                              );
                            })}
                          </div>

                          {/* Interactive Scan Grid */}
                          {servicesLoading ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {[1, 2, 3, 4].map((n) => (
                                <div
                                  key={n}
                                  className="h-28 rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] animate-pulse"
                                />
                              ))}
                            </div>
                          ) : filteredServices.length === 0 ? (
                            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] p-6 text-center space-y-2">
                              <p className="text-sm font-medium text-[#083642]">
                                No investigations match &ldquo;{serviceSearch}&rdquo;
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setServiceSearch('');
                                  setActiveCategoryId('ALL');
                                }}
                                className="text-xs font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                              >
                                Reset filters
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-[430px] overflow-y-auto pr-1">
                              {filteredServices.map((svc) => {
                                const selected = selectedServiceId === svc.id;
                                return (
                                  <motion.button
                                    key={svc.id}
                                    type="button"
                                    whileTap={{ scale: 0.985 }}
                                    onClick={() => setSelectedServiceId(svc.id)}
                                    className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                                      selected
                                        ? 'border-[#0D4A5A] bg-[#F4FAFC] ring-2 ring-[#0D4A5A]/15'
                                        : 'border-[#DCE7E9] bg-white hover:border-[#287887] hover:bg-[#FAFDFE]'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-display text-sm font-bold text-[#083642] leading-snug">
                                          {svc.name}
                                        </h3>
                                        <span
                                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                            selected
                                              ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white'
                                              : 'border-[#C9D9DC] bg-white'
                                          }`}
                                        >
                                          {selected && <Check className="h-3 w-3" />}
                                        </span>
                                      </div>
                                      <p className="mt-1.5 text-xs text-[#65747B] line-clamp-2 leading-relaxed">
                                        {svc.summary}
                                      </p>
                                    </div>
                                    <div className="mt-3 pt-2.5 border-t border-[#E9F3F3] flex items-center gap-2 text-[11px] font-medium text-[#287887]">
                                      <span className="font-mono-tabular">
                                        {svc.durationMinutes} min
                                      </span>
                                      {svc.requiresDoctorMorning && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span>Morning Specialist Wing</span>
                                        </>
                                      )}
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}

                          {/* Step 1 Footer CTA */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E9F3F3] pt-4">
                            <p className="text-xs text-[#65747B]">
                              {selectedService ? (
                                <>
                                  Selected:{' '}
                                  <strong className="text-[#083642]">
                                    {selectedService.name}
                                  </strong>
                                </>
                              ) : (
                                'Choose an investigation above to continue.'
                              )}
                            </p>
                            <Button
                              type="button"
                              disabled={!selectedServiceId}
                              onClick={() => goToStep(2)}
                              className="h-11 px-6"
                            >
                              <span>Choose Date &amp; Time</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.section>
                      )}

                      {/* STEP 2: Interactive Calendar Strip & Live Time Slots */}
                      {activeStep === 2 && (
                        <motion.section
                          key="step-2"
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-2xl border border-[#DCE7E9] bg-white p-5 sm:p-7 space-y-6 shadow-xs"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h2 className="font-display text-xl font-bold text-[#083642]">
                                02. Choose Date &amp; Live Slot
                              </h2>
                              <p className="mt-0.5 text-xs text-[#65747B]">
                                Clicking an open slot holds it exclusively for 5 minutes while you complete patient details.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => goToStep(1)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D4A5A] hover:underline cursor-pointer self-start sm:self-auto shrink-0"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span>Change Scan</span>
                            </button>
                          </div>

                          {/* 14-Day Quick Date Strip + Custom Calendar Input */}
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Label className="mb-0">Select Preferred Day</Label>
                              <div className="flex items-center gap-2">
                                <div className="inline-flex items-center rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-0.5">
                                  <button
                                    type="button"
                                    disabled={dateWeekOffset === 0}
                                    onClick={() => setDateWeekOffset(0)}
                                    aria-label="This week dates"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#083642] hover:bg-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>
                                  <span className="px-2 text-[11px] font-medium text-[#455A64]">
                                    {dateWeekOffset === 0 ? 'Days 1–7' : 'Days 8–14'}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={dateWeekOffset === 1}
                                    onClick={() => setDateWeekOffset(1)}
                                    aria-label="Next week dates"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#083642] hover:bg-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="relative">
                                  <input
                                    id="apptDate"
                                    type="date"
                                    aria-label="Pick custom appointment date"
                                    min={minDateIso}
                                    value={selectedDate}
                                    onChange={(e) => {
                                      if (e.target.value) setSelectedDate(e.target.value);
                                    }}
                                    className="h-8 rounded-lg border border-[#DCE7E9] bg-white px-2.5 text-xs font-mono-tabular text-[#083642] focus:border-[#0D4A5A] focus:outline-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                              {visibleQuickDates.map((d) => {
                                const isSelected = selectedDate === d.iso;
                                return (
                                  <motion.button
                                    key={d.iso}
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => setSelectedDate(d.iso)}
                                    className={`relative flex flex-col items-center justify-center rounded-xl border py-2.5 px-1.5 text-center transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white shadow-sm'
                                        : 'border-[#DCE7E9] bg-[#FAFDFE] text-[#24343B] hover:border-[#287887] hover:bg-[#F4FAFC]'
                                    }`}
                                  >
                                    <span
                                      className={`text-[11px] font-semibold ${
                                        isSelected ? 'text-[#A5E4EB]' : 'text-[#65747B]'
                                      }`}
                                    >
                                      {d.weekday}
                                    </span>
                                    <span className="mt-0.5 text-base font-bold font-mono-tabular">
                                      {d.dayNum}
                                    </span>
                                    <span
                                      className={`text-[10px] ${
                                        isSelected ? 'text-white/85' : 'text-[#65747B]'
                                      }`}
                                    >
                                      {d.isSunday ? 'Sun' : d.month}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>

                          {slotsMeta?.isSunday && (
                            <div className="rounded-xl border border-[#C9E2E8] bg-[#F4FAFC] px-4 py-2.5 text-xs text-[#0D4A5A] flex items-center gap-2">
                              <Clock className="h-4 w-4 shrink-0" />
                              <span>
                                Sunday scheduling window: 10:00 AM – 2:00 PM (by appointment).
                              </span>
                            </div>
                          )}

                          {/* Time-of-Day Interactive Filter */}
                          {!slotsLoading && !slotsMeta?.isHoliday && slots.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9F3F3] pt-4">
                              <div className="flex flex-wrap gap-1.5">
                                {(
                                  [
                                    {
                                      key: 'all' as const,
                                      label: 'All Timings',
                                      count: slotGroups.availableTotal,
                                      icon: Clock,
                                    },
                                    {
                                      key: 'morning' as const,
                                      label: 'Morning',
                                      count: slotGroups.morning.filter((s) => s.available).length,
                                      icon: Sunrise,
                                    },
                                    {
                                      key: 'afternoon' as const,
                                      label: 'Afternoon',
                                      count: slotGroups.afternoon.filter((s) => s.available).length,
                                      icon: Sun,
                                    },
                                    {
                                      key: 'evening' as const,
                                      label: 'Evening',
                                      count: slotGroups.evening.filter((s) => s.available).length,
                                      icon: Sunset,
                                    },
                                  ] as const
                                ).map((band) => {
                                  const BandIcon = band.icon;
                                  const active = timeBand === band.key;
                                  return (
                                    <button
                                      key={band.key}
                                      type="button"
                                      onClick={() => setTimeBand(band.key)}
                                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                        active
                                          ? 'bg-[#E9F3F3] text-[#083642] border border-[#287887]/40'
                                          : 'bg-white text-[#55676F] border border-[#DCE7E9] hover:border-[#287887]'
                                      }`}
                                    >
                                      <BandIcon className="h-3.5 w-3.5 text-[#287887]" />
                                      <span>{band.label}</span>
                                      <span className="font-mono-tabular text-[11px] opacity-75">
                                        ({band.count})
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Live Slots Grid */}
                          {slotsLoading ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <div
                                  key={n}
                                  className="h-12 rounded-xl bg-[#E9F3F3]/60 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : slotsMeta?.isHoliday ? (
                            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] p-5 text-xs text-[#24343B]">
                              Clinic closed on {formatDateDisplay(selectedDate)}:{' '}
                              {slotsMeta.holidayReason}
                            </div>
                          ) : visibleSlots.length === 0 ? (
                            <div className="rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] p-5 text-center space-y-2">
                              <p className="text-xs text-[#65747B]">
                                No slots available in this time window for{' '}
                                {formatDateDisplay(selectedDate)}.
                              </p>
                              {timeBand !== 'all' && slots.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setTimeBand('all')}
                                  className="text-xs font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                                >
                                  Show all timings
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {visibleSlots.map((slot) => {
                                const active = selectedSlot === slot.startTime;
                                const isHoldingThis = holdingSlot === slot.startTime;
                                return (
                                  <motion.button
                                    key={slot.startTime}
                                    type="button"
                                    disabled={!slot.available || Boolean(holdingSlot)}
                                    whileTap={slot.available ? { scale: 0.96 } : undefined}
                                    onClick={() => handleSelectSlot(slot.startTime)}
                                    className={`relative flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-xs font-mono-tabular transition-all cursor-pointer ${
                                      active
                                        ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white shadow-sm ring-2 ring-[#0D4A5A]/20'
                                        : slot.available
                                          ? 'border-[#C9D9DC] bg-white text-[#083642] hover:border-[#0D4A5A] hover:bg-[#F4FAFC]'
                                          : 'border-[#E9F3F3] bg-[#F8FAFA] text-[#65747B]/45 cursor-not-allowed line-through'
                                    }`}
                                  >
                                    <span className="font-semibold">
                                      {isHoldingThis ? 'Holding...' : formatSlotLabel(slot.startTime)}
                                    </span>
                                    {slot.available && (
                                      <span
                                        className={`mt-0.5 text-[10px] font-sans ${
                                          active ? 'text-[#A5E4EB]' : 'text-[#287887]'
                                        }`}
                                      >
                                        {active ? 'Held for you' : `${slot.remainingCapacity} left`}
                                      </span>
                                    )}
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}

                          {/* Live Hold Confirmation Banner */}
                          <AnimatePresence>
                            {selectedSlot && holdCountdown && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="rounded-xl border border-[#287887]/40 bg-[#E9F3F3]/75 px-4 py-3 text-xs text-[#083642] flex flex-wrap items-center justify-between gap-2"
                              >
                                <span className="flex items-center gap-2 font-medium">
                                  <Clock className="h-4 w-4 text-[#0D4A5A] shrink-0" />
                                  <span>
                                    Slot <strong>{formatSlotLabel(selectedSlot)}</strong> on{' '}
                                    {formatDateDisplay(selectedDate)} is held for you.
                                  </span>
                                </span>
                                <span className="font-mono-tabular font-bold text-[#0D4A5A]">
                                  {holdCountdown === '00:00'
                                    ? 'Hold expired — tap slot again'
                                    : `Hold expires in ${holdCountdown}`}
                                </span>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {slotError && (
                            <p className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">
                              {slotError}
                            </p>
                          )}

                          {/* Step 2 Navigation Footer */}
                          <div className="flex items-center justify-between gap-3 border-t border-[#E9F3F3] pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => goToStep(1)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span>Back</span>
                            </Button>
                            <Button
                              type="button"
                              disabled={!selectedSlot}
                              onClick={() => goToStep(3)}
                              className="h-11 px-6"
                            >
                              <span>
                                {selectedSlot
                                  ? 'Continue to Patient Details'
                                  : 'Select a Time Slot'}
                              </span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.section>
                      )}

                      {/* STEP 3: Patient Details & Consent */}
                      {activeStep === 3 && (
                        <motion.section
                          key="step-3"
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-2xl border border-[#DCE7E9] bg-white p-5 sm:p-7 shadow-xs"
                        >
                          <form onSubmit={handleSubmit(onBookSubmit)} className="space-y-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h2 className="font-display text-xl font-bold text-[#083642]">
                                  03. Patient Details &amp; Confirmation
                                </h2>
                                <p className="mt-0.5 text-xs text-[#65747B]">
                                  Enter legal patient name as shown on Photo ID for registration and Form F records.
                                </p>
                              </div>
                              {holdCountdown && (
                                <span className="font-mono-tabular text-xs font-semibold text-[#0D4A5A] bg-[#E9F3F3] px-3 py-1.5 rounded-lg shrink-0">
                                  Slot Held: {holdCountdown}
                                </span>
                              )}
                            </div>

                            {bookingError && (
                              <div className="rounded-xl bg-[#FEF3F2] border border-[#B42318]/40 p-3.5 text-xs text-[#B42318]">
                                {bookingError}
                              </div>
                            )}

                            <div>
                              <Label htmlFor="patientName">Patient Full Name *</Label>
                              <Input
                                id="patientName"
                                {...register('patientName')}
                                placeholder="Full legal name (as on Photo ID)"
                              />
                              {errors.patientName && (
                                <p className="mt-1 text-xs text-[#B42318]">
                                  {errors.patientName.message}
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <Label htmlFor="patientPhone">Mobile Number *</Label>
                                <Input
                                  id="patientPhone"
                                  {...register('patientPhone')}
                                  placeholder="10-digit mobile number"
                                />
                                {errors.patientPhone && (
                                  <p className="mt-1 text-xs text-[#B42318]">
                                    {errors.patientPhone.message}
                                  </p>
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
                                {errors.patientEmail && (
                                  <p className="mt-1 text-xs text-[#B42318]">
                                    {errors.patientEmail.message}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
                                <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
                              </div>
                              <div>
                                <Label htmlFor="referringDoctor">
                                  Referring Clinician (Optional)
                                </Label>
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

                            {/* Interactive Statutory Consent Card */}
                            <label
                              className={`flex items-start gap-3 rounded-xl border p-4 text-xs leading-relaxed transition-colors cursor-pointer ${
                                watchedConsent
                                  ? 'border-[#0D4A5A] bg-[#F4FAFC] text-[#083642]'
                                  : 'border-[#DCE7E9] bg-[#FAFDFE] text-[#24343B] hover:border-[#287887]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                {...register('consentAccepted')}
                                className="mt-0.5 h-4 w-4 rounded border-[#C9D9DC] text-[#0D4A5A] accent-[#0D4A5A]"
                              />
                              <span>
                                I acknowledge the EDFIC Patient Consent Policy and statutory PCPNDT Act guidelines (prenatal sex determination is strictly prohibited and not requested).
                              </span>
                            </label>
                            {errors.consentAccepted && (
                              <p className="text-xs text-[#B42318]">
                                {errors.consentAccepted.message}
                              </p>
                            )}

                            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E9F3F3] pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => goToStep(2)}
                              >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Change Slot</span>
                              </Button>
                              <Button
                                type="submit"
                                disabled={isSubmitting || !selectedSlot}
                                className="h-11 px-6 flex-1 sm:flex-initial"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Reserving Appointment...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>
                                      Confirm Slot ({formatSlotLabel(selectedSlot)}) &amp; Proceed
                                    </span>
                                    <ArrowRight className="h-4 w-4" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </form>
                        </motion.section>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right Sticky Column: Live Appointment Pass & Clinical Prep */}
                  <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
                    <div className="rounded-2xl border border-[#DCE7E9] bg-white p-6 space-y-5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-[#E9F3F3] pb-4">
                        <div>
                          <p className="text-xs font-semibold text-[#287887]">
                            Live Visit Pass
                          </p>
                          <h3 className="font-display text-lg font-bold text-[#083642]">
                            Your Booking Summary
                          </h3>
                        </div>
                        <Sparkles className="h-5 w-5 text-[#287887]" />
                      </div>

                      {/* Selected Scan Summary */}
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Stethoscope className="h-4 w-4 text-[#0D4A5A] mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-[#65747B]">
                                Investigation
                              </p>
                              <p className="text-sm font-semibold text-[#083642] leading-snug">
                                {selectedService ? selectedService.name : 'Not selected yet'}
                              </p>
                              {selectedService && (
                                <p className="mt-0.5 text-xs text-[#65747B]">
                                  <span className="font-mono-tabular">
                                    {selectedService.durationMinutes} min
                                  </span>
                                  {selectedService.requiresDoctorMorning &&
                                    ' · Dr. Varun Agrawal Morning Session'}
                                </p>
                              )}
                            </div>
                          </div>
                          {activeStep !== 1 && (
                            <button
                              type="button"
                              onClick={() => goToStep(1)}
                              className="text-xs font-semibold text-[#0D4A5A] hover:underline shrink-0 cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {/* Selected Date & Slot Summary */}
                        <div className="flex items-start justify-between gap-3 border-t border-[#E9F3F3] pt-4">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Calendar className="h-4 w-4 text-[#0D4A5A] mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-[#65747B]">
                                Date &amp; Time Window
                              </p>
                              <p className="text-sm font-semibold text-[#083642]">
                                {formatDateDisplay(selectedDate)}
                              </p>
                              <p className="mt-0.5 text-xs font-mono-tabular text-[#287887]">
                                {selectedSlot
                                  ? `${formatSlotLabel(selectedSlot)}${
                                      holdCountdown ? ` · Held (${holdCountdown})` : ''
                                    }`
                                  : 'Select a slot in Step 02'}
                              </p>
                            </div>
                          </div>
                          {activeStep !== 2 && selectedServiceId && (
                            <button
                              type="button"
                              onClick={() => goToStep(2)}
                              className="text-xs font-semibold text-[#0D4A5A] hover:underline shrink-0 cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dynamic Scan Preparation Card */}
                      {selectedService && (
                        <div className="rounded-xl bg-[#F4FAFC] border border-[#DCE7E9] p-4 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#083642]">
                            <FileText className="h-3.5 w-3.5 text-[#0D4A5A]" />
                            <span>Pre-Scan Preparation</span>
                          </div>
                          <p className="text-xs leading-relaxed text-[#455A64]">
                            {selectedService.preparationNotes}
                          </p>
                        </div>
                      )}

                      {/* Trust & Verification Note */}
                      <div className="border-t border-[#E9F3F3] pt-4 space-y-2 text-xs text-[#455A64]">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="h-4 w-4 text-[#287887] shrink-0 mt-0.5" />
                          <span>
                            Carry government photo ID &amp; prior prescriptions for obstetric / Form F studies.
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-[#287887] shrink-0 mt-0.5" />
                          <span>
                            Instant booking reference generated before UPI advance payment.
                          </span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </PublicLayout>
  );
}

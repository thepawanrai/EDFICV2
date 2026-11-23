import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CalendarClock, CheckCircle2, PhoneCall } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';
import { usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

const quickAppointmentFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter patient full name')
    .max(120, 'Name must be under 120 characters'),
  phone: z
    .string()
    .trim()
    .refine((val) => val.replace(/\D/g, '').length >= 10 && val.length <= 16, {
      message: 'Please enter a valid 10-digit mobile number',
    }),
  preferredService: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredWindow: z.enum(['MORNING', 'AFTERNOON_EVENING', 'EARLIEST_AVAILABLE']),
  notes: z.string().max(600, 'Notes must be under 600 characters').optional(),
});

type QuickAppointmentFormValues = z.infer<typeof quickAppointmentFormSchema>;

interface QuickAppointmentResponse {
  leadCode: string;
  preferredService: string;
  windowLabel: string;
  preferredDate: string;
  message: string;
}

export function QuickAppointmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const { data: servicesData } = usePublicServices();
  const [submittedResult, setSubmittedResult] =
    useState<QuickAppointmentResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const serviceNames = useMemo(() => {
    const names: string[] = [];
    for (const cat of servicesData?.categories ?? []) {
      for (const svc of cat.services ?? []) {
        names.push(svc.name);
      }
    }
    return names;
  }, [servicesData]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickAppointmentFormValues>({
    resolver: zodResolver(quickAppointmentFormSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      preferredService: '',
      preferredDate: todayStr,
      preferredWindow: 'MORNING',
      notes: '',
    },
  });

  const handleClose = () => {
    setSubmitError(null);
    setSubmittedResult(null);
    reset({
      fullName: '',
      phone: '',
      preferredService: '',
      preferredDate: todayStr,
      preferredWindow: 'MORNING',
      notes: '',
    });
    onClose();
  };

  const onSubmit = async (values: QuickAppointmentFormValues) => {
    setSubmitError(null);
    try {
      const response = await apiFetch<QuickAppointmentResponse>(
        '/api/v1/public/quick-appointment',
        {
          method: 'POST',
          body: JSON.stringify(values),
        }
      );
      setSubmittedResult(response);
      notify({
        title: 'Quick Appointment Requested',
        description: `Reference ${response.leadCode} logged with EDFIC Reception.`,
        variant: 'success',
      });
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to submit your request right now. Please try again.'
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Quick Appointment Request"
      description="Request a fast callback from EDFIC Reception to confirm your scan slot - no upfront payment required here."
      className="max-w-md"
    >
      {submittedResult ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#287887]/40 bg-[#E9F3F3] p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-display text-sm font-bold text-[#083642]">
                  Request Registered with EDFIC Reception
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#354B54]">
                  {submittedResult.message}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#DCE7E9] bg-white px-3.5 py-2.5 text-xs space-y-1">
              <p className="font-mono-tabular font-semibold text-[#0D4A5A]">
                Reference: {submittedResult.leadCode}
              </p>
              <p className="text-[#24343B]">
                Study: <span className="font-medium">{submittedResult.preferredService}</span>
              </p>
              <p className="text-[#65747B]">
                Preferred: {submittedResult.preferredDate} · {submittedResult.windowLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <Button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto sm:flex-1"
            >
              Done
            </Button>
            <Link
              to="/book"
              onClick={handleClose}
              className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-md border border-[#C9D9DC] bg-white px-4 text-xs font-semibold text-[#083642] transition-colors hover:bg-[#F8FAFA] hover:border-[#287887]"
            >
              <span>Full Slot Booking</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          {submitError && (
            <div
              role="alert"
              className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]"
            >
              {submitError}
            </div>
          )}

          <div>
            <Label htmlFor="quickFullName">Patient Full Name</Label>
            <Input
              id="quickFullName"
              autoFocus
              placeholder="e.g. Priya Verma"
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="mt-1 text-xs text-[#B42318]">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="quickPhone">Mobile / WhatsApp Number</Label>
            <Input
              id="quickPhone"
              type="tel"
              inputMode="tel"
              placeholder="10-digit mobile number"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-[#B42318]">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="quickService">Scan or Investigation</Label>
            <Select id="quickService" {...register('preferredService')}>
              <option value="">General Ultrasound / Reception Guidance</option>
              {serviceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="quickDate">Preferred Date</Label>
              <Input
                id="quickDate"
                type="date"
                min={todayStr}
                {...register('preferredDate')}
              />
            </div>

            <div>
              <Label htmlFor="quickWindow">Preferred Session</Label>
              <Select id="quickWindow" {...register('preferredWindow')}>
                <option value="MORNING">Morning (9:30 AM - 1:30 PM)</option>
                <option value="AFTERNOON_EVENING">Afternoon / Eve (2 - 8 PM)</option>
                <option value="EARLIEST_AVAILABLE">Earliest Available</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="quickNotes">Short Note (Optional)</Label>
            <Textarea
              id="quickNotes"
              rows={2}
              className="min-h-[64px]"
              placeholder="Referring doctor, gestational week, or preparation query"
              {...register('notes')}
            />
            {errors.notes && (
              <p className="mt-1 text-xs text-[#B42318]">{errors.notes.message}</p>
            )}
          </div>

          <div className="pt-1 flex flex-col gap-2.5">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full"
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              <span>
                {isSubmitting ? 'Sending Request...' : 'Request Quick Appointment'}
              </span>
            </Button>

            <div className="flex items-center justify-between gap-2 border-t border-[#E9F3F3] pt-2.5 text-[11px] text-[#65747B]">
              <span className="inline-flex items-center gap-1">
                <PhoneCall className="h-3 w-3 text-[#287887]" aria-hidden="true" />
                <span>Priority callback from Reception</span>
              </span>
              <Link
                to="/book"
                onClick={handleClose}
                className="font-semibold text-[#0D4A5A] hover:underline whitespace-nowrap"
              >
                Full Slot &amp; UPI Booking →
              </Link>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}

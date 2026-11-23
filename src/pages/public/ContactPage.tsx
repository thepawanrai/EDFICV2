import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { usePublicClinic, usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';
import { ClinicLocationMap } from '../../components/public/ClinicLocationMap';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name.'),
  phone: z.string().min(10, 'Please enter a valid 10-digit phone number.').max(15),
  email: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
  interestedService: z.string().optional(),
  message: z.string().min(5, 'Please share a brief description of your inquiry.'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactPage() {
  const { data: clinicData } = usePublicClinic();
  const { data: servicesData } = usePublicServices();
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clinic = clinicData?.clinic;
  const allServices =
    servicesData?.categories.flatMap((c) => c.services) ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitError(null);
    try {
      const res = await apiFetch<{ leadCode: string }>('/api/v1/public/inquiries', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setSubmittedRef(res.leadCode);
      reset();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit inquiry.');
    }
  };

  return (
    <PublicLayout>
      <SeoHead
        title="Contact & Location - Sushant Golf City | EDFIC Lucknow"
        description="Visit EDFIC at Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall), Lucknow. Check operating hours or submit a reception inquiry online."
        canonicalPath="/contact"
        structuredData={buildClinicJsonLd({
          primaryPhone: clinic?.primaryPhone,
          officialEmail: clinic?.officialEmail,
        })}
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#287887]">
            EDFIC · A Unit of EWA DERMA
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Contact &amp; Location
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#65747B]">
            Reach our reception desk for scheduling guidance, scan preparation questions, or referral coordination.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Clinic Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-5">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#083642]">
                    Centre Address
                  </h2>
                  <p className="mt-1 text-sm text-[#24343B]">
                    {clinic?.fullName || 'EWA Diagnostic and Fetal Imaging Centre'}
                  </p>
                  <p className="text-xs text-[#287887] font-medium">
                    {clinic?.parentUnitName || 'A Unit of EWA DERMA'}
                  </p>
                  <p className="mt-1.5 text-sm text-[#65747B]">
                    {clinic?.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'}
                    <br />
                    {clinic?.landmark || 'Near Lulu Mall'}
                    <br />
                    {clinic?.cityStateCountry || 'Lucknow, Uttar Pradesh, India'}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#E9F3F3] pt-4 flex items-start gap-3">
                <Clock className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#083642]">
                    Operating Hours
                  </h2>
                  <p className="mt-1 text-sm text-[#65747B]">
                    {clinic?.weekdayHours || 'Monday–Saturday: 9:00 AM – 8:00 PM'}
                  </p>
                  <p className="text-sm text-[#65747B]">
                    {clinic?.sundayHours || 'Sunday: 10:00 AM – 2:00 PM (By Appointment)'}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#E9F3F3] pt-4 flex items-start gap-3">
                <Phone className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#083642]">
                    Reception Contact
                  </h2>
                  {clinic?.primaryPhone ? (
                    <div className="mt-1 space-y-1 text-sm font-mono-tabular text-[#24343B]">
                      <p>Phone: {clinic.primaryPhone}</p>
                      {clinic.secondaryPhone && <p>Alternate: {clinic.secondaryPhone}</p>}
                      {clinic.whatsappNumber && <p>WhatsApp: {clinic.whatsappNumber}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-[#65747B]">
                      Official reception phone numbers are pending publication and configurable via EDFIC Admin Settings. Please use the online inquiry form or appointment portal.
                    </p>
                  )}
                </div>
              </div>

              {clinic?.officialEmail && (
                <div className="border-t border-[#E9F3F3] pt-4 flex items-start gap-3">
                  <Mail className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display text-sm font-semibold text-[#083642]">
                      Email
                    </h2>
                    <p className="mt-1 text-sm text-[#65747B]">{clinic.officialEmail}</p>
                  </div>
                </div>
              )}

              <div className="border-t border-[#E9F3F3] pt-4">
                <h2 className="font-display text-sm font-semibold text-[#083642]">
                  Follow EDFIC
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <a
                    href="https://www.facebook.com/ewafetalimaging"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="EDFIC on Facebook"
                    title="Facebook"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white text-[#0D4A5A] transition-colors hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H7.7V14h2.7v8h3.1Z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/ewafetalimaging"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="EDFIC on Instagram"
                    title="Instagram"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white text-[#0D4A5A] transition-colors hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
                    </svg>
                  </a>
                  <a
                    href="https://www.youtube.com/@ewafetalimaging"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="EDFIC on YouTube"
                    title="YouTube"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white text-[#0D4A5A] transition-colors hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C1.9 8.9 1.9 12 1.9 12s0 3.1.5 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8ZM10 15.1V8.9l5.3 3.1-5.3 3.1Z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* CRM Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
              <h2 className="font-display text-lg font-semibold text-[#083642]">
                Send an Inquiry to Reception
              </h2>
              <p className="mt-1 text-xs text-[#65747B]">
                Inquiries are logged directly into the EDFIC reception desk for follow-up.
              </p>

              {submittedRef && (
                <div className="mt-5 rounded-md border border-[#287887] bg-[#E9F3F3] p-4 text-sm text-[#083642]">
                  <p className="font-semibold">
                    Inquiry registered · Reference <span className="font-mono-tabular">{submittedRef}</span>
                  </p>
                  <p className="mt-1 text-xs">
                    Our reception team will review your request and follow up shortly.
                  </p>
                </div>
              )}

              {submitError && (
                <div className="mt-5 rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" {...register('fullName')} placeholder="Patient or caller name" />
                    {errors.fullName && (
                      <p className="mt-1 text-xs text-[#B42318]">{errors.fullName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Mobile Number</Label>
                    <Input id="phone" {...register('phone')} placeholder="10-digit mobile number" />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-[#B42318]">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="email">Email Address (Optional)</Label>
                    <Input id="email" type="email" {...register('email')} placeholder="name@example.com" />
                    {errors.email && (
                      <p className="mt-1 text-xs text-[#B42318]">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="interestedService">Investigation of Interest (Optional)</Label>
                    <Select id="interestedService" {...register('interestedService')}>
                      <option value="">General Inquiry</option>
                      {allServices.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Message / Clinical Referral Query</Label>
                  <Textarea
                    id="message"
                    {...register('message')}
                    placeholder="Share your preferred visit window or preparation question (do not send confidential clinical reports here)."
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-[#B42318]">{errors.message.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                </Button>
              </form>
            </div>
          </div>
        </div>

        <ClinicLocationMap
          clinicName={clinic?.fullName}
          addressLine={clinic?.addressLine}
          landmark={clinic?.landmark}
          cityStateCountry={clinic?.cityStateCountry}
        />
      </div>
    </PublicLayout>
  );
}

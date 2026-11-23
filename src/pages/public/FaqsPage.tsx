import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import {
  CLINICAL_FAQS,
  FaqAccordionSection,
} from '../../components/public/FaqAccordionSection';
import { SeoHead } from '../../components/seo/SeoHead';

export function FaqsPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Frequently Asked Questions | EDFIC Lucknow"
        description="Answers on fetal imaging, diagnostic ultrasound preparation, Dr. Varun Agrawal morning sessions, PCPNDT Act compliance, UPI advance verification, and Patient Portal security at EDFIC."
        canonicalPath="/faqs"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: CLINICAL_FAQS.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        }}
      />

      <div className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
              PATIENT HELP DESK
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
              Frequently Asked Questions
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-[#65747B]">
              Organized clinical guidance on obstetric fetal imaging, general diagnostic ultrasound preparation, appointment slot confirmation, and private Patient Portal reports.
            </p>
          </div>

          <FaqAccordionSection variant="full" />

          <div className="mt-12 rounded-2xl border border-[#DCE7E9] bg-[#F6FAFB] p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="font-display text-base font-bold text-[#083642]">
                Need specific preparation help for a prescribed scan?
              </h2>
              <p className="text-xs leading-relaxed text-[#65747B]">
                Review scan-specific fasting or hydration instructions on our Patient Information guide or contact EDFIC reception directly.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                to="/patient-info"
                className="inline-flex h-10 items-center rounded-full border border-[#C9D9DC] bg-white px-5 text-xs font-semibold text-[#083642] hover:border-[#0D4A5A]"
              >
                Preparation Guide
              </Link>
              <Link
                to="/book"
                className="edfic-btn-slide inline-flex h-10 items-center rounded-full px-5 text-xs font-semibold text-white"
              >
                <span className="relative z-10">Book Slot</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

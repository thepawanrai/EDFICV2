import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';

export function PatientInfoPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Patient Information & Scan Preparation | EDFIC Lucknow"
        description="Mandatory ID & prescription documents, fasting/bladder scan preparation instructions, and private Patient Portal report access guidance for EDFIC Lucknow."
        canonicalPath="/patient-info"
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <p className="text-xs font-semibold text-[#287887]">
            Visit Preparation · EDFIC Lucknow
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Patient Information &amp; Preparation Guidelines
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#65747B]">
            Helpful checklists before arriving for your diagnostic ultrasound appointment at Sushant Golf City.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              1. Mandatory Documents to Carry
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1.5 text-sm text-[#65747B]">
              <li>Referring doctor&apos;s prescription or antenatal card.</li>
              <li>Valid government-issued photo ID (mandatory for obstetric examinations under PCPNDT rules).</li>
              <li>All previous ultrasound reports, blood test reports, and surgical/clinical notes for comparison.</li>
              <li>Your EDFIC booking reference (<span className="font-mono-tabular">EDF-...</span>) and verified UPI receipt reference.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              2. General Scan Preparation Summary
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1.5 text-sm text-[#65747B]">
              <li><strong>Abdomen / Abdomen Doppler / Renal Doppler:</strong> 6 hours fasting (plain water allowed).</li>
              <li><strong>KUB &amp; Transabdominal Pelvic Scans:</strong> Drink 3–4 glasses of water 45–60 minutes prior and hold urine.</li>
              <li><strong>TVS / Follicular Monitoring:</strong> Empty bladder immediately prior to scan.</li>
              <li><strong>NT / Anomaly / Growth / Fetal Echo:</strong> No fasting needed; carry prior trimester scan reports.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              3. Accessing Your Diagnostic Report
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65747B]">
              Once Dr. Varun Agrawal reviews and publishes your diagnostic report, you will receive a portal availability notice. Sign in to the secure EDFIC Patient Portal to download your verified PDF report. Reports are never sent over public links or unencrypted messaging attachments.
            </p>
            <div className="mt-4">
              <Link
                to="/portal"
                className="inline-flex h-9 items-center rounded-md border border-[#0D4A5A] px-4 text-xs font-medium text-[#0D4A5A] hover:bg-[#E9F3F3]"
              >
                Open Patient Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

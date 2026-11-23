import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';

export function TechnologyPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Technology, Hygiene & Diagnostic Standards | EDFIC"
        description="Overview of EDFIC multi-transducer ultrasound imaging architecture, Color and Spectral Doppler, probe sterilization standards, and private diagnostic report security."
        canonicalPath="/technology"
        structuredData={buildClinicJsonLd()}
      />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div>
          <p className="text-xs font-semibold text-[#287887]">
            Clinical Infrastructure · EDFIC Lucknow
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Technology, Hygiene &amp; Diagnostic Standards
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-[#65747B]">
            Factual overview of diagnostic imaging capabilities, transducer hygiene, and secure report delivery protocols maintained at EDFIC.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              Multi-Transducer Ultrasound Architecture
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65747B]">
              Imaging suites are equipped with convex abdominal/obstetric probes, high-frequency linear array probes for thyroid, breast, MSK, and small-parts studies, and specialized endovaginal 2D/3D transducers for pelvic and early pregnancy evaluations.
            </p>
          </div>
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              Color &amp; Spectral Doppler
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65747B]">
              Supports fetal umbilical, middle cerebral artery, uterine artery, and ductus venosus waveforms alongside peripheral arterial, venous, carotid, renal, and abdominal vascular Doppler investigations.
            </p>
          </div>
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              Infection Control &amp; Probe Sterility
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65747B]">
              Single-use sterile transducer covers, medical-grade high-level probe disinfection between scans, and clean clinical preparation rooms ensure patient safety during transvaginal and image-guided FNAC procedures.
            </p>
          </div>
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-[#083642]">
              Private Digital Report Vault
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#65747B]">
              Signed diagnostic PDF reports are stored in private, access-controlled server storage and released strictly through authenticated patient portal sessions with download audit trails - never exposed on public URLs or unencrypted chat forwards.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-[#C9D9DC] bg-white p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#083642]">
              Approved Centre Equipment &amp; Facility Assets
            </p>
            <p className="mt-1 text-xs text-[#65747B]">
              Verified facility photography and equipment specification sheets are published upon final administrative sign-off - no stock or fabricated hardware imagery is displayed.
            </p>
          </div>
          <Link
            to="/book"
            className="inline-flex h-10 items-center rounded-md bg-[#0D4A5A] px-5 text-sm font-medium text-white hover:bg-[#083642] whitespace-nowrap shrink-0"
          >
            Schedule Appointment
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}

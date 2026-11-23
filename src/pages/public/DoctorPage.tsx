import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { usePublicClinic } from '../../hooks/usePublicClinic';

export function DoctorPage() {
  const { data } = usePublicClinic();
  const doctor = data?.doctor;

  return (
    <PublicLayout>
      <SeoHead
        title="Dr. Varun Agrawal (DNB Radiology) | EDFIC Lucknow"
        description="Meet Dr. Varun Agrawal, DNB Radiology - Consultant Radiologist & Fetal Medicine Specialist leading daily morning fetal imaging and Doppler sessions at EDFIC Lucknow."
        canonicalPath="/doctor"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Physician',
          name: doctor?.name || 'Dr. Varun Agrawal',
          medicalSpecialty: ['Radiology', 'Fetal Medicine'],
          description: `${doctor?.qualification || 'DNB Radiology'} - ${doctor?.designation || 'Consultant Radiologist & Fetal Medicine Specialist'}`,
          worksFor: {
            '@type': 'MedicalClinic',
            name: 'EDFIC - EWA Diagnostic and Fetal Imaging Centre',
          },
        }}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <p className="text-xs font-semibold text-[#287887]">
            Medical Authority · EDFIC (A Unit of EWA DERMA)
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Specialist Radiologist Profile
          </h1>
        </div>

        <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Respectful non-fabricated credential monogram frame */}
            <div className="md:col-span-4">
              <div className="aspect-[3/4] rounded-lg border border-[#DCE7E9] bg-[#E9F3F3]/60 flex flex-col items-center justify-center p-6 text-center">
                <div className="h-20 w-20 rounded-full bg-[#0D4A5A] text-white flex items-center justify-center font-display text-2xl font-bold">
                  VA
                </div>
                <p className="mt-4 font-display text-base font-semibold text-[#083642]">
                  {doctor?.name || 'Dr. Varun Agrawal'}
                </p>
                <p className="mt-1 text-xs font-medium text-[#287887]">
                  {doctor?.qualification || 'DNB Radiology'}
                </p>
                <p className="mt-3 text-[11px] text-[#65747B]">
                  Verified clinical portrait pending official EDFIC asset upload.
                </p>
              </div>
            </div>

            <div className="md:col-span-8 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#083642]">
                  {doctor?.name || 'Dr. Varun Agrawal'}
                </h2>
                <p className="mt-1 text-sm font-medium text-[#0D4A5A]">
                  {doctor?.qualification || 'DNB Radiology'} ·{' '}
                  {doctor?.designation || 'Consultant Radiologist & Fetal Medicine Specialist'}
                </p>
              </div>

              <div className="border-t border-[#DCE7E9] pt-4">
                <h3 className="text-xs font-semibold text-[#24343B]">
                  Areas of Clinical Expertise
                </h3>
                <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-[#24343B]">
                  {(doctor?.expertise || [
                    'NT Scan',
                    'Anomaly Scan',
                    'Growth Scan',
                    'Doppler',
                    'Fetal Echo',
                    'BPP',
                  ]).map((item) => (
                    <li
                      key={item}
                      className="rounded-md border border-[#E9F3F3] bg-[#F8FAFA] px-3 py-2 text-xs font-medium"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[#DCE7E9] pt-4 text-sm">
                <p className="font-semibold text-[#083642]">Consultation &amp; Scan Availability</p>
                <p className="mt-1 text-[#65747B]">
                  {doctor?.availability || 'Morning session, daily'} at EDFIC, Sushant Golf City, Lucknow.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/book"
                  className="inline-flex h-10 items-center rounded-md bg-[#0D4A5A] px-5 text-sm font-medium text-white hover:bg-[#083642]"
                >
                  Schedule Morning Session Slot
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

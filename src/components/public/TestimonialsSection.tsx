import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import anitaDeviImg from '../../assets/testimonials/anita-devi.png';
import rajeshSharmaImg from '../../assets/testimonials/rajesh-sharma.png';
import pawanImg from '../../assets/testimonials/pawan.png';
import maheshAgarwalImg from '../../assets/testimonials/mahesh-agarwal.png';
import sunitaMishraImg from '../../assets/testimonials/sunita-mishra.png';

interface PatientTestimonial {
  id: string;
  name: string;
  visitContext: string;
  locality: string;
  quote: string;
  image: string;
}

const PATIENT_TESTIMONIALS: PatientTestimonial[] = [
  {
    id: 'anita-devi',
    name: 'Anita Devi',
    visitContext: 'Level-II Fetal Anomaly Scan',
    locality: 'Gomti Nagar Extension, Lucknow',
    quote:
      'Our morning fetal scan appointment started right on schedule. Dr. Varun Agrawal explained every ultrasound step patiently and clearly, and the imaging suite felt calm, clean, and reassuring throughout our visit.',
    image: anitaDeviImg,
  },
  {
    id: 'rajesh-sharma',
    name: 'Rajesh Sharma',
    visitContext: 'Abdominal Ultrasound',
    locality: 'Sushant Golf City, Lucknow',
    quote:
      'The reception team guided us clearly on fasting preparation before we arrived near Lulu Mall. Verification was smooth and our signed diagnostic PDF appeared privately in the patient portal the same day.',
    image: rajeshSharmaImg,
  },
  {
    id: 'pawan',
    name: 'Pawan',
    visitContext: 'Color Doppler Study',
    locality: 'Shaheed Path, Lucknow',
    quote:
      'Finding a well-organized diagnostic centre in Sushant Golf City with clear slot timing made a huge difference for my father’s Doppler study. The staff respected our privacy and kept waiting time minimal.',
    image: pawanImg,
  },
  {
    id: 'mahesh-agarwal',
    name: 'Mahesh Agarwal',
    visitContext: 'KUB & Organ Ultrasound',
    locality: 'Vrindavan Yojana, Lucknow',
    quote:
      'Very hygienic clinic environment with single-use probe covers and clear preparation instructions beforehand. Both the reception desk and radiology team handled everything with courtesy and professionalism.',
    image: maheshAgarwalImg,
  },
  {
    id: 'sunita-mishra',
    name: 'Sunita Mishra',
    visitContext: 'Third-Trimester Growth & Doppler',
    locality: 'Indira Nagar, Lucknow',
    quote:
      'Statutory PCPNDT Form F documentation was handled respectfully and transparently before the obstetric scan. Having our ultrasound reports securely stored in our EDFIC portal made sharing with our doctor effortless.',
    image: sunitaMishraImg,
  },
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PATIENT_TESTIMONIALS[activeIndex];

  const handlePrev = () => {
    setActiveIndex((prev) =>
      prev === 0 ? PATIENT_TESTIMONIALS.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setActiveIndex((prev) =>
      prev === PATIENT_TESTIMONIALS.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <section
      id="testimonials"
      className="bg-white mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20"
    >
      <div className="edfic-reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#287887]">
            PATIENT EXPERIENCES
          </p>
          <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#083642]">
            Trusted by Families Across Lucknow
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm text-[#65747B]">
            Verified feedback from patients and families visiting EDFIC at Sushant Golf City for obstetric imaging, Color Doppler, and diagnostic ultrasound care.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous patient testimonial"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#DCE7E9] bg-white text-[#0D4A5A] transition-colors hover:border-[#0D4A5A] hover:bg-[#E9F3F3] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next patient testimonial"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#DCE7E9] bg-white text-[#0D4A5A] transition-colors hover:border-[#0D4A5A] hover:bg-[#E9F3F3] cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
        {/* Left: All 5 Patient Profiles Selector */}
        <div className="lg:col-span-5 space-y-2.5">
          {PATIENT_TESTIMONIALS.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-[#0D4A5A]/30 bg-[#F4FAFC] edfic-card-soft'
                    : 'border-[#EEF4F6] bg-white hover:border-[#C9E2E8] hover:bg-[#FAFDFE]'
                }`}
              >
                <div
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 transition-colors ${
                    isSelected ? 'border-[#0D4A5A]' : 'border-[#E6F0F2]'
                  }`}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-top"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`font-display text-base font-bold truncate ${
                      isSelected ? 'text-[#083642]' : 'text-[#24343B]'
                    }`}
                  >
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#65747B] truncate">
                    {item.visitContext}
                  </p>
                </div>

                <span
                  className={`font-mono-tabular text-xs font-semibold transition-colors ${
                    isSelected ? 'text-[#0D4A5A]' : 'text-[#9FB2B9]'
                  }`}
                >
                  0{idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Featured Testimonial Spotlight Card */}
        <div className="lg:col-span-7 flex">
          <div
            key={active.id}
            className="edfic-tab-fade flex w-full flex-col justify-between rounded-[1.75rem] border border-[#E6F0F2] bg-gradient-to-br from-[#F7FBFC] via-white to-[#EDF6F9] p-7 sm:p-10 edfic-card-soft"
          >
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 text-[#0D4A5A]" aria-label="Rated 5 out of 5 stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="h-4 w-4 fill-current" aria-hidden="true" />
                  ))}
                </div>
                <Quote className="h-8 w-8 text-[#287887]/25 shrink-0" aria-hidden="true" />
              </div>

              <blockquote className="mt-6 font-display text-xl sm:text-2xl font-semibold leading-relaxed text-[#083642]">
                “{active.quote}”
              </blockquote>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#E6F0F2] pt-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md">
                  <img
                    src={active.image}
                    alt={`${active.name} - EDFIC patient`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-[#083642]">
                    {active.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#65747B]">
                    {active.visitContext} · {active.locality}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5" role="tablist" aria-label="Select patient review">
                {PATIENT_TESTIMONIALS.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeIndex}
                    aria-label={`View review from ${item.name}`}
                    onClick={() => setActiveIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === activeIndex
                        ? 'w-7 bg-[#0D4A5A]'
                        : 'w-2 bg-[#C8DDE3] hover:bg-[#287887]'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

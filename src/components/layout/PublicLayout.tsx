import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  FileText,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from 'lucide-react';
import { usePublicClinic } from '../../hooks/usePublicClinic';
import { useAuth } from '../../context/AuthContext';
import { FloatingContactWidget } from '../public/FloatingContactWidget';
import { ThemeToggle } from '../ui/ThemeToggle';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const { data } = usePublicClinic();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const clinic = data?.clinic;

  const portalHref = user
    ? user.role === 'PATIENT'
      ? '/portal'
      : '/staff'
    : '/login';
  const myReportsHref = user ? '/portal' : '/login?redirect=/portal';

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHeaderElevated(y > 16);
      setShowScrollUp(y >= 350);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const displayPhone = clinic?.primaryPhone || '+91 94578 89090';
  const displayEmail = clinic?.officialEmail || 'care@ewafetalimaging.com';

  const cleanCallHref = `tel:${displayPhone.replace(/[^\d+]/g, '')}`;

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#24343B]">
      {/* Top Clinical Contact & Centre Timing Bar */}
      <div className="bg-[#083642] text-white border-b border-[#0D4A5A]">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          {/* Left: Call/WhatsApp & Official Email (text only, no icons) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={cleanCallHref}
              className="text-white/95 transition-colors hover:text-[#9BE3F0] whitespace-nowrap"
            >
              <span className="font-mono-tabular font-medium">
                Call/WhatsApp: {displayPhone}
              </span>
            </a>

            <span className="hidden sm:inline text-white/30" aria-hidden="true">
              |
            </span>

            <a
              href={`mailto:${displayEmail}`}
              className="text-white/95 transition-colors hover:text-[#9BE3F0] whitespace-nowrap"
            >
              <span>{displayEmail}</span>
            </a>
          </div>

          {/* Right: Centre Operating Hours (Monday - Saturday only on top header) */}
          <div className="text-white/90">
            <span className="whitespace-nowrap">
              {(clinic?.weekdayHours || 'Monday - Saturday: 9:00 AM - 8:00 PM')
                .replace(/[–—]/g, '-')
                .replace(/\s*-\s*/g, ' - ')}
            </span>
          </div>
        </div>
      </div>

      {/* Sticky 3-Zone Navigation Header (Always Visible on Scroll) */}
      <header
        className={`sticky top-0 z-40 border-b transition-all duration-200 ease-out ${
          headerElevated
            ? 'border-[#D5E6EA] bg-white/85 backdrop-blur-lg shadow-[0_10px_32px_-12px_rgba(13,74,90,0.18)]'
            : 'border-[#E6F0F2] bg-white/95 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Official EDFIC brand logo */}
          <Link
            to="/"
            className="edfic-logo-plate flex items-center shrink-0 rounded-xl transition-colors dark-teal:bg-[#EEF7F9] dark-teal:px-2.5 dark-teal:py-1 dark-teal:shadow-sm"
            aria-label="EDFIC - EWA Diagnostic and Fetal Imaging Centre"
          >
            <img
              src="/assets/edfic-logo.png"
              alt="EDFIC - EWA Diagnostic and Fetal Imaging Centre"
              className="h-9 sm:h-10 xl:h-11 w-auto object-contain"
            />
          </Link>

          {/* Zone 2: Primary Desktop Header Navigation */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-6 text-sm font-medium text-[#24343B]">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/facilities"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              Facilities
            </NavLink>
            <NavLink
              to="/usg-scans"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              USG Scans
            </NavLink>
            <NavLink
              to="/prenatal-screening"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              Prenatal Screening
            </NavLink>
            <NavLink
              to="/procedures"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              Procedures
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#0D4A5A] ${
                  isActive ? 'text-[#0D4A5A] font-semibold underline underline-offset-8 decoration-2' : ''
                }`
              }
            >
              Contact
            </NavLink>
          </nav>

          {/* Zone 3: Patient Portal (My Reports) & Book Appointment CTAs */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to={myReportsHref}
              className="hidden sm:inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#0D4A5A]/30 bg-[#F4FAFC] px-3.5 xl:px-4 text-xs xl:text-sm font-semibold text-[#083642] transition-colors hover:border-[#0D4A5A] hover:bg-[#E9F3F3] dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#F0F9FA] dark-teal:hover:bg-[#155264] whitespace-nowrap shrink-0"
            >
              <span>My Reports</span>
            </Link>
            <Link
              to="/book"
              className="edfic-btn-slide hidden sm:inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 xl:px-5 text-xs xl:text-sm font-medium text-white shadow-sm whitespace-nowrap shrink-0"
            >
              <span className="relative z-10">Book Appointment</span>
              <span className="edfic-btn-arrows" aria-hidden="true">
                <ArrowRight className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-full border border-[#DCE7E9] text-[#24343B] hover:bg-[#E9F3F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A] dark-teal:focus-visible:ring-[#6FD3E3]"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Drawer */}
        {mobileOpen && (
          <div className="border-t border-[#DCE7E9] bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col space-y-1 text-sm font-medium text-[#24343B]">
              <NavLink
                to="/"
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/facilities"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Facilities
              </NavLink>
              <NavLink
                to="/usg-scans"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                USG Scans
              </NavLink>
              <NavLink
                to="/prenatal-screening"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Prenatal Screening
              </NavLink>
              <NavLink
                to="/procedures"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Procedures
              </NavLink>
              <NavLink
                to="/gallery"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Gallery
              </NavLink>
              <NavLink
                to="/blog"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Blog
              </NavLink>
              <NavLink
                to="/about"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                About
              </NavLink>
              <NavLink
                to="/contact"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors hover:bg-[#E9F3F3] ${
                    isActive ? 'bg-[#E9F3F3] text-[#0D4A5A] font-semibold' : ''
                  }`
                }
              >
                Contact
              </NavLink>

              <div className="my-2 border-t border-[#E6F0F2] pt-3 flex flex-col gap-2">
                <Link
                  to={myReportsHref}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0D4A5A]/30 bg-[#F4FAFC] px-5 text-sm font-semibold text-[#083642] hover:bg-[#E9F3F3] dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#F0F9FA]"
                >
                  <FileText className="h-4 w-4 text-[#287887] dark-teal:text-[#7CE0EF]" aria-hidden="true" />
                  <span>My Reports (Patient Portal)</span>
                </Link>
                <Link
                  to="/book"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#0D4A5A] px-5 text-sm font-medium text-white"
                >
                  Book Appointment
                </Link>
                {user && user.role !== 'PATIENT' && (
                  <Link
                    to={portalHref}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2 text-center text-xs text-[#65747B] hover:bg-[#E9F3F3]"
                  >
                    Staff Console
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main key={pathname} className="flex-1 bg-white edfic-page-enter">
        {children}
      </main>

      {/* Curved Polar-Aqua Clinic Footer with Centered Shield Crest */}
      <footer className="relative mt-24 text-[#24343B]">
        {/* Centered Architectural Brand Icon Crest Sitting on Peak of Wave */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] border-[5px] border-white dark-teal:border-[#092E39] bg-white dark-teal:bg-[#F2FAFC] p-2.5 ring-1 ring-[#CFE6EC] dark-teal:ring-[#2E7A8D] shadow-[0_16px_38px_-10px_rgba(13,74,90,0.32)]">
            <img
              src="/assets/edfic-favicon.png"
              alt="EDFIC Icon"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        {/* Upward Arched Polar-Aqua Transition */}
        <div className="w-full overflow-hidden leading-none">
          <svg
            viewBox="0 0 1440 86"
            className="block h-14 w-full sm:h-20"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,86 L720,8 L1440,86 L1440,86 L0,86 Z"
              className="fill-[#CFE6EC] dark-teal:fill-[#092E39] transition-colors duration-200"
            />
          </svg>
        </div>

        <div className="bg-gradient-to-b from-[#CFE6EC] via-[#DCEEF3] to-[#E6F4F7] dark-teal:from-[#092E39] dark-teal:via-[#072630] dark-teal:to-[#052028] pt-10 pb-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
              {/* Col 1: Brand Logo, Short Bio & 5 Circular Social/Contact CTA Icons */}
              <div className="md:col-span-4 space-y-4">
                <div className="edfic-logo-plate inline-block rounded-2xl transition-colors dark-teal:bg-[#EEF7F9] dark-teal:px-3.5 dark-teal:py-2 dark-teal:shadow-sm">
                  <img
                    src="/assets/edfic-footer-logo.png"
                    alt="EDFIC - EWA Diagnostic and Fetal Imaging Centre, A Unit of EWA DERMA"
                    className="h-16 sm:h-[72px] w-auto object-contain"
                  />
                </div>

                <p className="text-sm leading-relaxed text-[#354B54]">
                  EWA Diagnostic and Fetal Imaging Centre (EDFIC) is a specialized fetal medicine, Color Doppler, and diagnostic ultrasonography wing of{' '}
                  <strong className="font-semibold text-[#083642]">EWA DERMA</strong> in Lucknow delivering appointment-led care under Dr. Varun Agrawal (DNB Radiology) with strict PCPNDT compliance.
                </p>

                {/* 5 Circular Social & Direct Contact CTA Icons */}
                <div className="pt-1">
                  <div className="flex flex-wrap items-center gap-2.5" aria-label="EDFIC social and direct contact channels">
                    <a
                      href="https://www.facebook.com/ewafetalimaging"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="EDFIC on Facebook"
                      title="Facebook"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white/90 text-[#0D4A5A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A]"
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white/90 text-[#0D4A5A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A]"
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white/90 text-[#0D4A5A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A]"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                        <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C1.9 8.9 1.9 12 1.9 12s0 3.1.5 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8ZM10 15.1V8.9l5.3 3.1-5.3 3.1Z" />
                      </svg>
                    </a>

                    <a
                      href={`https://wa.me/${(() => {
                        const digits = (clinic?.whatsappNumber || displayPhone).replace(/\D/g, '');
                        return digits.length === 10 ? `91${digits}` : digits;
                      })()}?text=${encodeURIComponent(
                        'Hello EDFIC Reception, I would like to inquire about an ultrasound or fetal imaging appointment.'
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Message EDFIC on WhatsApp"
                      title="WhatsApp"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white/90 text-[#0D4A5A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A]"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                        <path d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.3 4.7 4.8-1.3A9.9 9.9 0 1 0 12 2Zm0 18a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.1 8.1 0 1 1 12 20Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.5 4a15 15 0 0 0 1.5.6 3.6 3.6 0 0 0 1.7.1 2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
                      </svg>
                    </a>

                    <a
                      href={cleanCallHref}
                      aria-label={`Call EDFIC at ${displayPhone}`}
                      title={`Call ${displayPhone}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0D4A5A]/25 bg-white/90 text-[#0D4A5A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0D4A5A] hover:bg-[#0D4A5A] hover:text-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#7CE0EF] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A]"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Col 2: Departments */}
              <div className="md:col-span-2">
                <h3 className="font-display text-sm font-bold text-[#083642]">
                  Departments
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#354B54]">
                  <li>
                    <Link to="/about" className="transition-colors hover:text-[#0D4A5A]">
                      About EDFIC
                    </Link>
                  </li>
                  <li>
                    <Link to="/usg-scans" className="transition-colors hover:text-[#0D4A5A]">
                      USG Scans
                    </Link>
                  </li>
                  <li>
                    <Link to="/prenatal-screening" className="transition-colors hover:text-[#0D4A5A]">
                      Prenatal Screening
                    </Link>
                  </li>
                  <li>
                    <Link to="/procedures" className="transition-colors hover:text-[#0D4A5A]">
                      Procedures
                    </Link>
                  </li>
                  <li>
                    <Link to="/doppler-studies" className="transition-colors hover:text-[#0D4A5A]">
                      Doppler Studies
                    </Link>
                  </li>
                  <li>
                    <Link to="/services" className="transition-colors hover:text-[#0D4A5A]">
                      Service Catalogue
                    </Link>
                  </li>
                  <li>
                    <Link to="/doctor" className="transition-colors hover:text-[#0D4A5A]">
                      Dr. Varun Agrawal
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Col 3: Guidance & Compliance */}
              <div className="md:col-span-2">
                <h3 className="font-display text-sm font-bold text-[#083642]">
                  Patient Guidance
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#354B54]">
                  <li>
                    <Link to="/blog" className="transition-colors hover:text-[#0D4A5A]">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link to="/faqs" className="transition-colors hover:text-[#0D4A5A]">
                      FAQs
                    </Link>
                  </li>
                  <li>
                    <Link to="/gallery" className="transition-colors hover:text-[#0D4A5A]">
                      Gallery
                    </Link>
                  </li>
                  <li>
                    <Link to="/patient-info" className="transition-colors hover:text-[#0D4A5A]">
                      Patient Preparation Info
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy-policy" className="transition-colors hover:text-[#0D4A5A]">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/terms-of-use" className="transition-colors hover:text-[#0D4A5A]">
                      Terms and Conditions
                    </Link>
                  </li>
                  <li>
                    <Link to="/disclaimer" className="transition-colors hover:text-[#0D4A5A]">
                      Disclaimer
                    </Link>
                  </li>
                  <li>
                    <Link to="/patient-consent" className="transition-colors hover:text-[#0D4A5A]">
                      PCPNDT Notice
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Col 4: Centre Address, Contact Details, Timings & Quick Actions */}
              <div className="md:col-span-4 space-y-4">
                <h3 className="font-display text-base font-bold text-[#083642]">
                  Visit, Contact &amp; Timings
                </h3>

                <div className="space-y-3 text-sm text-[#354B54]">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#0D4A5A]" aria-hidden="true" />
                    <p className="leading-relaxed">
                      {clinic?.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'} (
                      {clinic?.landmark || 'Near Lulu Mall'}),{' '}
                      {clinic?.cityStateCountry || 'Lucknow, Uttar Pradesh, India'}.
                    </p>
                  </div>

                  <a
                    href={cleanCallHref}
                    className="flex items-center gap-2.5 font-mono-tabular text-xs font-medium transition-colors hover:text-[#0D4A5A]"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-[#0D4A5A]" aria-hidden="true" />
                    <span>{displayPhone}</span>
                  </a>

                  <a
                    href={`mailto:${displayEmail}`}
                    className="flex items-center gap-2.5 text-xs transition-colors hover:text-[#0D4A5A]"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-[#0D4A5A]" aria-hidden="true" />
                    <span>{displayEmail}</span>
                  </a>

                  <div className="border-t border-[#0D4A5A]/15 pt-2.5 text-xs text-[#455A64] space-y-1">
                    <p className="font-semibold text-[#083642]">Operating Hours</p>
                    <p>{clinic?.weekdayHours || 'Monday–Saturday: 9:00 AM – 8:00 PM'}</p>
                    <p>{clinic?.sundayHours || 'Sunday: 10:00 AM – 2:00 PM (By Appointment)'}</p>
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap gap-2.5">
                  <Link
                    to="/book"
                    className="edfic-btn-slide inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-xs font-semibold text-white shadow-sm whitespace-nowrap"
                  >
                    <span className="relative z-10">Book Appointment</span>
                    <span className="edfic-btn-arrows" aria-hidden="true">
                      <ArrowRight className="h-3.5 w-3.5" />
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                  <Link
                    to={myReportsHref}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#0D4A5A]/30 bg-white/85 px-4 text-xs font-semibold text-[#083642] transition-colors hover:bg-white dark-teal:border-[#2E7A8D] dark-teal:bg-[#0E3C4A] dark-teal:text-[#F0F9FA] dark-teal:hover:bg-[#155264] whitespace-nowrap"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#287887] dark-teal:text-[#7CE0EF]" aria-hidden="true" />
                    <span>My Reports</span>
                  </Link>
                </div>
                {user && user.role !== 'PATIENT' && (
                  <div>
                    <Link
                      to={portalHref}
                      className="text-xs font-medium text-[#0D4A5A] underline underline-offset-4 hover:text-[#083642]"
                    >
                      Open Staff Dashboard
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Deep-Teal Bottom Footer Bar */}
        <div className="bg-[#0D4A5A] dark-teal:bg-[#04181F] dark-teal:border-t dark-teal:border-[#1B5564] text-white">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
            <p className="text-white/90">
              © {new Date().getFullYear()} EDFIC - EWA Diagnostic and Fetal Imaging Centre (A Unit of EWA DERMA).
            </p>
            <p className="text-white/85">
              <a
                href="https://www.pracharprasar.co"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 transition-colors hover:text-white"
              >
                Developed by Prachar Prasar
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Bottom-Left Floating Utility Stack: Circular Theme Toggle above Scroll-to-Top */}
      <div className="fixed bottom-6 left-5 sm:left-8 z-40 flex flex-col items-center gap-3">
        <ThemeToggle variant="circle" />

        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll back to top"
          aria-hidden={!showScrollUp}
          tabIndex={showScrollUp ? 0 : -1}
          className={`flex items-center justify-center rounded-full border border-[#DCE7E9] bg-white text-[#287887] shadow-lg transition-all duration-300 hover:bg-[#083642] hover:text-white hover:border-[#083642] dark-teal:border-[#2E7A8D] dark-teal:bg-[#092D38] dark-teal:text-[#6FD3E3] dark-teal:hover:bg-[#136174] dark-teal:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A] dark-teal:focus-visible:ring-[#6FD3E3] focus-visible:ring-offset-2 cursor-pointer ${
            showScrollUp
              ? 'h-11 w-11 opacity-100 scale-100'
              : 'h-0 w-11 -mt-3 opacity-0 scale-75 overflow-hidden border-0 pointer-events-none'
          }`}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom-Right Contact CTAs Showcase: WhatsApp · Call · Automated Reception Chat */}
      <FloatingContactWidget clinic={clinic} />
    </div>
  );
}

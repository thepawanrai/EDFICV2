import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { useAuth, UserRole } from '../../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  phone: z.string().min(10, '10-digit mobile number required.').max(15),
  email: z.string().email('Valid email address required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/staff/admin';
    case 'RECEPTION':
      return '/staff/reception';
    default:
      return '/portal';
  }
}

type ShowcaseKey = 'reports' | 'appointments' | 'privacy';

interface ShowcaseModule {
  key: ShowcaseKey;
  label: string;
  icon: typeof FileText;
  headline: string;
  summary: string;
  steps: { title: string; detail: string }[];
  actionLabel: string;
  actionTo: string;
}

const PORTAL_SHOWCASE: ShowcaseModule[] = [
  {
    key: 'reports',
    label: 'Digital Reports',
    icon: FileText,
    headline: 'Signed Diagnostic PDFs in One Private Vault',
    summary:
      'Once reviewed and finalized by Dr. Varun Agrawal, your ultrasound and Color Doppler reports become immediately downloadable inside your authenticated portal.',
    steps: [
      {
        title: 'Authenticated Access Only',
        detail: 'Reports are protected behind your patient login and never exposed via public URLs.',
      },
      {
        title: 'Complete Visit Timeline',
        detail: 'View past trimester scans, Doppler evaluations, and finalized findings in chronological order.',
      },
      {
        title: 'Doctor-Ready PDF Format',
        detail: 'Download structured clinical reports cleanly formatted for your referring specialist.',
      },
    ],
    actionLabel: 'Browse Scan Services',
    actionTo: '/services',
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: CalendarCheck2,
    headline: 'Track Live Slots & Preparation Guidance',
    summary:
      'Review confirmed slot timings, UPI advance verification status, and scan-specific fasting or hydration reminders prior to arriving at Sushant Golf City.',
    steps: [
      {
        title: 'Live Booking Reference',
        detail: 'Every scheduled visit generates a unique EDFIC reference with real-time slot status.',
      },
      {
        title: 'UPI UTR Reconciliation',
        detail: 'Monitor when reception verifies your UPI advance reference and locks your arrival time.',
      },
      {
        title: 'Pre-Visit Checklist',
        detail: 'Check whether your scan needs fasting, full bladder hydration, or prior trimester records.',
      },
    ],
    actionLabel: 'Book Appointment Slot',
    actionTo: '/book',
  },
  {
    key: 'privacy',
    label: 'Statutory Privacy',
    icon: ShieldCheck,
    headline: 'Strict PCPNDT & Medical Data Confidentiality',
    summary:
      'Every clinical record and Form F obstetric declaration is handled under strict statutory compliance, role-gated access control, and logged download protection.',
    steps: [
      {
        title: 'PCPNDT Act Compliance',
        detail: 'Mandatory photo ID verification and Form F completion apply to all obstetric scans.',
      },
      {
        title: 'Zero Unsecured Forwards',
        detail: 'Diagnostic reports are never dispatched as unencrypted files over public messaging links.',
      },
      {
        title: 'Audit-Logged Downloads',
        detail: 'Account-scoped session cookies keep your personal health records isolated and secure.',
      },
    ],
    actionLabel: 'Read Consent & PCPNDT Notice',
    actionTo: '/patient-consent',
  },
];

function evaluatePasswordStrength(password: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  barClass: string;
} {
  if (!password) {
    return { level: 0, label: 'Use at least 8 characters', barClass: 'bg-[#DCE7E9]' };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 11) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { level: 1, label: 'Weak — add numbers or uppercase letters', barClass: 'bg-[#B42318]' };
  }
  if (score === 2) {
    return { level: 2, label: 'Fair — mix letters, numbers & symbols', barClass: 'bg-amber-500' };
  }
  if (score === 3) {
    return { level: 3, label: 'Good — strong enough for portal access', barClass: 'bg-[#287887]' };
  }
  return { level: 4, label: 'Strong password', barClass: 'bg-[#15803D]' };
}

export function LoginPage() {
  const { login, registerPatient } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const isFromMyReports = requestedRedirect === '/portal';

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseKey>('reports');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  const watchedRegPassword = registerForm.watch('password') || '';
  const passwordStrength = evaluatePasswordStrength(watchedRegPassword);

  const activeModule =
    PORTAL_SHOWCASE.find((item) => item.key === activeShowcase) ?? PORTAL_SHOWCASE[0];

  const onLogin = async (values: z.infer<typeof loginSchema>) => {
    setAuthError(null);
    try {
      const user = await login(values.email, values.password);
      if (isFromMyReports) {
        navigate('/portal');
      } else {
        navigate(getDefaultRouteForRole(user.role));
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  const onRegister = async (values: z.infer<typeof registerSchema>) => {
    setAuthError(null);
    try {
      const user = await registerPatient(values);
      navigate(isFromMyReports ? '/portal' : getDefaultRouteForRole(user.role));
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <PublicLayout>
      <SeoHead
        title="Sign In & Patient Portal | EDFIC Lucknow"
        description="Sign in or create an EDFIC Patient Portal account to access diagnostic ultrasound PDFs, appointment status, and preparation guidelines."
        canonicalPath="/login"
      />

      <MotionConfig reducedMotion="user">
        <section className="relative overflow-hidden py-10 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
              {/* Left Column: Interactive Portal Preview Dashboard */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden rounded-[1.75rem] edfic-hero-home5-bg p-7 sm:p-9 lg:col-span-6 lg:p-10 text-white flex flex-col justify-between edfic-card-elevated"
              >
                {/* Ambient Smooth Floating Glows (compositor-only transform + opacity) */}
                <motion.div
                  aria-hidden="true"
                  animate={{ y: [0, -12, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#7CE0EF]/15 blur-3xl"
                />
                <motion.div
                  aria-hidden="true"
                  animate={{ y: [0, 10, 0], scale: [1, 1.04, 1] }}
                  transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-[#287887]/25 blur-3xl"
                />

                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9BE3F0]">
                    EDFIC Secure Access · A Unit of EWA DERMA
                  </p>
                  <h1 className="mt-2.5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                    {isFromMyReports
                      ? 'My Reports & Patient Portal'
                      : 'Interactive Patient & Clinic Portal'}
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#DDEFF3] max-w-xl">
                    Access your private diagnostic PDF vault, track upcoming ultrasound slot confirmations, and prepare calmly before visiting our Sushant Golf City centre.
                  </p>

                  {/* Interactive Portal Feature Switcher with Sliding Spring Pill */}
                  <div
                    role="tablist"
                    aria-label="Explore portal capabilities"
                    className="mt-7 grid grid-cols-3 gap-1.5 rounded-xl border border-white/15 bg-[#05242D]/55 p-1.5 backdrop-blur-md"
                  >
                    {PORTAL_SHOWCASE.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.key === activeShowcase;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveShowcase(item.key)}
                          className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            isActive ? 'text-[#083642]' : 'text-[#CBE7EE] hover:text-white'
                          }`}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="portalShowcasePill"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-lg bg-white shadow-sm"
                            />
                          )}
                          <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="relative z-10 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Animated Feature Preview Content */}
                  <div className="mt-6 min-h-[250px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeModule.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-2xl border border-white/15 bg-[#072C36]/75 p-5 sm:p-6 backdrop-blur-md"
                      >
                        <h2 className="font-display text-lg font-bold text-white">
                          {activeModule.headline}
                        </h2>
                        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#CBE7EE]">
                          {activeModule.summary}
                        </p>

                        <div className="mt-4 space-y-3 border-t border-white/15 pt-4">
                          {activeModule.steps.map((step, idx) => (
                            <motion.div
                              key={step.title}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.06, duration: 0.22 }}
                              className="flex items-start gap-2.5"
                            >
                              <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-[#8EE0EC]"
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white">
                                  {step.title}
                                </p>
                                <p className="text-xs leading-relaxed text-[#B8DCE4]">
                                  {step.detail}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        <div className="mt-4 pt-1">
                          <Link
                            to={activeModule.actionTo}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8EE0EC] hover:text-white transition-colors"
                          >
                            <span>{activeModule.actionLabel}</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Quiet Unboxed Footer Metadata */}
                <div className="relative z-10 mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-white/15 pt-4 text-xs text-[#B8DCE4]">
                  <span>Unit 10, Millennium Place</span>
                  <span aria-hidden="true">·</span>
                  <span>Sushant Golf City, Lucknow</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">Mon–Sat 9:00 AM – 8:00 PM</span>
                </div>
              </motion.div>

              {/* Right Column: Animated Sign-In / New Account Interactive Card */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-6 flex"
              >
                <div className="w-full rounded-[1.75rem] border border-[#DCE7E9] dark-teal:border-[#1B5564] bg-white dark-teal:bg-[#092D38] p-6 sm:p-9 lg:p-10 flex flex-col justify-between edfic-card-soft">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#287887] dark-teal:text-[#7CE0EF]">
                          {tab === 'login' ? 'Welcome Back' : 'Patient Onboarding'}
                        </p>
                        <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#083642] dark-teal:text-[#F0F9FA]">
                          {tab === 'login'
                            ? 'Sign In to Your Account'
                            : 'Create Patient Account'}
                        </h2>
                      </div>
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E9F3F3] dark-teal:bg-[#0E3C4A] text-[#0D4A5A] dark-teal:text-[#7CE0EF]"
                      >
                        <Lock className="h-5 w-5" />
                      </span>
                    </div>

                    {isFromMyReports && (
                      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#65747B] dark-teal:text-[#B8DDE3]">
                        Sign in with your registered patient credentials to download diagnostic PDF reports and review your visit history. Need a scan?{' '}
                        <Link
                          to="/book"
                          className="font-semibold text-[#0D4A5A] dark-teal:text-[#7CE0EF] underline underline-offset-4 hover:text-[#083642] dark-teal:hover:text-white"
                        >
                          Book Appointment
                        </Link>
                      </p>
                    )}

                    {/* Smooth Spring-Animated Segmented Tab Switcher */}
                    <div
                      role="tablist"
                      aria-label="Choose sign in or create patient account"
                      className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-[#EEF5F7] dark-teal:bg-[#052028] border border-[#DCE7E9] dark-teal:border-[#1B5564] p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'login'}
                        onClick={() => {
                          setTab('login');
                          setAuthError(null);
                        }}
                        className={`relative rounded-lg py-2.5 text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                          tab === 'login'
                            ? 'text-[#083642] dark-teal:text-[#F0F9FA]'
                            : 'text-[#4F646D] hover:text-[#083642] dark-teal:text-[#9AC4CC] dark-teal:hover:text-white'
                        }`}
                      >
                        {tab === 'login' && (
                          <motion.span
                            layoutId="authTabIndicator"
                            transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                            className="absolute inset-0 rounded-lg bg-white dark-teal:bg-[#136174] shadow-sm"
                          />
                        )}
                        <span className="relative z-10">Sign In</span>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'register'}
                        onClick={() => {
                          setTab('register');
                          setAuthError(null);
                        }}
                        className={`relative rounded-lg py-2.5 text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                          tab === 'register'
                            ? 'text-[#083642] dark-teal:text-[#F0F9FA]'
                            : 'text-[#4F646D] hover:text-[#083642] dark-teal:text-[#9AC4CC] dark-teal:hover:text-white'
                        }`}
                      >
                        {tab === 'register' && (
                          <motion.span
                            layoutId="authTabIndicator"
                            transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                            className="absolute inset-0 rounded-lg bg-white dark-teal:bg-[#136174] shadow-sm"
                          />
                        )}
                        <span className="relative z-10">New Patient Account</span>
                      </button>
                    </div>

                    {/* Animated Auth Error Banner */}
                    <AnimatePresence mode="wait">
                      {authError && (
                        <motion.div
                          key={authError}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          role="alert"
                          className="mt-5 rounded-xl border border-[#B42318]/40 bg-[#FEF3F2] px-4 py-3 text-xs font-medium text-[#B42318]"
                        >
                          {authError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Animated Form Panel Transition */}
                    <div className="mt-6">
                      <AnimatePresence mode="wait">
                        {tab === 'login' ? (
                          <motion.form
                            key="login-form"
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            onSubmit={loginForm.handleSubmit(onLogin)}
                            className="space-y-4"
                          >
                            <div>
                              <Label htmlFor="loginEmail">Email Address</Label>
                              <Input
                                id="loginEmail"
                                type="email"
                                autoComplete="email"
                                {...loginForm.register('email')}
                                placeholder="name@example.com"
                                className="h-11 rounded-xl dark-teal:bg-[#052028] dark-teal:border-[#297486] dark-teal:text-[#F0F9FA]"
                              />
                              {loginForm.formState.errors.email && (
                                <p className="mt-1.5 text-xs text-[#B42318]">
                                  {loginForm.formState.errors.email.message}
                                </p>
                              )}
                            </div>

                            <div>
                              <Label htmlFor="loginPassword">Password</Label>
                              <div className="relative">
                                <Input
                                  id="loginPassword"
                                  type={showLoginPassword ? 'text' : 'password'}
                                  autoComplete="current-password"
                                  {...loginForm.register('password')}
                                  placeholder="Enter your password"
                                  className="h-11 rounded-xl pr-11 dark-teal:bg-[#052028] dark-teal:border-[#297486] dark-teal:text-[#F0F9FA]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowLoginPassword((prev) => !prev)}
                                  aria-label={
                                    showLoginPassword ? 'Hide password' : 'Show password'
                                  }
                                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#65747B] hover:text-[#083642] dark-teal:text-[#9AC4CC] dark-teal:hover:text-white cursor-pointer transition-colors"
                                >
                                  {showLoginPassword ? (
                                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                              </div>
                              {loginForm.formState.errors.password && (
                                <p className="mt-1.5 text-xs text-[#B42318]">
                                  {loginForm.formState.errors.password.message}
                                </p>
                              )}
                            </div>

                            <div className="pt-2">
                              <Button
                                type="submit"
                                disabled={loginForm.formState.isSubmitting}
                                className="group h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition-transform duration-150 active:scale-[0.99]"
                              >
                                {loginForm.formState.isSubmitting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    <span>Signing In...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Sign In to Portal</span>
                                    <ArrowRight
                                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                                      aria-hidden="true"
                                    />
                                  </>
                                )}
                              </Button>
                            </div>
                          </motion.form>
                        ) : (
                          <motion.form
                            key="register-form"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            onSubmit={registerForm.handleSubmit(onRegister)}
                            className="space-y-4"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <Label htmlFor="regName">Patient Full Name</Label>
                                <Input
                                  id="regName"
                                  autoComplete="name"
                                  placeholder="e.g. Ananya Sharma"
                                  {...registerForm.register('fullName')}
                                  className="h-11 rounded-xl dark-teal:bg-[#052028] dark-teal:border-[#297486] dark-teal:text-[#F0F9FA]"
                                />
                                {registerForm.formState.errors.fullName && (
                                  <p className="mt-1.5 text-xs text-[#B42318]">
                                    {registerForm.formState.errors.fullName.message}
                                  </p>
                                )}
                              </div>

                              <div>
                                <Label htmlFor="regPhone">Mobile Number</Label>
                                <Input
                                  id="regPhone"
                                  type="tel"
                                  autoComplete="tel"
                                  placeholder="10-digit mobile"
                                  {...registerForm.register('phone')}
                                  className="h-11 rounded-xl font-mono-tabular dark-teal:bg-[#052028] dark-teal:border-[#297486] dark-teal:text-[#F0F9FA]"
                                />
                                {registerForm.formState.errors.phone && (
                                  <p className="mt-1.5 text-xs text-[#B42318]">
                                    {registerForm.formState.errors.phone.message}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="regEmail">Email Address</Label>
                              <Input
                                id="regEmail"
                                type="email"
                                autoComplete="email"
                                placeholder="name@example.com"
                                {...registerForm.register('email')}
                                className="h-11 rounded-xl dark-teal:bg-[#052028] dark-teal:border-[#297486] dark-teal:text-[#F0F9FA]"
                              />
                              {registerForm.formState.errors.email && (
                                <p className="mt-1.5 text-xs text-[#B42318]">
                                  {registerForm.formState.errors.email.message}
                                </p>
                              )}
                            </div>

                            <div>
                              <Label htmlFor="regPassword">Create Password (min 8 chars)</Label>
                              <div className="relative">
                                <Input
                                  id="regPassword"
                                  type={showRegisterPassword ? 'text' : 'password'}
                                  autoComplete="new-password"
                                  placeholder="Create a secure password"
                                  {...registerForm.register('password')}
                                  className="h-11 rounded-xl pr-11 dark-teal:bg-[#052028] dark-teal:border-[#297486] dark-teal:text-[#F0F9FA]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                                  aria-label={
                                    showRegisterPassword ? 'Hide password' : 'Show password'
                                  }
                                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#65747B] hover:text-[#083642] dark-teal:text-[#9AC4CC] dark-teal:hover:text-white cursor-pointer transition-colors"
                                >
                                  {showRegisterPassword ? (
                                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                              </div>

                              {/* Live Password Strength Indicator (scaleX compositor animation + text label) */}
                              <div className="mt-2.5 space-y-1.5">
                                <div className="grid grid-cols-4 gap-1.5">
                                  {[1, 2, 3, 4].map((segment) => {
                                    const filled = passwordStrength.level >= segment;
                                    return (
                                      <div
                                        key={segment}
                                        className="h-1.5 overflow-hidden rounded-full bg-[#DCE7E9] dark-teal:bg-[#1B5564]"
                                      >
                                        <motion.div
                                          initial={false}
                                          animate={{
                                            scaleX: filled ? 1 : 0,
                                            opacity: filled ? 1 : 0,
                                          }}
                                          transition={{ duration: 0.2, ease: 'easeOut' }}
                                          style={{ transformOrigin: '0% 50%' }}
                                          className={`h-full w-full rounded-full ${passwordStrength.barClass}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[11px] font-medium text-[#65747B] dark-teal:text-[#9AC4CC]">
                                  {passwordStrength.label}
                                </p>
                              </div>

                              {registerForm.formState.errors.password && (
                                <p className="mt-1.5 text-xs text-[#B42318]">
                                  {registerForm.formState.errors.password.message}
                                </p>
                              )}
                            </div>

                            <div className="pt-2">
                              <Button
                                type="submit"
                                disabled={registerForm.formState.isSubmitting}
                                className="group h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition-transform duration-150 active:scale-[0.99]"
                              >
                                {registerForm.formState.isSubmitting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    <span>Creating Account...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Create Patient Portal Account</span>
                                    <ArrowRight
                                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                                      aria-hidden="true"
                                    />
                                  </>
                                )}
                              </Button>
                            </div>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Clean Footer Helper Bar */}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9F3F3] dark-teal:border-[#1B5564] pt-5 text-xs text-[#65747B] dark-teal:text-[#9AC4CC]">
                    <span>Need to schedule an ultrasound first?</span>
                    <div className="flex items-center gap-4">
                      <Link
                        to="/patient-info"
                        className="font-medium text-[#287887] dark-teal:text-[#7CE0EF] hover:underline"
                      >
                        Preparation Guide
                      </Link>
                      <Link
                        to="/book"
                        className="inline-flex items-center gap-1 font-semibold text-[#0D4A5A] dark-teal:text-[#F0F9FA] hover:underline"
                      >
                        <span>Book Appointment</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </MotionConfig>
    </PublicLayout>
  );
}

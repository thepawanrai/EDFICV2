import React, { useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { SitePreloader } from './components/ui/SitePreloader';

import { HomePage } from './pages/public/HomePage';
import { AboutPage } from './pages/public/AboutPage';
import { FetalImagingPage } from './pages/public/FetalImagingPage';
import { GeneralUltrasoundPage } from './pages/public/GeneralUltrasoundPage';
import { DopplerStudiesPage } from './pages/public/DopplerStudiesPage';
import { ServicesPage } from './pages/public/ServicesPage';
import { ServiceDetailPage } from './pages/public/ServiceDetailPage';
import { TechnologyPage } from './pages/public/TechnologyPage';
import { DoctorPage } from './pages/public/DoctorPage';
import { PatientInfoPage } from './pages/public/PatientInfoPage';
import { AppointmentInfoPage } from './pages/public/AppointmentInfoPage';
import { BookAppointmentPage } from './pages/public/BookAppointmentPage';
import { FaqsPage } from './pages/public/FaqsPage';
import { FacilitiesPage } from './pages/public/FacilitiesPage';
import { UsgScansPage } from './pages/public/UsgScansPage';
import { PrenatalScreeningPage } from './pages/public/PrenatalScreeningPage';
import { ProceduresPage } from './pages/public/ProceduresPage';
import { GalleryPage } from './pages/public/GalleryPage';
import { BlogPage } from './pages/public/BlogPage';
import { ContactPage } from './pages/public/ContactPage';
import { LegalPolicyPage } from './pages/public/LegalPolicyPage';

import { LoginPage } from './pages/portal/LoginPage';
import { PatientPortalPage } from './pages/portal/PatientPortalPage';

import { ReceptionDashboardPage } from './pages/staff/ReceptionDashboardPage';
import { PaymentsVerificationPage } from './pages/staff/PaymentsVerificationPage';
import { CrmDashboardPage } from './pages/staff/CrmDashboardPage';
import { PatientsDirectoryPage } from './pages/staff/PatientsDirectoryPage';
import { AdminConsolePage } from './pages/staff/AdminConsolePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFA] text-sm text-[#65747B]">
        Verifying EDFIC session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'PATIENT' ? '/portal' : '/staff'} replace />;
  }
  return <>{children}</>;
}

function StaffEntryRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'SUPER_ADMIN':
      return <Navigate to="/staff/admin" replace />;
    case 'RECEPTION':
      return <Navigate to="/staff/reception" replace />;
    default:
      return <Navigate to="/portal" replace />;
  }
}

function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const prevPathnameRef = useRef<string>(pathname);

  useEffect(() => {
    const pathnameChanged = prevPathnameRef.current !== pathname;
    prevPathnameRef.current = pathname;

    if (hash) {
      const targetId = hash.slice(1);
      const scrollToTarget = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };
      if (!scrollToTarget()) {
        window.requestAnimationFrame(() => {
          if (!scrollToTarget()) {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }
        });
      }
      return;
    }

    if (pathnameChanged || navigationType === 'PUSH') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [pathname, hash, key, navigationType]);

  return null;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="edfic-route-fade">
      <Routes location={location}>
            {/* Public Healthcare Website */}
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/fetal-imaging" element={<FetalImagingPage />} />
            <Route path="/general-ultrasound" element={<GeneralUltrasoundPage />} />
            <Route path="/doppler-studies" element={<DopplerStudiesPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/:slug" element={<ServiceDetailPage />} />
            <Route path="/technology" element={<TechnologyPage />} />
            <Route path="/doctor" element={<DoctorPage />} />
            <Route path="/patient-info" element={<PatientInfoPage />} />
            <Route path="/appointment-info" element={<AppointmentInfoPage />} />
            <Route path="/book" element={<BookAppointmentPage />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/usg-scans" element={<UsgScansPage />} />
            <Route path="/prenatal-screening" element={<PrenatalScreeningPage />} />
            <Route path="/procedures" element={<ProceduresPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/privacy-policy"
              element={
                <LegalPolicyPage
                  pageKey="privacy-policy"
                  fallbackTitle="EDFIC Privacy Policy"
                />
              }
            />
            <Route
              path="/terms-of-use"
              element={
                <LegalPolicyPage
                  pageKey="terms-of-use"
                  fallbackTitle="Terms and Conditions"
                />
              }
            />
            <Route
              path="/terms-and-conditions"
              element={
                <LegalPolicyPage
                  pageKey="terms-of-use"
                  fallbackTitle="Terms and Conditions"
                />
              }
            />
            <Route
              path="/disclaimer"
              element={
                <LegalPolicyPage
                  pageKey="disclaimer"
                  fallbackTitle="Medical & Diagnostic Disclaimer"
                  fallbackContent={`1. Educational Information Only: All clinical descriptions, scan preparation guides, and blog articles published on the EDFIC website are intended strictly for general patient awareness and educational reference. They do not constitute medical advice, diagnosis, or a substitute for an in-person consultation with a qualified physician or radiologist.\n\n2. Diagnostic Interpretation & Clinical Correlation: Ultrasound, Doppler, and image-guided findings must always be interpreted by your referring obstetrician, physician, or specialist in conjunction with your complete clinical history, physical examination, and laboratory investigations.\n\n3. Diagnostic Limitations: While EDFIC utilizes high-resolution imaging systems and follows standardized clinical protocols, medical ultrasound has recognized technical and biological limitations (such as fetal position, maternal habitus, gestational age, and acoustic windows), and no imaging modality can guarantee the detection of every congenital or medical condition.\n\n4. Emergency Care Notice: This website and patient portal are not monitored for acute medical emergencies. In the event of an urgent or life-threatening medical situation, please contact emergency medical services or visit the nearest hospital emergency department immediately.`}
                />
              }
            />
            <Route
              path="/patient-consent"
              element={
                <LegalPolicyPage
                  pageKey="patient-consent"
                  fallbackTitle="Patient Consent & PCPNDT Compliance Information"
                />
              }
            />

            {/* Auth & Patient Portal */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/my-reports" element={<Navigate to="/portal" replace />} />
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={['PATIENT', 'SUPER_ADMIN', 'RECEPTION']}>
                  <PatientPortalPage />
                </ProtectedRoute>
              }
            />

            {/* Staff Operational Dashboards */}
            <Route path="/staff" element={<StaffEntryRedirect />} />
            <Route
              path="/staff/reception"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RECEPTION']}>
                  <ReceptionDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/payments"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RECEPTION']}>
                  <PaymentsVerificationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/crm"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RECEPTION']}>
                  <CrmDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/patients"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RECEPTION']}>
                  <PatientsDirectoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/admin"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminConsolePage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SitePreloader />
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              {mapsQuotaExceeded && (
                <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
                  <span>
                    Google Maps Platform quota reached. If you are the app owner, visit{' '}
                    <a
                      href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold text-amber-950 hover:text-amber-800"
                    >
                      maps developer site
                    </a>{' '}
                    for instructions to update your account.
                  </span>
                </div>
              )}
              <BrowserRouter>
                <ScrollToTop />
                <AppRoutes />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

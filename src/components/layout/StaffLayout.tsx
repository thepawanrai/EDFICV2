import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  CalendarDays,
  CreditCard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useAuth, UserRole } from '../../context/AuthContext';
import { humanizeStatus } from '../../lib/utils';
import { ThemeToggle } from '../ui/ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const STAFF_NAV: NavItem[] = [
  {
    to: '/staff/reception',
    label: 'Reception & Calendar',
    icon: CalendarDays,
    roles: ['SUPER_ADMIN', 'RECEPTION'],
  },
  {
    to: '/staff/payments',
    label: 'UPI Verification',
    icon: CreditCard,
    roles: ['SUPER_ADMIN', 'RECEPTION'],
  },
  {
    to: '/staff/crm',
    label: 'CRM & Inquiries',
    icon: Activity,
    roles: ['SUPER_ADMIN', 'RECEPTION'],
  },
  {
    to: '/staff/patients',
    label: 'Patient Records',
    icon: Users,
    roles: ['SUPER_ADMIN', 'RECEPTION'],
  },
  {
    to: '/staff/admin',
    label: 'Admin & Automation',
    icon: Settings,
    roles: ['SUPER_ADMIN'],
  },
];

export function StaffLayout({
  title,
  breadcrumb,
  children,
}: {
  title: string;
  breadcrumb: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = STAFF_NAV.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFA] text-[#24343B]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-[#DCE7E9] bg-white">
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#DCE7E9]">
          <Link
            to="/"
            className="edfic-logo-plate flex items-center shrink-0 rounded-lg transition-colors dark-teal:bg-[#EEF7F9] dark-teal:px-2 dark-teal:py-1"
            aria-label="EDFIC Operations"
          >
            <img
              src="/assets/edfic-logo.png"
              alt="EDFIC - EWA Diagnostic and Fetal Imaging Centre"
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#E9F3F3] text-[#0D4A5A]'
                      : 'text-[#65747B] hover:bg-[#F8FAFA] hover:text-[#24343B]'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-[#DCE7E9] p-4 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-[#24343B] truncate">{user?.fullName}</p>
            <p className="text-[#65747B]">{user ? humanizeStatus(user.role) : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex-1 rounded-md border border-[#DCE7E9] px-3 py-1.5 text-center text-xs font-medium text-[#24343B] hover:bg-[#F8FAFA] whitespace-nowrap"
            >
              Public Site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE7E9] px-3 py-1.5 text-xs font-medium text-[#24343B] hover:bg-[#F8FAFA] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-white flex flex-col border-r border-[#DCE7E9]">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#DCE7E9]">
              <div className="edfic-logo-plate rounded-lg transition-colors dark-teal:bg-[#EEF7F9] dark-teal:px-2 dark-teal:py-1">
                <img
                  src="/assets/edfic-logo.png"
                  alt="EDFIC - EWA Diagnostic and Fetal Imaging Centre"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md text-[#65747B]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-[#E9F3F3] text-[#0D4A5A]'
                          : 'text-[#65747B] hover:bg-[#F8FAFA]'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-[#DCE7E9] p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-md border border-[#DCE7E9] px-3 py-2 text-xs font-medium text-[#24343B]"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-[#DCE7E9] bg-white px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#DCE7E9]"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-[#65747B] truncate">{breadcrumb}</p>
              <h1 className="font-display text-base sm:text-lg font-semibold text-[#24343B] truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-[#65747B]">
              {user?.fullName} · {user ? humanizeStatus(user.role) : ''}
            </span>
            <ThemeToggle variant="compact" />
          </div>
        </header>

        <main
          key={pathname}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto edfic-page-enter"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

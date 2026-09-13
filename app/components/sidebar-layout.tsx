'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Calendar,
  CalendarOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../contexts/SettingsContext';
import LanguageSwitcher from './LanguageSwitcher';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  staffPermission?: string;
  hidden?: boolean;
}

export default function SidebarLayout({
  children,
  title,
  description,
  fullWidth,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  fullWidth?: boolean;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { t } = useTranslations();
  const { settings } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = session?.user?.role || '';

  // Public settings are cached for minutes, so ask the server directly; the
  // link then appears as soon as the admin enables barber breaks.
  const [barberBreaksEnabled, setBarberBreaksEnabled] = useState(false);
  useEffect(() => {
    if (role !== 'barber') return;
    let cancelled = false;
    fetch('/api/barbers/me/breaks', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setBarberBreaksEnabled(Boolean(data?.enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  const navigation: NavItem[] = [
    {
      name: t('navigation.dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin'],
    },
    {
      name: t('navigation.appointments'),
      href: '/appointments',
      icon: Calendar,
      roles: ['admin'],
    },
    {
      name: t('navigation.barbers'),
      href: '/barbers',
      icon: Users,
      roles: ['admin'],
    },
    {
      name: t('navigation.settings'),
      href: '/settings',
      icon: Settings,
      roles: ['admin'],
    },
    {
      name: t('navigation.myAppointments'),
      href: '/my-appointments',
      icon: Scissors,
      roles: ['barber'],
    },
    {
      name: t('navigation.myBreaks'),
      href: '/my-breaks',
      icon: CalendarOff,
      roles: ['barber'],
      hidden: !barberBreaksEnabled,
    },
  ];

  const filteredNav = navigation.filter(
    (item) => item.roles.includes(role) && !item.hidden
  );

  const NavLinks = () => (
    <>
      {filteredNav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-zinc-300 hover:bg-zinc-800 hover:text-amber-300'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-amber-500/20 bg-zinc-950 px-4 py-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-amber-400 hover:bg-zinc-800"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-semibold text-amber-400">{settings.systemTitle}</span>
        <LanguageSwitcher compact />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute start-0 top-0 h-full w-72 bg-zinc-900 border-e border-amber-500/20 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-bold text-amber-400">{settings.systemTitle}</p>
                <p className="text-xs text-zinc-400">{session?.user?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:text-amber-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 flex-1">
              <NavLinks />
            </nav>
            <button
              type="button"
              onClick={() =>
                signOut({ callbackUrl: `${window.location.origin}/login` })
              }
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-zinc-800 mt-4"
            >
              <LogOut className="h-5 w-5" />
              {t('common.signOut')}
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-e border-amber-500/20 bg-zinc-900 p-4">
          <div className="mb-8">
            <h1 className="text-lg font-bold text-amber-400">{settings.systemTitle}</h1>
            <p className="text-xs text-zinc-400 mt-1">{session?.user?.name}</p>
            <p className="text-xs text-zinc-500 capitalize">{role}</p>
          </div>
          <nav className="flex flex-col gap-1 flex-1">
            <NavLinks />
          </nav>
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() =>
                signOut({ callbackUrl: `${window.location.origin}/login` })
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-zinc-800"
            >
              <LogOut className="h-5 w-5" />
              {t('common.signOut')}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className={`flex-1 ${fullWidth ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
          <div className={fullWidth ? '' : 'max-w-6xl mx-auto'}>
            <div className="mb-6 hidden lg:block">
              <h2 className="text-2xl font-bold text-amber-400">{title}</h2>
              {description && (
                <p className="text-sm text-zinc-400 mt-1">{description}</p>
              )}
            </div>
            <div className="lg:hidden mb-4">
              <h2 className="text-xl font-bold text-amber-400">{title}</h2>
              {description && (
                <p className="text-sm text-zinc-400 mt-1">{description}</p>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

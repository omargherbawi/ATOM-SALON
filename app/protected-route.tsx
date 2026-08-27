'use client';

import { useSession, SessionProvider } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function ProtectedRouteInner({
  children,
  allowedRoles = ['admin', 'barber'],
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/login');
      return;
    }

    const role = session.user?.role || '';
    if (!allowedRoles.includes(role)) {
      if (role === 'barber') {
        router.push('/my-appointments');
      } else {
        router.push('/login');
      }
    }
  }, [session, status, router, allowedRoles, pathname]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const role = session.user?.role || '';
  if (!allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <ProtectedRouteInner allowedRoles={allowedRoles}>
        {children}
      </ProtectedRouteInner>
    </SessionProvider>
  );
}

'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Scissors } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from '../hooks/useTranslations';
import { useSettings } from '../contexts/SettingsContext';

function LoginForm() {
  const { t } = useTranslations();
  const { settings } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.error(t('login.invalidCredentials'));
      return;
    }

    const sessionRes = await fetch('/api/auth/session');
    const session = await sessionRes.json();

    if (session?.user?.role === 'barber') {
      router.push('/my-appointments');
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-zinc-950 to-black px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex rounded-full bg-amber-500/10 p-3 border border-amber-500/30 mb-4">
            <Scissors className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-amber-400">
            {settings.systemTitle}
          </h1>
          <p className="text-zinc-400 mt-1">{t('login.subtitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-amber-500/25 bg-zinc-900/60 p-6 sm:p-8 space-y-5"
        >
          <h2 className="text-lg font-semibold text-amber-300">
            {t('login.title')}
          </h2>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-semibold text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              t('login.signIn')
            )}
          </button>
        </form>

        <p className="text-center mt-6">
          <Link
            href="/"
            prefetch={false}
            className="text-sm text-amber-400/70 hover:text-amber-300"
          >
            ← {t('login.backToBooking')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

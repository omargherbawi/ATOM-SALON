'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from '../hooks/useTranslations';
import { readGuestProfile } from '@/lib/guest-client';

type Audience = 'barber' | 'customer';
type Support = 'checking' | 'supported' | 'ios-install' | 'unsupported';

// Remembers which audience this browser's subscription was registered for, so
// a barber who also books as a customer sees each toggle's own state.
const flagKey = (audience: Audience) => `atom-salon-push-${audience}`;

function readFlag(audience: Audience) {
  try {
    return localStorage.getItem(flagKey(audience));
  } catch {
    return null;
  }
}

function writeFlag(audience: Audience, endpoint: string | null) {
  try {
    if (endpoint) localStorage.setItem(flagKey(audience), endpoint);
    else localStorage.removeItem(flagKey(audience));
  } catch {
    // private mode - the toggle just forgets its state
  }
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

// Browser support never changes while the page is open.
const subscribeToSupport = () => () => {};

function detectSupport(): Support {
  if (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  ) {
    return 'supported';
  }
  // iOS Safari only exposes push once the site runs from the Home Screen.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !standalone ? 'ios-install' : 'unsupported';
}

export default function PushNotificationToggle({
  audience,
}: {
  audience: Audience;
}) {
  const { t, language } = useTranslations();
  const support = useSyncExternalStore<Support>(
    subscribeToSupport,
    detectSupport,
    () => 'checking'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (support !== 'supported') return;

    let cancelled = false;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (cancelled) return;
        setSubscribed(
          Boolean(
            subscription &&
              Notification.permission === 'granted' &&
              readFlag(audience) === subscription.endpoint
          )
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [audience, support]);

  const enable = async () => {
    setBusy(true);
    try {
      // Must be the first await so it still counts as a user gesture (Safari).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error(t('push.denied'));
        return;
      }

      const keyRes = await fetch('/api/push/subscribe', { cache: 'no-store' });
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) throw new Error('Push is not configured on the server');
      const applicationServerKey = base64UrlToBytes(publicKey);

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      // A subscription made with an older VAPID key can no longer be used.
      if (
        subscription &&
        !sameKey(subscription.options.applicationServerKey, applicationServerKey)
      ) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          audience,
          language,
          subscription: subscription.toJSON(),
          guestToken: readGuestProfile()?.token,
        }),
      });
      if (!res.ok) throw new Error(`Subscribe failed with ${res.status}`);

      writeFlag(audience, subscription.endpoint);
      setSubscribed(true);
      toast.success(t('push.turnedOn'));
    } catch (error) {
      console.error(error);
      toast.error(t('push.failed'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audience, endpoint: subscription.endpoint }),
        });
        const other: Audience = audience === 'barber' ? 'customer' : 'barber';
        // Keep the browser subscription alive if the other toggle still uses it.
        if (readFlag(other) !== subscription.endpoint) {
          await subscription.unsubscribe();
        }
      }
      writeFlag(audience, null);
      setSubscribed(false);
      toast.success(t('push.turnedOff'));
    } catch {
      toast.error(t('push.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (support === 'checking') return null;

  const hint =
    support === 'ios-install'
      ? t('push.iosHint')
      : support === 'unsupported'
        ? t('push.unsupported')
        : subscribed
          ? t('push.on')
          : t(audience === 'barber' ? 'push.barberHint' : 'push.customerHint');

  return (
    <div className="rounded-xl border border-amber-500/20 bg-zinc-900/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="flex items-start gap-2 text-sm text-zinc-300">
        {subscribed ? (
          <Bell className="h-4 w-4 mt-0.5 shrink-0 text-green-400" />
        ) : (
          <BellOff className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        )}
        <span>{hint}</span>
      </p>
      {support === 'supported' && (
        <button
          type="button"
          onClick={subscribed ? disable : enable}
          disabled={busy}
          className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
            subscribed
              ? 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              : 'bg-amber-500 text-black hover:bg-amber-400'
          }`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : subscribed ? (
            t('push.disable')
          ) : (
            t('push.enable')
          )}
        </button>
      )}
    </div>
  );
}

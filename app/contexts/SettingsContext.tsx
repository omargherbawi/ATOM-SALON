'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

interface Settings {
  systemTitle: string;
  tagline?: string;
}

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  hydrateSettings: (next: Settings) => void;
}

const defaultSettings: Settings = {
  systemTitle: 'Atom Salon',
  tagline: 'Premium Barbershop for Men',
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const hydrateSettings = useCallback((next: Settings) => {
    setSettings(next);
    setLoading(false);
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      return;
    }
    void refreshSettings();
  }, [refreshSettings]);

  return (
    <SettingsContext.Provider
      value={{ settings, loading, refreshSettings, hydrateSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

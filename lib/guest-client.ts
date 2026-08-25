const STORAGE_KEY = 'atom-salon-guest';

export type GuestProfile = {
  token: string;
  name: string;
  phone: string;
};

export function readGuestProfile(): GuestProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestProfile;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuestProfile(profile: GuestProfile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

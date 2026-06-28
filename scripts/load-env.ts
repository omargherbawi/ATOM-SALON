import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

for (const file of ['.env.local', '.env']) {
  const envPath = resolve(process.cwd(), file);
  if (!existsSync(envPath)) continue;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

import { type AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

import { getDatabase } from './database';

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      merged[row.key] = JSON.parse(row.value);
    } catch {
      // Ignore corrupt values; the default stays in place.
    }
  }
  return merged as unknown as AppSettings;
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value),
  ]);
}

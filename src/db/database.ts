import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

const DATABASE_NAME = 'scanpilot.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      // PRAGMA does not accept bound parameters; the value is an integer we control.
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** Lazily opens and migrates the single app database. */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync(DATABASE_NAME);
      await migrate(db);
      return db;
    })().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

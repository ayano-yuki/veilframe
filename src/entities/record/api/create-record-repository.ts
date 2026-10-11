import { openDB, type DBSchema } from 'idb';
import type { StoredRecord } from '../model/record-schema';
import { validateEntry } from '../model/validate-entry';
import type { RecordRepository } from './record-repository';

interface RecordDatabase extends DBSchema {
  records: { key: string; value: StoredRecord };
}

export function createRecordRepository(
  name = 'veilframe-records',
): RecordRepository {
  const database = openDB<RecordDatabase>(name, 1, {
    upgrade(db) {
      db.createObjectStore('records', { keyPath: 'record.id' });
    },
  });
  return {
    async list() {
      return (await (await database).getAll('records')).sort((a, b) =>
        b.record.createdAt.localeCompare(a.record.createdAt),
      );
    },
    async save(entry) {
      await (await database).put('records', validateEntry(entry));
    },
    async remove(id) {
      await (await database).delete('records', id);
    },
    async importAll(entries) {
      const validated = entries.map(validateEntry);
      const transaction = (await database).transaction('records', 'readwrite');
      let imported = 0;
      let skipped = 0;
      try {
        for (const entry of validated) {
          if (await transaction.store.getKey(entry.record.id)) {
            skipped++;
          } else {
            await transaction.store.add(entry);
            imported++;
          }
        }
        await transaction.done;
        return { imported, skipped };
      } catch (error: unknown) {
        try {
          transaction.abort();
        } catch {
          /* Already aborted by IndexedDB. */
        }
        await transaction.done.catch(() => undefined);
        throw error;
      }
    },
    async close() {
      (await database).close();
    },
  };
}

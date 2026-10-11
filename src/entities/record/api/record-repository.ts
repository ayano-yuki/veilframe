import type { StoredRecord } from '../model/record-schema';

export interface ImportResult {
  imported: number;
  skipped: number;
}

export interface RecordRepository {
  list(): Promise<StoredRecord[]>;
  save(entry: StoredRecord): Promise<void>;
  remove(id: string): Promise<void>;
  importAll(entries: StoredRecord[]): Promise<ImportResult>;
  close(): Promise<void>;
}

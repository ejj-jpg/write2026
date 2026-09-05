import { WritingRecord } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'ai_writing_temp_backup_';

export function saveDraftToLocal(record: WritingRecord): void {
  try {
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${record.recordId}`;
    localStorage.setItem(key, JSON.stringify({
      record,
      savedAt: Date.now()
    }));
  } catch (err) {
    console.warn('LocalStorage backup failed:', err);
  }
}

export function loadDraftFromLocal(recordId: string): WritingRecord | null {
  try {
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${recordId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.record || null;
  } catch {
    return null;
  }
}

export function removeDraftFromLocal(recordId: string): void {
  try {
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${recordId}`;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

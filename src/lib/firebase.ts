import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || undefined
);

export const COLLECTIONS = {
  CLASSES: 'classes',
  STUDENTS: 'students',
  DAILY_TOPICS: 'dailyTopics',
  WRITING_RECORDS: 'writingRecords',
  STUDENT_GROWTH: 'studentGrowth',
  STUDENT_BOOKS: 'studentBooks',
  SETTINGS: 'settings',
  TESTS: 'systemTests'
} as const;

export interface FirestoreTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  error?: string;
  details?: {
    created: boolean;
    read: boolean;
    updated: boolean;
    deleted: boolean;
  };
}

/**
 * 실시간 실제 Firestore CRUD 4단계 종합 연결 테스트
 * 생성(Create) -> 읽기(Read) -> 수정(Update) -> 삭제(Delete)
 */
export async function testFirestoreConnection(): Promise<FirestoreTestResult> {
  const startTime = performance.now();
  const testDocId = `test_health_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testRef = doc(db, COLLECTIONS.TESTS, testDocId);

  const steps = {
    created: false,
    read: false,
    updated: false,
    deleted: false
  };

  try {
    // 1. Create
    await setDoc(testRef, {
      testMessage: 'AI 글쓰기 성장 시스템 연결 테스트',
      step: 'init',
      createdAt: Date.now()
    });
    steps.created = true;

    // 2. Read
    const snap = await getDoc(testRef);
    if (!snap.exists()) {
      throw new Error('문서 생성이 확인되지 않았습니다.');
    }
    steps.read = true;

    // 3. Update
    await updateDoc(testRef, {
      step: 'updated',
      updatedAt: Date.now()
    });
    steps.updated = true;

    // 4. Delete
    await deleteDoc(testRef);
    const verifySnap = await getDoc(testRef);
    if (verifySnap.exists()) {
      throw new Error('테스트 문서 삭제에 실패했습니다.');
    }
    steps.deleted = true;

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      latencyMs,
      message: `Firestore CRUD(생성·읽기·수정·삭제) 전체 성공 (${latencyMs}ms)`,
      details: steps
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    // Cleanup if partially created
    try {
      await deleteDoc(testRef);
    } catch {
      // ignore
    }
    return {
      success: false,
      latencyMs,
      message: `Firestore 테스트 실패: ${err.message || String(err)}`,
      error: err.message || String(err),
      details: steps
    };
  }
}

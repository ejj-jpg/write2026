import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import { sha256, buildStudentKey, buildClassId } from './crypto';
import { Student, ClassInfo } from '../types';

export const TARGET_CLASS = {
  year: 2026,
  grade: 6,
  classNum: 3,
  id: '2026-6-3',
  name: '2026학년도 6학년 3반',
  classPassword: '0603'
} as const;

export interface RosterStudent {
  num: number;
  name: string;
  password: string; // 4자리: 06 + 2자리 번호
}

export const CLASS_ROSTER_2026_6_3: RosterStudent[] = [
  { num: 1, name: '김다언', password: '0601' },
  { num: 2, name: '김시연', password: '0602' },
  { num: 3, name: '김정민', password: '0603' },
  { num: 4, name: '김지후', password: '0604' },
  { num: 5, name: '김지훈', password: '0605' },
  { num: 6, name: '김혜빈', password: '0606' },
  { num: 7, name: '박건율', password: '0607' },
  { num: 8, name: '성서원', password: '0608' },
  { num: 9, name: '송소민', password: '0609' },
  { num: 10, name: '안율', password: '0610' },
  { num: 11, name: '양유정', password: '0611' },
  { num: 12, name: '양현정', password: '0612' },
  { num: 13, name: '유다연', password: '0613' },
  { num: 14, name: '윤은서', password: '0614' },
  { num: 15, name: '이희연', password: '0615' },
  { num: 16, name: '정윤아', password: '0616' },
  { num: 17, name: '정주원', password: '0617' },
  { num: 18, name: '주하율', password: '0618' },
  { num: 19, name: '홍예린', password: '0619' },
  { num: 20, name: '황민호', password: '0620' }
];

export function getExpectedPassword(studentNum: number): string {
  return `06${String(studentNum).padStart(2, '0')}`;
}

export function findRosterStudent(studentNum: number): RosterStudent | undefined {
  return CLASS_ROSTER_2026_6_3.find((s) => s.num === studentNum);
}

/**
 * 2026학년도 6학년 3반 및 학생 20명 객체 생성 헬퍼
 */
export async function createStudentObject(
  rosterItem: RosterStudent
): Promise<Student> {
  const studentKey = buildStudentKey(
    TARGET_CLASS.year,
    TARGET_CLASS.grade,
    TARGET_CLASS.classNum,
    rosterItem.num
  );
  const passwordHash = await sha256(rosterItem.password);

  return {
    id: studentKey,
    studentKey,
    classId: TARGET_CLASS.id,
    year: TARGET_CLASS.year,
    grade: TARGET_CLASS.grade,
    classNum: TARGET_CLASS.classNum,
    studentNum: rosterItem.num,
    name: rosterItem.name,
    personalPasswordHash: passwordHash,
    isPasswordInitialized: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

let syncPromise: Promise<void> | null = null;

/**
 * Firestore에 2026학년도 6학년 3반만 존재하도록 동기화:
 * - 2026-6-3 이외의 다른 구 학급 문서 삭제
 * - 2026-6-3 이외의 다른 학생 문서 삭제
 * - 2026-6-3 학급 정보 및 20명 학생 데이터 보장
 */
export async function ensureOnlyTargetClassExists(): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      // 1. 학급 컬렉션 정리 및 2026-6-3 보장
      const classPasswordHash = await sha256(TARGET_CLASS.classPassword);
      const targetClassDocRef = doc(db, COLLECTIONS.CLASSES, TARGET_CLASS.id);

      const targetClassData: ClassInfo = {
        id: TARGET_CLASS.id,
        year: TARGET_CLASS.year,
        grade: TARGET_CLASS.grade,
        classNum: TARGET_CLASS.classNum,
        classPasswordHash,
        studentCount: CLASS_ROSTER_2026_6_3.length,
        createdAt: Date.now()
      };

      await setDoc(targetClassDocRef, targetClassData, { merge: true });

      // 타 학급 문서 정리 (2026-6-3 이외 삭제)
      try {
        const classSnap = await getDocs(collection(db, COLLECTIONS.CLASSES));
        for (const cDoc of classSnap.docs) {
          if (cDoc.id !== TARGET_CLASS.id) {
            await deleteDoc(cDoc.ref);
          }
        }
      } catch (err) {
        console.warn('Old classes cleanup warning:', err);
      }

      // 2. 학생 컬렉션 정리 및 20명 학생 생성/업데이트
      for (const item of CLASS_ROSTER_2026_6_3) {
        const studentObj = await createStudentObject(item);
        const studentDocRef = doc(db, COLLECTIONS.STUDENTS, studentObj.studentKey);
        await setDoc(studentDocRef, studentObj, { merge: true });
      }

      // 2026-6-3에 속하지 않는 타 학생 문서 정리
      try {
        const studentSnap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
        for (const sDoc of studentSnap.docs) {
          const sData = sDoc.data() as Student;
          if (sData.classId !== TARGET_CLASS.id) {
            await deleteDoc(sDoc.ref);
          }
        }
      } catch (err) {
        console.warn('Old students cleanup warning:', err);
      }

      console.log('Successfully ensured 2026 Grade 6 Class 3 roster in Firestore.');
    } catch (err) {
      console.warn('ensureOnlyTargetClassExists warning (may be offline/permission):', err);
    }
  })();

  return syncPromise;
}

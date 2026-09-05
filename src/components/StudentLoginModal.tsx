import React, { useState, useEffect } from 'react';
import { X, Lock, UserCheck, AlertCircle, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import { sha256 } from '../lib/crypto';
import { Student } from '../types';
import {
  TARGET_CLASS,
  CLASS_ROSTER_2026_6_3,
  getExpectedPassword,
  findRosterStudent,
  createStudentObject,
  ensureOnlyTargetClassExists
} from '../lib/classRoster';

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (student: Student) => void;
}

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  // 2026학년도 6학년 3반 고정
  const year = TARGET_CLASS.year;
  const grade = TARGET_CLASS.grade;
  const classNum = TARGET_CLASS.classNum;

  const [studentNum, setStudentNum] = useState<number>(1);
  const [name, setName] = useState<string>('김다언');
  const [personalPassword, setPersonalPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 번호 변경 시 해당 학생 이름 자동 동기화
  useEffect(() => {
    const student = findRosterStudent(studentNum);
    if (student) {
      setName(student.name);
    }
  }, [studentNum]);

  // 모달 열릴 때 백그라운드로 2026-6-3 Firestore 보장
  useEffect(() => {
    if (isOpen) {
      ensureOnlyTargetClassExists().catch(() => {});
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const expectedPw = getExpectedPassword(studentNum);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetStudentInfo = findRosterStudent(studentNum);
    if (!targetStudentInfo) {
      setErrorMsg('1번부터 20번 사이의 번호를 선택해주세요.');
      return;
    }

    if (!personalPassword.trim()) {
      setErrorMsg('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const studentKey = `${year}-${grade}-${classNum}-${studentNum}`;
      const inputHash = await sha256(personalPassword.trim());

      // 1. Firestore 학생 문서 확인
      let studentData: Student | null = null;
      try {
        const studentDocRef = doc(db, COLLECTIONS.STUDENTS, studentKey);
        const studentSnap = await getDoc(studentDocRef);
        if (studentSnap.exists()) {
          studentData = studentSnap.data() as Student;
        }
      } catch (err) {
        console.warn('Firestore read error in login, using local verification fallback:', err);
      }

      // 학생 문서가 없으면 로컬 Roster 기준 생성
      if (!studentData) {
        studentData = await createStudentObject(targetStudentInfo);
        try {
          await setDoc(doc(db, COLLECTIONS.STUDENTS, studentKey), studentData, { merge: true });
        } catch (saveErr) {
          console.warn('Could not save new studentDoc to firestore:', saveErr);
        }
      }

      // 비밀번호 검증 (지정된 06 + 번호 두 자리 또는 해시 일치 여부)
      const expectedHash = await sha256(expectedPw);
      const isPasswordMatch =
        personalPassword.trim() === expectedPw ||
        inputHash === studentData.personalPasswordHash ||
        inputHash === expectedHash;

      if (!isPasswordMatch) {
        setErrorMsg('비밀번호가 올바르지 않습니다. 다시 확인해주세요.');
        setLoading(false);
        return;
      }

      // 로그인 성공
      setSuccessMsg(`${targetStudentInfo.name} 작가님, 환영합니다!`);
      setTimeout(() => {
        onLoginSuccess(studentData!);
        onClose();
      }, 300);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(`로그인 처리 중 오류가 발생했습니다: ${err.message || '다시 시도해주세요.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2A26]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] rounded-3xl shadow-2xl border border-[#EADDCA] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#5A8F7B] px-6 py-5 text-white flex items-center justify-between border-b border-[#4D7D6B]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-[#E2F0EA]" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight">어린이 작가 로그인</h3>
              <p className="text-xs text-[#E2F0EA]">2026학년도 6학년 3반 나만의 그림책 쓰기</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-[#F0F7F4] border border-[#D1E9DE] rounded-xl flex items-start gap-2 text-xs text-[#5A8F7B] font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5A8F7B] mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* 학년도 / 학년 / 반 고정 안내 카드 */}
            <div className="grid grid-cols-3 gap-2 bg-[#F5EFE6] p-3 rounded-2xl border border-[#EADDCA]">
              <div className="text-center">
                <span className="block text-[10px] font-bold text-[#8C8379]">학년도</span>
                <span className="text-sm font-extrabold text-[#2D2A26]">{year}년</span>
              </div>
              <div className="text-center border-x border-[#EADDCA]">
                <span className="block text-[10px] font-bold text-[#8C8379]">학년</span>
                <span className="text-sm font-extrabold text-[#5A8F7B]">{grade}학년</span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] font-bold text-[#8C8379]">학급</span>
                <span className="text-sm font-extrabold text-[#5A8F7B]">{classNum}반</span>
              </div>
            </div>

            {/* 번호 및 이름 선택 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">
                  번호 선택 (1~20번)
                </label>
                <select
                  value={studentNum}
                  onChange={(e) => setStudentNum(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#EADDCA] rounded-xl text-sm font-semibold text-[#2D2A26] bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                >
                  {CLASS_ROSTER_2026_6_3.map((s) => (
                    <option key={s.num} value={s.num}>
                      {s.num}번 - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">이름</label>
                <input
                  type="text"
                  value={name}
                  readOnly
                  className="w-full px-3 py-2.5 border border-[#EADDCA] rounded-xl text-sm font-bold text-[#2D2A26] bg-[#F9F7F2] cursor-default focus:outline-none"
                />
              </div>
            </div>

            {/* 개인 비밀번호 입력창 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-[#4A443F]">
                  개인 비밀번호 (4자리)
                </label>
                <span className="text-[11px] text-[#5A8F7B] font-bold bg-[#E2F0EA] px-2 py-0.5 rounded-md">
                  4자리 숫자
                </span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  placeholder="비밀번호 4자리 입력"
                  value={personalPassword}
                  onChange={(e) => setPersonalPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-[#EADDCA] rounded-xl text-sm font-semibold text-[#2D2A26] bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] tracking-wider"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-[#8C8379] absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-[#8C8379] mt-1.5 leading-relaxed">
                💡 선생님께 안내받은 개인 비밀번호 4자리를 입력해주세요.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl font-extrabold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>로그인 확인 중...</span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>{name} 작가 입장하기</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

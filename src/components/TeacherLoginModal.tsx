import React, { useState, useEffect } from 'react';
import { X, Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import { sha256 } from '../lib/crypto';
import { SystemSettings } from '../types';

interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    checkAdminSettings();
  }, [isOpen]);

  const checkAdminSettings = async () => {
    setChecking(true);
    setErrorMsg('');
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'admin_config');
      const snap = await getDoc(docRef);
      if (!snap.exists() || !snap.data()?.adminPasswordHash) {
        setIsFirstSetup(true);
      } else {
        setIsFirstSetup(false);
      }
    } catch (err: any) {
      console.warn('Admin check error:', err);
    } finally {
      setChecking(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!password.trim()) {
      setErrorMsg('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'admin_config');

      if (isFirstSetup) {
        if (password.length < 4) {
          setErrorMsg('관리자 비밀번호는 최소 4자리 이상이어야 합니다.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('비밀번호 확인이 일치하지 않습니다.');
          setLoading(false);
          return;
        }

        const hashed = await sha256(password.trim());
        const newSettings: SystemSettings = {
          id: 'admin_config',
          adminPasswordHash: hashed,
          studentNameDisplay: 'full',
          updatedAt: Date.now()
        };

        await setDoc(docRef, newSettings, { merge: true });
        setSuccessMsg('관리자 비밀번호가 안전하게 설정되었습니다.');
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 500);
      } else {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setErrorMsg('관리자 설정 정보를 불러올 수 없습니다.');
          setLoading(false);
          return;
        }

        const data = snap.data() as SystemSettings;
        const inputHash = await sha256(password.trim());

        if (inputHash !== data.adminPasswordHash) {
          setErrorMsg('관리자 비밀번호가 일치하지 않습니다.');
          setLoading(false);
          return;
        }

        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Teacher login err:', err);
      setErrorMsg(`로그인 처리 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2A26]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] rounded-3xl shadow-2xl border border-[#EADDCA] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#4A443F] px-6 py-5 text-[#FDFBF7] flex items-center justify-between border-b border-[#3B3632]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#EADDCA]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">선생님 / 관리자 로그인</h3>
              <p className="text-xs text-[#EADDCA]">학급 관리 및 과정중심평가 대시보드</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {checking ? (
            <div className="py-8 text-center text-xs text-[#8C8379]">
              관리자 보안 환경 확인 중...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isFirstSetup ? (
                <div className="p-3 bg-[#F0F7F4] border border-[#D1E9DE] rounded-xl text-xs text-[#2D2A26] leading-relaxed font-medium">
                  <strong className="text-[#5A8F7B]">최초 관리자 설정</strong>: 시스템을 처음 시작합니다. 앞으로 사용할 선생님 관리자 비밀번호를 등록해주세요. (비밀번호는 SHA-256으로 안전하게 암호화 저장됩니다.)
                </div>
              ) : null}

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-[#F0F7F4] border border-[#D1E9DE] rounded-xl flex items-start gap-2 text-xs text-[#5A8F7B] font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5A8F7B] mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#4A443F] mb-1">
                  {isFirstSetup ? '관리자 비밀번호 설정' : '선생님 관리자 비밀번호'}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-[#EADDCA] rounded-xl text-sm font-semibold text-[#2D2A26] bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    required
                  />
                  <Lock className="w-4 h-4 text-[#8C8379] absolute left-3 top-3" />
                </div>
              </div>

              {isFirstSetup && (
                <div>
                  <label className="block text-xs font-bold text-[#4A443F] mb-1">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="비밀번호 다시 입력"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-[#EADDCA] rounded-xl text-sm font-semibold text-[#2D2A26] bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                      required
                    />
                    <Lock className="w-4 h-4 text-[#8C8379] absolute left-3 top-3" />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl font-extrabold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Shield className="w-4 h-4" />
                  <span>{isFirstSetup ? '관리자 비밀번호 등록 및 시작' : '관리자 로그인'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

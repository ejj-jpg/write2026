import React from 'react';
import { Sparkles, GraduationCap, LogOut, Shield, User, RefreshCw } from 'lucide-react';
import { Student, StudentGrowth } from '../types';
import { formatStudentName } from '../lib/crypto';

interface NavbarProps {
  currentStudent: Student | null;
  studentGrowth: StudentGrowth | null;
  isTeacherLoggedIn: boolean;
  nameDisplayMode: 'full' | 'masked' | 'numOnly';
  onOpenStudentLogin: () => void;
  onOpenTeacherLogin: () => void;
  onLogout: () => void;
  onGoHome: () => void;
  onOpenBookshelf: () => void;
  activeView: 'home' | 'writing' | 'my-writings' | 'books' | 'teacher';
  setActiveView: (view: 'home' | 'writing' | 'my-writings' | 'books' | 'teacher') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStudent,
  studentGrowth,
  isTeacherLoggedIn,
  nameDisplayMode,
  onOpenStudentLogin,
  onOpenTeacherLogin,
  onLogout,
  onGoHome,
  onOpenBookshelf,
  activeView,
  setActiveView
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#EADDCA] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div
          id="app-logo-btn"
          onClick={onGoHome}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#5A8F7B] flex items-center justify-center text-white shadow-sm group-hover:bg-[#4D7D6B] transition-colors">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-[#2D2A26] tracking-tight font-['Pretendard']">
                AI 글쓰기 성장 <span className="text-[#5A8F7B]">숲</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0F7F4] text-[#5A8F7B] border border-[#D1E9DE]">
                초등 국어
              </span>
            </div>
            <p className="text-[11px] text-[#8C8379] font-medium hidden sm:block">
              생각하고 다듬으며 나만의 책을 짓는 시간
            </p>
          </div>
        </div>

        {/* Navigation & User Profile */}
        <div className="flex items-center gap-3">
          {currentStudent ? (
            <>
              {/* Writer Profile Capsule */}
              <div className="flex items-center gap-2.5 bg-[#FDFBF7] border border-[#EADDCA] rounded-full px-3.5 py-1.5 shadow-2xs">
                <span className="text-xl" title="학생 작가">
                  🌱
                </span>
                <div className="text-left hidden sm:block">
                  <div className="font-bold text-sm text-[#2D2A26]">
                    {formatStudentName(currentStudent.name, currentStudent.studentNum, nameDisplayMode)} 작가님
                  </div>
                  <div className="text-[10px] text-[#8C8379] font-medium">
                    {currentStudent.grade}학년 {currentStudent.classNum}반 {currentStudent.studentNum}번
                  </div>
                </div>
              </div>

              <button
                id="btn-logout"
                onClick={onLogout}
                className="p-2 text-[#8C8379] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : isTeacherLoggedIn ? (
            <>
              <div className="flex items-center gap-2 bg-[#F5EFE6] border border-[#EADDCA] text-[#A67C52] rounded-full px-3 py-1 text-xs font-bold">
                <GraduationCap className="w-4 h-4 text-[#A67C52]" />
                <span>교사용 관리자 모드</span>
              </div>

              <button
                id="nav-teacher-dash"
                onClick={() => setActiveView('teacher')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  activeView === 'teacher'
                    ? 'bg-[#5A8F7B] text-white shadow-xs'
                    : 'text-[#4A443F] hover:bg-[#F5EFE6]'
                }`}
              >
                대시보드
              </button>

              <button
                id="btn-teacher-logout"
                onClick={onLogout}
                className="p-2 text-[#8C8379] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="관리자 로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-open-student-login"
                onClick={onOpenStudentLogin}
                className="flex items-center gap-1.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-xs hover:shadow-sm transition-all"
              >
                <User className="w-4 h-4" />
                <span>학생 로그인</span>
              </button>

              <button
                id="btn-open-teacher-login"
                onClick={onOpenTeacherLogin}
                className="flex items-center gap-1.5 border border-[#EADDCA] hover:border-[#A67C52] text-[#4A443F] hover:text-[#A67C52] px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-[#F5EFE6] transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>선생님 로그인</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

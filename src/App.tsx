import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  PenTool,
  Award,
  GraduationCap,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Book,
  FileCheck
} from 'lucide-react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db, COLLECTIONS } from './lib/firebase';
import { Student, StudentGrowth, WritingRecord, StudentBook, SystemSettings } from './types';
import { ensureOnlyTargetClassExists, TARGET_CLASS, findRosterStudent } from './lib/classRoster';
import { Navbar } from './components/Navbar';
import { StudentLoginModal } from './components/StudentLoginModal';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import { StudentHome } from './components/StudentHome';
import { WritingWizard } from './components/WritingWorkflow/WritingWizard';
import { TeacherDashboard } from './components/TeacherDashboard/TeacherDashboard';
import { BookMakerModal } from './components/BookMakerModal';
import { WritingProcessViewerModal } from './components/WritingProcessViewerModal';

export default function App() {
  // Authentication states
  const [currentStudent, setCurrentStudent] = useState<Student | null>(() => {
    try {
      const saved = localStorage.getItem('active_student_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as Student;
      // 2026학년도 6학년 3반 및 유효한 학생인지 확인
      if (
        parsed.year === TARGET_CLASS.year &&
        parsed.grade === TARGET_CLASS.grade &&
        parsed.classNum === TARGET_CLASS.classNum &&
        findRosterStudent(parsed.studentNum)
      ) {
        return parsed;
      }
      localStorage.removeItem('active_student_session');
      return null;
    } catch {
      return null;
    }
  });

  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('active_teacher_session') === 'true';
    } catch {
      return false;
    }
  });

  // Student specific data
  const [growth, setGrowth] = useState<StudentGrowth | null>(null);
  const [records, setRecords] = useState<WritingRecord[]>([]);
  const [books, setBooks] = useState<StudentBook[]>([]);

  // System settings
  const [settings, setSettings] = useState<SystemSettings>({
    id: 'admin_config',
    adminPasswordHash: '',
    studentNameDisplay: 'full',
    updatedAt: Date.now()
  });

  // Navigation states
  const [view, setView] = useState<'home' | 'writing' | 'teacher'>('home');
  const [activeWritingRecord, setActiveWritingRecord] = useState<WritingRecord | null>(null);

  // Modals
  const [isStudentLoginOpen, setIsStudentLoginOpen] = useState<boolean>(false);
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState<boolean>(false);
  const [isBookMakerOpen, setIsBookMakerOpen] = useState<boolean>(false);
  const [viewingProcessRecord, setViewingProcessRecord] = useState<WritingRecord | null>(null);

  // Load Settings and ensure 2026-6-3 roster on mount
  useEffect(() => {
    const initSystem = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'admin_config'));
        if (snap.exists()) {
          setSettings(snap.data() as SystemSettings);
        }
      } catch (e) {
        console.warn('Load settings err:', e);
      }

      // 2026학년도 6학년 3반 단일 학급 및 20명 학생 동기화
      try {
        await ensureOnlyTargetClassExists();
      } catch (e) {
        console.warn('Roster sync err:', e);
      }
    };
    initSystem();
  }, []);

  // Sync Student Data when student logs in
  useEffect(() => {
    if (!currentStudent) {
      setGrowth(null);
      setRecords([]);
      setBooks([]);
      return;
    }

    // Save session
    try {
      localStorage.setItem('active_student_session', JSON.stringify(currentStudent));
    } catch (e) {
      console.warn(e);
    }

    // 1. Fetch or listen to Student Growth
    const unsubGrowth = onSnapshot(doc(db, COLLECTIONS.STUDENT_GROWTH, currentStudent.studentKey), (docSnap) => {
      if (docSnap.exists()) {
        setGrowth(docSnap.data() as StudentGrowth);
      } else {
        setGrowth({
          studentKey: currentStudent.studentKey,
          studentName: currentStudent.name,
          level: 1,
          xp: 0,
          completedCount: 0,
          badges: [],
          equippedAvatar: 'bear',
          updatedAt: Date.now()
        });
      }
    });

    // 2. Fetch or listen to Writing Records
    const recordsQ = query(
      collection(db, COLLECTIONS.WRITING_RECORDS),
      where('studentKey', '==', currentStudent.studentKey)
    );
    const unsubRecords = onSnapshot(recordsQ, (querySnap) => {
      const list: WritingRecord[] = [];
      querySnap.forEach((d) => list.push(d.data() as WritingRecord));
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setRecords(list);
    });

    // 3. Fetch or listen to Books
    const booksQ = query(
      collection(db, COLLECTIONS.STUDENT_BOOKS),
      where('studentKey', '==', currentStudent.studentKey)
    );
    const unsubBooks = onSnapshot(booksQ, (querySnap) => {
      const list: StudentBook[] = [];
      querySnap.forEach((d) => list.push(d.data() as StudentBook));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setBooks(list);
    });

    return () => {
      unsubGrowth();
      unsubRecords();
      unsubBooks();
    };
  }, [currentStudent]);

  // Auth Handlers
  const handleStudentLoginSuccess = (student: Student) => {
    setCurrentStudent(student);
    setIsTeacherLoggedIn(false);
    sessionStorage.removeItem('active_teacher_session');
    setView('home');
  };

  const handleTeacherLoginSuccess = () => {
    setIsTeacherLoggedIn(true);
    sessionStorage.setItem('active_teacher_session', 'true');
    setCurrentStudent(null);
    localStorage.removeItem('active_student_session');
    setView('teacher');
  };

  const handleLogout = () => {
    setCurrentStudent(null);
    setIsTeacherLoggedIn(false);
    localStorage.removeItem('active_student_session');
    sessionStorage.removeItem('active_teacher_session');
    setActiveWritingRecord(null);
    setView('home');
  };

  // Writing Actions
  const handleStartNewWriting = () => {
    setActiveWritingRecord(null);
    setView('writing');
  };

  const handleResumeWriting = (record: WritingRecord) => {
    setActiveWritingRecord(record);
    setView('writing');
  };

  const handleCloseWriting = () => {
    setActiveWritingRecord(null);
    setView('home');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#4A443F] flex flex-col font-['Pretendard']">
      {/* Top Navigation */}
      <Navbar
        currentStudent={currentStudent}
        isTeacherLoggedIn={isTeacherLoggedIn}
        growth={growth}
        nameDisplayMode={settings.studentNameDisplay}
        onOpenStudentLogin={() => setIsStudentLoginOpen(true)}
        onOpenTeacherLogin={() => setIsTeacherLoginOpen(true)}
        onLogout={handleLogout}
        onOpenBookMaker={() => setIsBookMakerOpen(true)}
        onNavigateHome={() => setView(isTeacherLoggedIn ? 'teacher' : 'home')}
      />

      {/* Main App Content */}
      <main className="flex-1">
        {/* VIEW 1: Teacher Dashboard */}
        {isTeacherLoggedIn ? (
          <TeacherDashboard onClose={() => setView('home')} />
        ) : currentStudent ? (
          /* VIEW 2: Student Logged In */
          view === 'writing' ? (
            <WritingWizard
              key={activeWritingRecord?.recordId || 'new_writing'}
              student={currentStudent}
              studentGrowth={growth}
              initialRecord={activeWritingRecord}
              existingRecord={activeWritingRecord}
              onClose={handleCloseWriting}
              onGrowthUpdate={(newGrowth) => setGrowth(newGrowth)}
              onCompleteSubmission={(_rec) => {
                handleCloseWriting();
              }}
            />
          ) : (
            <StudentHome
              student={currentStudent}
              growth={growth || {
                studentKey: currentStudent.studentKey,
                studentName: currentStudent.name,
                level: 1,
                xp: 0,
                completedCount: 0,
                badges: [],
                equippedAvatar: 'bear',
                updatedAt: Date.now()
              }}
              records={records}
              books={books}
              nameDisplayMode={settings.studentNameDisplay}
              onStartNewWriting={handleStartNewWriting}
              onResumeWriting={handleResumeWriting}
              onViewProcess={(rec) => setViewingProcessRecord(rec)}
              onOpenBookMaker={() => setIsBookMakerOpen(true)}
              onGrowthUpdate={(newGrowth) => setGrowth(newGrowth)}
            />
          )
        ) : (
          /* VIEW 3: Guest / Landing Screen */
          <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16 space-y-16 animate-in fade-in">
            {/* Hero Section */}
            <div className="text-center space-y-5 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-[#F0F7F4] text-[#5A8F7B] border border-[#D1E9DE] px-4 py-1.5 rounded-full text-xs font-extrabold shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#5A8F7B]" />
                <span>2026학년도 6학년 3반 • 나만의 그림책(동화책) 만들기</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-[#2D2A26] tracking-tight leading-tight">
                생각이 깊어지고 표현이 자라는<br />
                <span className="text-[#5A8F7B]">
                  6학년 3반 그림책 글쓰기 성장 숲
                </span>
              </h1>
              <p className="text-sm sm:text-base text-[#8C8379] leading-relaxed">
                첫 문장과 6대 이야기 요소(주인공, 목표, 시련, 도움, 해결, 결말)를 구상하고,
                제미나이 AI의 풍성한 아이디어와 따뜻한 피드백을 받아 멋진 그림책(동화책)을 완성해보세요.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  id="landing-student-login-btn"
                  onClick={() => setIsStudentLoginOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl text-base font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <PenTool className="w-5 h-5" />
                  <span>6학년 3반 작가 로그인 (글쓰기 시작)</span>
                </button>

                <button
                  id="landing-teacher-login-btn"
                  onClick={() => setIsTeacherLoginOpen(true)}
                  className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-[#F5EFE6] text-[#4A443F] border border-[#EADDCA] rounded-2xl text-base font-bold shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-5 h-5 text-[#A67C52]" />
                  <span>선생님 관리 및 평가 대시보드</span>
                </button>
              </div>
            </div>

            {/* 9-Step Writing Cycle Visual */}
            <div className="bg-white p-8 rounded-3xl border border-[#EADDCA] shadow-sm space-y-6">
              <div className="text-center space-y-1">
                <span className="text-xs font-extrabold text-[#A67C52] tracking-wider uppercase">글쓰기 여정 가이드</span>
                <h2 className="text-xl font-black text-[#2D2A26]">체계적인 9단계 글쓰기 성장 순환 과정</h2>
                <p className="text-xs text-[#8C8379]">한 번 쓰고 끝나는 글이 아니라, 질문하고 다듬으며 완성도를 높입니다.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3.5 pt-4">
                {[
                  { step: '1', title: '주제 확인', desc: '학년별 흥미 주제와 생각 깨우기 질문으로 시작해요.' },
                  { step: '2', title: '글쓰기 계획', desc: '발단, 전개, 절정, 결말의 개요로 글을 짜요.' },
                  { step: '3', title: '초고 작성', desc: '완벽하지 않아도 생각을 거침없이 글로 풀어내요.' },
                  { step: '4', title: 'AI 맞춤 피드백', desc: '잘된 점 2가지, 보완할 점 2가지, 친절한 질문을 받아요.' },
                  { step: '5', title: '수정 목표 세우기', desc: '피드백을 바탕으로 내가 직접 고칠 목표를 정해요.' },
                  { step: '6', title: '정성껏 고쳐쓰기', desc: '초고를 보며 표현을 더 풍부하고 정확하게 다듬어요.' },
                  { step: '7', title: '자기 평가', desc: '생생함, 자연스러움, 목표 달성도를 스스로 점검해요.' },
                  { step: '8', title: '맞춤법 점검', desc: '틀린 부분의 이유를 이해하고 바르게 교정해요.' },
                  { step: '9', title: '최종 제출 & 책 출판', desc: '멋진 작품을 완성하고 나만의 글 모음 책으로 엮어요.' },
                ].map((s) => (
                  <div
                    key={s.step}
                    className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#F2EDE4] flex items-start gap-3 hover:border-[#EADDCA] transition-colors"
                  >
                    <span className="w-7 h-7 rounded-xl bg-[#5A8F7B] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      {s.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-[#2D2A26]">{s.title}</h4>
                      <p className="text-xs text-[#8C8379] mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher Dashboard Feature Highlights */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-6 bg-white rounded-3xl border border-[#EADDCA] shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#F0F7F4] text-[#5A8F7B] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#2D2A26]">과정중심평가 AI 연계</h3>
                <p className="text-xs text-[#8C8379] leading-relaxed">
                  계획부터 초고, 피드백 반영, 고쳐쓰기 과정을 분석해 교사용 생활기록부 평가문 초안을 생성합니다.
                </p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#EADDCA] shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#F5EFE6] text-[#A67C52] flex items-center justify-center">
                  <Book className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#2D2A26]">나만의 책 만들기 & 인쇄</h3>
                <p className="text-xs text-[#8C8379] leading-relaxed">
                  완성된 작품들을 묶어 표지, 작가의 말, 목차를 갖춘 개인 문집을 인쇄하고 PDF로 소장합니다.
                </p>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-[#EADDCA] shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF4E5] text-[#D48806] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#2D2A26]">실시간 데이터 & 안전한 계정</h3>
                <p className="text-xs text-[#8C8379] leading-relaxed">
                  임시 더미 데이터가 아닌 Firestore 실시간 저장과 학급 비밀번호 인증 체계를 지원합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EADDCA] py-6 text-center text-xs text-[#8C8379]">
        AI와 함께하는 글쓰기 성장 숲 • 초등 국어과 과정중심 글쓰기 교육 플랫폼
      </footer>

      {/* Modals */}
      <StudentLoginModal
        isOpen={isStudentLoginOpen}
        onClose={() => setIsStudentLoginOpen(false)}
        onLoginSuccess={handleStudentLoginSuccess}
      />

      <TeacherLoginModal
        isOpen={isTeacherLoginOpen}
        onClose={() => setIsTeacherLoginOpen(false)}
        onLoginSuccess={handleTeacherLoginSuccess}
      />

      {currentStudent && (
        <BookMakerModal
          isOpen={isBookMakerOpen}
          onClose={() => setIsBookMakerOpen(false)}
          student={currentStudent}
          submittedRecords={records.filter(r => r.status === 'submitted')}
          onBookCreated={(newBook) => {
            setBooks(prev => [newBook, ...prev]);
          }}
        />
      )}

      {viewingProcessRecord && (
        <WritingProcessViewerModal
          isOpen={true}
          record={viewingProcessRecord}
          onClose={() => setViewingProcessRecord(null)}
          studentName={currentStudent?.name}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  Settings,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Lock,
  Database,
  Check,
  Award,
  GitCompare,
  ExternalLink
} from 'lucide-react';
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  where
} from 'firebase/firestore';
import { db, COLLECTIONS, testFirestoreConnection, FirestoreTestResult } from '../../lib/firebase';
import {
  ClassInfo,
  Student,
  WritingRecord,
  SystemSettings
} from '../../types';
import { buildClassId, buildStudentKey, sha256, formatStudentName } from '../../lib/crypto';
import { TARGET_CLASS, CLASS_ROSTER_2026_6_3, ensureOnlyTargetClassExists } from '../../lib/classRoster';
import { testGeminiConnection, GeminiTestResult, requestProcessAssessmentDraft } from '../../lib/aiService';
import { WritingProcessViewerModal } from '../WritingProcessViewerModal';

interface TeacherDashboardProps {
  onClose: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onClose }) => {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<'writings' | 'classes' | 'system'>('writings');

  // Data states
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<WritingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<WritingRecord | null>(null);
  const [viewingProcessRecord, setViewingProcessRecord] = useState<WritingRecord | null>(null);

  // Settings state
  const [settings, setSettings] = useState<SystemSettings>({
    id: 'admin_config',
    adminPasswordHash: '',
    studentNameDisplay: 'full',
    updatedAt: Date.now()
  });

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Class & Student management forms (2026학년도 6학년 3반 기본 설정)
  const [newClassYear, setNewClassYear] = useState<number>(TARGET_CLASS.year);
  const [newClassGrade, setNewClassGrade] = useState<number>(TARGET_CLASS.grade);
  const [newClassNum, setNewClassNum] = useState<number>(TARGET_CLASS.classNum);
  const [newClassPassword, setNewClassPassword] = useState<string>(TARGET_CLASS.classPassword);

  const [singleStudentNum, setSingleStudentNum] = useState<number>(1);
  const [singleStudentName, setSingleStudentName] = useState<string>('김다언');

  const [bulkStudentText, setBulkStudentText] = useState<string>(
    CLASS_ROSTER_2026_6_3.map((s) => `${s.num} ${s.name}`).join('\n')
  );

  // System & Connection Test states
  const [firestoreTestResult, setFirestoreTestResult] = useState<FirestoreTestResult | null>(null);
  const [geminiTestResult, setGeminiTestResult] = useState<GeminiTestResult | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  // Password change form
  const [oldAdminPw, setOldAdminPw] = useState<string>('');
  const [newAdminPw, setNewAdminPw] = useState<string>('');
  const [confirmAdminPw, setConfirmAdminPw] = useState<string>('');

  // Assessment draft generation
  const [generatingAssessment, setGeneratingAssessment] = useState<boolean>(false);

  useEffect(() => {
    loadClasses();
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedStudent) {
      loadRecordsForStudent(selectedStudent.studentKey);
    }
  }, [selectedStudent]);

  // 1. Data Loaders
  const loadClasses = async () => {
    try {
      await ensureOnlyTargetClassExists();
      const snap = await getDocs(collection(db, COLLECTIONS.CLASSES));
      const loaded: ClassInfo[] = [];
      snap.forEach((d) => loaded.push(d.data() as ClassInfo));
      // 2026-6-3 우선 배치
      loaded.sort((a, b) => (a.id === TARGET_CLASS.id ? -1 : 1));
      setClasses(loaded);
      if (loaded.length > 0) {
        setSelectedClassId(TARGET_CLASS.id);
      }
    } catch (err: any) {
      console.warn('Load classes err:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'admin_config');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSettings(snap.data() as SystemSettings);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const loadStudentsForClass = async (classId: string) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
      const list: Student[] = [];
      snap.forEach((d) => {
        const item = d.data() as Student;
        if (item.classId === classId) {
          list.push(item);
        }
      });
      list.sort((a, b) => a.studentNum - b.studentNum);
      setStudents(list);
      if (list.length > 0) {
        setSelectedStudent(list[0]);
      } else {
        setSelectedStudent(null);
        setStudentRecords([]);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRecordsForStudent = async (studentKey: string) => {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.WRITING_RECORDS));
      const list: WritingRecord[] = [];
      snap.forEach((d) => {
        const item = d.data() as WritingRecord;
        if (item.studentKey === studentKey) {
          list.push(item);
        }
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setStudentRecords(list);
      if (list.length > 0) {
        setSelectedRecord(list[0]);
      } else {
        setSelectedRecord(null);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // 2. Class creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const classId = buildClassId(newClassYear, newClassGrade, newClassNum);
      const hash = await sha256(newClassPassword.trim());

      const newClass: ClassInfo = {
        id: classId,
        year: newClassYear,
        grade: newClassGrade,
        classNum: newClassNum,
        classPasswordHash: hash,
        studentCount: 0,
        createdAt: Date.now()
      };

      await setDoc(doc(db, COLLECTIONS.CLASSES, classId), newClass);
      setMsg({ type: 'success', text: `${newClassYear}학년도 ${newClassGrade}학년 ${newClassNum}반 학급이 생성되었습니다.` });
      loadClasses();
      setSelectedClassId(classId);
    } catch (err: any) {
      setMsg({ type: 'error', text: `학급 생성 실패: ${err.message}` });
    }
  };

  // 3. Student Registration (Single)
  const handleRegisterSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!selectedClassId) {
      setMsg({ type: 'error', text: '먼저 학급을 선택해주세요.' });
      return;
    }
    if (!singleStudentName.trim()) {
      setMsg({ type: 'error', text: '학생 이름을 입력해주세요.' });
      return;
    }

    const currentClass = classes.find(c => c.id === selectedClassId);
    if (!currentClass) return;

    try {
      const studentKey = buildStudentKey(currentClass.year, currentClass.grade, currentClass.classNum, singleStudentNum);
      const student: Student = {
        id: studentKey,
        studentKey,
        classId: selectedClassId,
        year: currentClass.year,
        grade: currentClass.grade,
        classNum: currentClass.classNum,
        studentNum: singleStudentNum,
        name: singleStudentName.trim(),
        personalPasswordHash: '',
        isPasswordInitialized: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(doc(db, COLLECTIONS.STUDENTS, studentKey), student);
      setMsg({ type: 'success', text: `${singleStudentNum}번 ${singleStudentName} 학생이 등록되었습니다.` });
      setSingleStudentName('');
      setSingleStudentNum(prev => prev + 1);
      loadStudentsForClass(selectedClassId);
    } catch (err: any) {
      setMsg({ type: 'error', text: `학생 등록 실패: ${err.message}` });
    }
  };

  // 4. Student Registration (Bulk multi-line)
  const handleRegisterBulkStudents = async () => {
    setMsg(null);
    if (!selectedClassId) {
      setMsg({ type: 'error', text: '먼저 학급을 선택해주세요.' });
      return;
    }

    const currentClass = classes.find(c => c.id === selectedClassId);
    if (!currentClass) return;

    const lines = bulkStudentText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setMsg({ type: 'error', text: '등록할 학생 명단을 입력해주세요.' });
      return;
    }

    let successCount = 0;
    try {
      for (const line of lines) {
        // e.g. "1 김하늘" or "1, 김하늘" or just "김하늘"
        let num = 0;
        let name = '';

        const parts = line.split(/[\s,]+/);
        if (parts.length >= 2 && !isNaN(Number(parts[0]))) {
          num = Number(parts[0]);
          name = parts.slice(1).join(' ');
        } else {
          num = successCount + 1;
          name = line;
        }

        const defaultPw = `06${String(num).padStart(2, '0')}`;
        const defaultHash = await sha256(defaultPw);

        const studentKey = buildStudentKey(currentClass.year, currentClass.grade, currentClass.classNum, num);
        const student: Student = {
          id: studentKey,
          studentKey,
          classId: selectedClassId,
          year: currentClass.year,
          grade: currentClass.grade,
          classNum: currentClass.classNum,
          studentNum: num,
          name: name.trim(),
          personalPasswordHash: defaultHash,
          isPasswordInitialized: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await setDoc(doc(db, COLLECTIONS.STUDENTS, studentKey), student);
        successCount++;
      }

      setMsg({ type: 'success', text: `총 ${successCount}명의 학생이 등록되었습니다. (비밀번호: 06+번호 4자리)` });
      loadStudentsForClass(selectedClassId);
    } catch (err: any) {
      setMsg({ type: 'error', text: `일괄 등록 중 오류: ${err.message}` });
    }
  };

  // 5. Reset Student Password (기본 비밀번호 06+번호 로 재설정)
  const handleResetStudentPassword = async (studentKey: string, studentName: string) => {
    const student = students.find((s) => s.studentKey === studentKey);
    const defaultPw = student ? `06${String(student.studentNum).padStart(2, '0')}` : '0601';
    if (!confirm(`${studentName} 학생의 비밀번호를 기본 비밀번호(${defaultPw})로 재설정하시겠습니까?`)) {
      return;
    }

    try {
      const defaultHash = await sha256(defaultPw);
      await updateDoc(doc(db, COLLECTIONS.STUDENTS, studentKey), {
        personalPasswordHash: defaultHash,
        isPasswordInitialized: false,
        updatedAt: Date.now()
      });
      setMsg({ type: 'success', text: `${studentName} 학생의 비밀번호가 기본 비밀번호(${defaultPw})로 재설정되었습니다.` });
      if (selectedClassId) loadStudentsForClass(selectedClassId);
    } catch (err: any) {
      setMsg({ type: 'error', text: `초기화 실패: ${err.message}` });
    }
  };

  // 6. Name display mode update
  const handleUpdateNameDisplayMode = async (mode: 'full' | 'masked' | 'numOnly') => {
    try {
      const updated: SystemSettings = {
        ...settings,
        studentNameDisplay: mode,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, COLLECTIONS.SETTINGS, 'admin_config'), updated, { merge: true });
      setSettings(updated);
      setMsg({ type: 'success', text: '학생 이름 표시 방식이 변경되었습니다.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: `설정 저장 실패: ${err.message}` });
    }
  };

  // 7. Admin password change
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (newAdminPw.length < 4) {
      setMsg({ type: 'error', text: '새 비밀번호는 4자리 이상이어야 합니다.' });
      return;
    }
    if (newAdminPw !== confirmAdminPw) {
      setMsg({ type: 'error', text: '새 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    try {
      const oldHash = await sha256(oldAdminPw.trim());
      if (oldHash !== settings.adminPasswordHash) {
        setMsg({ type: 'error', text: '현재 관리자 비밀번호가 일치하지 않습니다.' });
        return;
      }

      const newHash = await sha256(newAdminPw.trim());
      const updated: SystemSettings = {
        ...settings,
        adminPasswordHash: newHash,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, COLLECTIONS.SETTINGS, 'admin_config'), updated, { merge: true });
      setSettings(updated);
      setOldAdminPw('');
      setNewAdminPw('');
      setConfirmAdminPw('');
      setMsg({ type: 'success', text: '관리자 비밀번호가 안전하게 변경되었습니다.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: `비밀번호 변경 실패: ${err.message}` });
    }
  };

  // 8. Connection Tests
  const handleRunSystemTests = async () => {
    setTestingConnection(true);
    setFirestoreTestResult(null);
    setGeminiTestResult(null);

    try {
      // 1. Firestore test (Real Create -> Read -> Update -> Delete)
      const firestoreRes = await testFirestoreConnection();
      setFirestoreTestResult(firestoreRes);

      // 2. Gemini test (Real Server call)
      const geminiRes = await testGeminiConnection();
      setGeminiTestResult(geminiRes);
    } finally {
      setTestingConnection(false);
    }
  };

  // 9. Generate Process Assessment Draft (과정중심평가 AI 초안 생성)
  const handleGenerateProcessAssessment = async () => {
    if (!selectedRecord || !selectedStudent) return;
    setGeneratingAssessment(true);
    try {
      const currentClass = classes.find(c => c.id === selectedClassId);
      const grade = currentClass?.grade || 4;

      const aiDraft = await requestProcessAssessmentDraft(selectedStudent.name, grade, selectedRecord);

      const updatedRecord: WritingRecord = {
        ...selectedRecord,
        aiAssessmentDraft: aiDraft,
        teacherAssessment: selectedRecord.teacherAssessment || aiDraft,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, COLLECTIONS.WRITING_RECORDS, selectedRecord.recordId), updatedRecord, { merge: true });
      setSelectedRecord(updatedRecord);
      setMsg({ type: 'success', text: 'AI 과정중심평가 초안이 성공적으로 생성되었습니다.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: `평가 생성 실패: ${err.message}` });
    } finally {
      setGeneratingAssessment(false);
    }
  };

  // 10. Save Teacher Assessment
  const handleSaveTeacherAssessment = async () => {
    if (!selectedRecord) return;
    try {
      await setDoc(doc(db, COLLECTIONS.WRITING_RECORDS, selectedRecord.recordId), selectedRecord, { merge: true });
      setMsg({ type: 'success', text: '교사 과정중심평가가 저장되었습니다.' });
      if (selectedStudent) loadRecordsForStudent(selectedStudent.studentKey);
    } catch (err: any) {
      setMsg({ type: 'error', text: `평가 저장 실패: ${err.message}` });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-[#5A8F7B] border border-[#D1E9DE] flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#2D2A26] tracking-tight">교사용 대시보드</h1>
            <p className="text-xs text-[#8C8379]">
              학급 학생 관리, 글쓰기 과정 관찰 및 과정중심평가 생성
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-[#F5EFE6] p-1.5 rounded-2xl gap-1 border border-[#EADDCA]">
          <button
            onClick={() => setActiveTab('writings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'writings' ? 'bg-white text-[#5A8F7B] shadow-xs' : 'text-[#8C8379] hover:text-[#2D2A26]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>글쓰기 현황 & 과정평가</span>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'classes' ? 'bg-white text-[#5A8F7B] shadow-xs' : 'text-[#8C8379] hover:text-[#2D2A26]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>학급 및 학생 관리</span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'system' ? 'bg-white text-[#5A8F7B] shadow-xs' : 'text-[#8C8379] hover:text-[#2D2A26]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>시스템 & 연결 테스트</span>
          </button>
        </div>
      </div>

      {/* Global alert banner */}
      {msg && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
          msg.type === 'success' ? 'bg-[#F0F7F4] border-[#D1E9DE] text-[#5A8F7B]' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* TAB 1: 학생 글쓰기 현황 & 과정중심평가 */}
      {activeTab === 'writings' && (
        <div className="space-y-6">
          {/* Class Picker */}
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-[#EADDCA]">
            <span className="text-xs font-bold text-[#2D2A26]">학급 선택:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 border border-[#EADDCA] rounded-xl text-xs font-bold bg-white text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
            >
              {classes.length === 0 && <option value="">등록된 학급 없음</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year}학년도 {c.grade}학년 {c.classNum}반
                </option>
              ))}
            </select>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Student List (Left, 4 cols) */}
            <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-[#EADDCA] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#EADDCA] pb-3">
                <h3 className="font-extrabold text-sm text-[#2D2A26]">학생 명단 ({students.length}명)</h3>
              </div>

              {students.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8C8379]">
                  등록된 학생이 없습니다. [학급 및 학생 관리] 탭에서 학생을 등록해주세요.
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {students.map((st) => {
                    const isSelected = selectedStudent?.studentKey === st.studentKey;
                    return (
                      <div
                        key={st.studentKey}
                        onClick={() => setSelectedStudent(st)}
                        className={`p-3 rounded-2xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-[#5A8F7B] bg-[#F0F7F4] shadow-xs'
                            : 'border-[#F5EFE6] hover:border-[#EADDCA] bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#5A8F7B]">{st.studentNum}번</span>
                            <span className="text-sm font-bold text-[#2D2A26]">
                              {formatStudentName(st.name, st.studentNum, settings.studentNameDisplay)}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8C8379]">
                            {st.isPasswordInitialized ? '비밀번호 미등록(학급PW필요)' : '개인 비밀번호 사용 중'}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetStudentPassword(st.studentKey, st.name);
                          }}
                          className="px-2 py-1 border border-[#EADDCA] hover:bg-rose-50 hover:border-rose-200 text-[#8C8379] hover:text-rose-700 rounded-lg text-[10px] font-bold transition-colors"
                          title="비밀번호 초기화"
                        >
                          PW 초기화
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Writing Records & Formative Assessment (Right, 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {selectedStudent ? (
                <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADDCA] pb-4">
                    <div>
                      <h2 className="text-lg font-black text-[#2D2A26]">
                        {formatStudentName(selectedStudent.name, selectedStudent.studentNum, settings.studentNameDisplay)} 학생의 글쓰기 기록
                      </h2>
                      <p className="text-xs text-[#8C8379]">
                        총 {studentRecords.length}편의 작품 기록
                      </p>
                    </div>

                    {/* Writing Selector */}
                    {studentRecords.length > 0 && (
                      <select
                        value={selectedRecord?.recordId || ''}
                        onChange={(e) => {
                          const r = studentRecords.find(x => x.recordId === e.target.value);
                          if (r) setSelectedRecord(r);
                        }}
                        className="px-3 py-1.5 border border-[#EADDCA] rounded-xl text-xs font-bold bg-white text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                      >
                        {studentRecords.map((r) => (
                          <option key={r.recordId} value={r.recordId}>
                            [{r.status === 'submitted' ? '제출 완료' : `${r.currentStep}단계 작성 중`}] {r.planning?.title || r.topicTitle}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {studentRecords.length === 0 ? (
                    <div className="py-16 text-center text-xs text-[#8C8379]">
                      아직 작성한 글이 없습니다.
                    </div>
                  ) : selectedRecord ? (
                    <div className="space-y-6">
                      {/* Quick Overview & Action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA]">
                        <div>
                          <h3 className="font-extrabold text-sm text-[#2D2A26]">
                            {selectedRecord.planning?.title || selectedRecord.topicTitle}
                          </h3>
                          <span className="text-xs text-[#8C8379]">
                            {selectedRecord.planning?.genre} • 초고 {selectedRecord.draft?.length || 0}자 ➔ 최종 {(selectedRecord.finalWriting || selectedRecord.draft).length}자
                          </span>
                        </div>

                        <button
                          onClick={() => setViewingProcessRecord(selectedRecord)}
                          className="px-3.5 py-2 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>전체 과정 및 초고/최종 비교 보기</span>
                        </button>
                      </div>

                      {/* Process-Focused Assessment Section (과정중심평가) */}
                      <div className="p-6 bg-[#F0F7F4]/40 rounded-3xl border border-[#D1E9DE] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-[#5A8F7B]" />
                            <h3 className="font-black text-sm text-[#2D2A26]">AI 기반 국어과 과정중심평가</h3>
                          </div>
                          <button
                            onClick={handleGenerateProcessAssessment}
                            disabled={generatingAssessment}
                            className="px-3.5 py-1.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{generatingAssessment ? 'AI 분석 중...' : selectedRecord.aiAssessmentDraft ? 'AI 평가 초안 재생성' : 'AI 평가 초안 생성하기'}</span>
                          </button>
                        </div>

                        {/* AI Draft Display */}
                        {selectedRecord.aiAssessmentDraft && (
                          <div className="p-4 bg-white rounded-2xl border border-[#D1E9DE] text-xs text-[#4A443F] space-y-2">
                            <span className="font-bold text-[#5A8F7B] block">🤖 AI 생성 평가문 초안:</span>
                            <p className="leading-relaxed whitespace-pre-wrap">{selectedRecord.aiAssessmentDraft}</p>
                          </div>
                        )}

                        {/* Teacher Editable Assessment Box */}
                        <div>
                          <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                            선생님 최종 과정중심평가 서술문 (학교생활기록부 반영용):
                          </label>
                          <textarea
                            rows={5}
                            placeholder="AI 평가 초안을 바탕으로 학생의 구체적인 글쓰기 성장과정을 교사의 전문적인 관점에서 보완·수정하여 작성하세요."
                            value={selectedRecord.teacherAssessment || ''}
                            onChange={(e) => {
                              setSelectedRecord({
                                ...selectedRecord,
                                teacherAssessment: e.target.value
                              });
                            }}
                            className="w-full p-3.5 border border-[#EADDCA] rounded-xl text-xs font-medium text-[#2D2A26] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-white"
                          />
                        </div>

                        {/* Teacher Memo */}
                        <div>
                          <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                            교사 전용 비공개 지도 메모:
                          </label>
                          <input
                            type="text"
                            placeholder="학생에게 공개되지 않는 교사용 개별 관찰 메모"
                            value={selectedRecord.teacherMemo || ''}
                            onChange={(e) => {
                              setSelectedRecord({
                                ...selectedRecord,
                                teacherMemo: e.target.value
                              });
                            }}
                            className="w-full px-3.5 py-2 border border-[#EADDCA] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-white text-[#2D2A26]"
                          />
                        </div>

                        {/* Status Checkboxes & Save */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#D1E9DE]">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-[#4A443F] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedRecord.teacherAssessmentApproved}
                                onChange={(e) => {
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    teacherAssessmentApproved: e.target.checked
                                  });
                                }}
                                className="w-4 h-4 rounded text-[#5A8F7B] focus:ring-[#5A8F7B]"
                              />
                              <span>과정중심평가 승인 완료</span>
                            </label>

                            <label className="flex items-center gap-1.5 text-xs font-bold text-[#4A443F] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedRecord.teacherChecked}
                                onChange={(e) => {
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    teacherChecked: e.target.checked
                                  });
                                }}
                                className="w-4 h-4 rounded text-[#5A8F7B] focus:ring-[#5A8F7B]"
                              />
                              <span>교사 확인 완료</span>
                            </label>
                          </div>

                          <button
                            onClick={handleSaveTeacherAssessment}
                            className="px-5 py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            <span>평가 저장하기</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-24 text-center bg-white rounded-3xl border border-[#EADDCA] text-[#8C8379] text-xs">
                  왼쪽 목록에서 학생을 선택해주세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 학급 및 학생 관리 */}
      {activeTab === 'classes' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Create / Manage Class */}
          <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs space-y-6">
            <h3 className="font-extrabold text-base text-[#2D2A26] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#5A8F7B]" />
              <span>새 학급 개설하기</span>
            </h3>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">학년도</label>
                  <input
                    type="number"
                    value={newClassYear}
                    onChange={(e) => setNewClassYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">학년</label>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold bg-white text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                  >
                    {[1, 2, 3, 4, 5, 6].map(g => (
                      <option key={g} value={g}>{g}학년</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">반</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newClassNum}
                    onChange={(e) => setNewClassNum(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                  학급 비밀번호 (학생 최초 로그인 시 본인 확인용)
                </label>
                <input
                  type="text"
                  placeholder="예: 1234"
                  value={newClassPassword}
                  onChange={(e) => setNewClassPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold shadow-xs transition-colors"
              >
                학급 생성하기
              </button>
            </form>

            {/* List of existing classes */}
            <div className="pt-4 border-t border-[#EADDCA] space-y-2">
              <span className="text-xs font-bold text-[#2D2A26] block">개설된 학급 목록</span>
              <div className="space-y-1.5">
                {classes.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      selectedClassId === c.id ? 'bg-[#F0F7F4] border-[#D1E9DE] text-[#5A8F7B]' : 'bg-[#FDFBF7] border-[#EADDCA] text-[#4A443F]'
                    }`}
                  >
                    <span>{c.year}학년도 {c.grade}학년 {c.classNum}반</span>
                    <button
                      onClick={() => setSelectedClassId(c.id)}
                      className="px-2.5 py-1 bg-white border border-[#EADDCA] rounded-lg text-[11px] text-[#4A443F] hover:bg-[#F5EFE6]"
                    >
                      선택
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Student Registration (Single + Bulk) */}
          <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs space-y-6">
            <h3 className="font-extrabold text-base text-[#2D2A26] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5A8F7B]" />
              <span>학생 등록 (선택 학급: {classes.find(c => c.id === selectedClassId)?.grade || '-'}학년 {classes.find(c => c.id === selectedClassId)?.classNum || '-'}반)</span>
            </h3>

            {/* Single Student */}
            <form onSubmit={handleRegisterSingleStudent} className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] space-y-3">
              <span className="text-xs font-extrabold text-[#2D2A26] block">1. 개별 학생 등록</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  placeholder="번호"
                  value={singleStudentNum}
                  onChange={(e) => setSingleStudentNum(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold bg-white text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                />
                <input
                  type="text"
                  placeholder="학생 이름 (예: 김하늘)"
                  value={singleStudentName}
                  onChange={(e) => setSingleStudentName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold bg-white text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-bold shrink-0 transition-colors"
                >
                  등록
                </button>
              </div>
            </form>

            {/* Bulk Student Textarea */}
            <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#2D2A26] block">2. 여러 줄 일괄 등록</span>
                <span className="text-[10px] text-[#8C8379]">한 줄에 한 명씩 '번호 이름' 형태</span>
              </div>
              <textarea
                rows={5}
                value={bulkStudentText}
                onChange={(e) => setBulkStudentText(e.target.value)}
                className="w-full p-3 border border-[#EADDCA] rounded-xl text-xs font-mono bg-white text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleRegisterBulkStudents}
                  className="flex-1 py-2.5 bg-[#4A443F] hover:bg-[#2D2A26] text-white rounded-xl text-xs font-bold transition-colors"
                >
                  여러 줄 학생 전체 등록하기
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await ensureOnlyTargetClassExists();
                      await loadClasses();
                      await loadStudentsForClass(TARGET_CLASS.id);
                      setMsg({
                        type: 'success',
                        text: '2026학년도 6학년 3반 20명 명단(김다언~황민호) 및 비밀번호(0601~0620)가 동기화되었습니다.'
                      });
                    } catch (err: any) {
                      setMsg({ type: 'error', text: `동기화 실패: ${err.message}` });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-[#F0F7F4] hover:bg-[#E2F0EA] border border-[#D1E9DE] text-[#5A8F7B] rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>6학년 3반 20명 즉시 동기화</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 시스템 설정 & 연결 테스트 */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Connection Test Card */}
          <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#2D2A26] flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#5A8F7B]" />
                  <span>시스템 실시간 연결 테스트</span>
                </h3>
                <p className="text-xs text-[#8C8379]">
                  실제로 Firestore 문서를 생성·읽기·수정·삭제하고 Gemini API를 실시간 호출하여 검증합니다.
                </p>
              </div>
              <button
                onClick={handleRunSystemTests}
                disabled={testingConnection}
                className="px-5 py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? '실제 연결 테스트 진행 중...' : '전체 시스템 실시간 테스트 실행'}</span>
              </button>
            </div>

            {/* Test Results Display */}
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              {/* Firestore Test Card */}
              <div className="p-4 rounded-2xl border bg-[#FDFBF7] border-[#EADDCA] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#2D2A26]">Firebase Firestore</span>
                  {firestoreTestResult && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      firestoreTestResult.success ? 'bg-[#F0F7F4] text-[#5A8F7B]' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {firestoreTestResult.success ? `정상 (${firestoreTestResult.latencyMs}ms)` : '실패'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#4A443F] leading-relaxed">
                  {firestoreTestResult
                    ? firestoreTestResult.message
                    : '테스트 실행 전입니다. [실시간 테스트 실행] 버튼을 눌러주세요.'}
                </p>
                {firestoreTestResult?.details && (
                  <div className="text-[11px] text-[#8C8379] pt-1 flex gap-2">
                    <span>생성: {firestoreTestResult.details.created ? '✔' : '✖'}</span>
                    <span>읽기: {firestoreTestResult.details.read ? '✔' : '✖'}</span>
                    <span>수정: {firestoreTestResult.details.updated ? '✔' : '✖'}</span>
                    <span>삭제: {firestoreTestResult.details.deleted ? '✔' : '✖'}</span>
                  </div>
                )}
              </div>

              {/* Gemini Test Card */}
              <div className="p-4 rounded-2xl border bg-[#FDFBF7] border-[#EADDCA] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#2D2A26]">Gemini AI API</span>
                  {geminiTestResult && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      geminiTestResult.success ? 'bg-[#F0F7F4] text-[#5A8F7B]' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {geminiTestResult.success ? `정상 (${geminiTestResult.latencyMs}ms)` : '실패'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#4A443F] leading-relaxed">
                  {geminiTestResult
                    ? `${geminiTestResult.message} (${geminiTestResult.model || ''})`
                    : '테스트 실행 전입니다. [실시간 테스트 실행] 버튼을 눌러주세요.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Student Name Display Setting */}
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-[#2D2A26]">학생 이름 표시 방식</h3>
              <p className="text-xs text-[#8C8379]">대시보드와 화면에서 학생의 이름 표기를 어떻게 표시할지 선택합니다.</p>

              <div className="space-y-2">
                {[
                  { id: 'full', label: '전체 이름 표시 (예: 김하늘 작가님)' },
                  { id: 'masked', label: '중간 글자 마스킹 (예: 김*늘 작가님)' },
                  { id: 'numOnly', label: '번호만 표시 (예: 1번 학생 작가님)' }
                ].map((item) => (
                  <label
                    key={item.id}
                    onClick={() => handleUpdateNameDisplayMode(item.id as any)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      settings.studentNameDisplay === item.id ? 'bg-[#F0F7F4] border-[#5A8F7B] text-[#5A8F7B] font-bold' : 'bg-white border-[#EADDCA] text-[#4A443F]'
                    }`}
                  >
                    <span className="text-xs">{item.label}</span>
                    <input
                      type="radio"
                      name="nameDisplay"
                      checked={settings.studentNameDisplay === item.id}
                      onChange={() => {}}
                      className="text-[#5A8F7B]"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Change Admin Password */}
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-[#2D2A26]">관리자 비밀번호 변경</h3>

              <form onSubmit={handleChangeAdminPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">현재 관리자 비밀번호</label>
                  <input
                    type="password"
                    value={oldAdminPw}
                    onChange={(e) => setOldAdminPw(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">새 관리자 비밀번호</label>
                  <input
                    type="password"
                    value={newAdminPw}
                    onChange={(e) => setNewAdminPw(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">새 비밀번호 확인</label>
                  <input
                    type="password"
                    value={confirmAdminPw}
                    onChange={(e) => setConfirmAdminPw(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EADDCA] rounded-xl text-xs font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold shadow-xs transition-colors"
                >
                  비밀번호 변경하기
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Writing Process Viewer Modal */}
      {viewingProcessRecord && (
        <WritingProcessViewerModal
          isOpen={true}
          record={viewingProcessRecord}
          onClose={() => setViewingProcessRecord(null)}
          studentName={selectedStudent?.name}
        />
      )}
    </div>
  );
};

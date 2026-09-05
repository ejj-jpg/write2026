import React, { useState } from 'react';
import { X, Book, Sparkles, Printer, CheckCircle2, Bookmark, Heart } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import { WritingRecord, StudentBook, Student } from '../types';
import { triggerCelebration } from '../lib/gamification';

interface BookMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  submittedRecords: WritingRecord[];
  onBookCreated: (newBook: StudentBook) => void;
}

const COVER_THEMES = [
  { id: 'theme-warm', name: '따스한 햇살', bgClass: 'bg-[#F5EFE6] text-[#4A443F] border-[#EADDCA]' },
  { id: 'theme-forest', name: '초록 숲속', bgClass: 'bg-[#F0F7F4] text-[#2D2A26] border-[#D1E9DE]' },
  { id: 'theme-earth', name: '차분한 흙빛', bgClass: 'bg-[#FAF6F0] text-[#4A443F] border-[#EADDCA]' },
  { id: 'theme-sage', name: '은은한 쑥빛', bgClass: 'bg-[#EAF2ED] text-[#2D2A26] border-[#CDE0D5]' }
];

export const BookMakerModal: React.FC<BookMakerModalProps> = ({
  isOpen,
  onClose,
  student,
  submittedRecords,
  onBookCreated
}) => {
  const [bookTitle, setBookTitle] = useState<string>(`${student.name} 작가의 첫 번째 이야기 모음`);
  const [subtitle, setSubtitle] = useState<string>('생각과 마음이 쑥쑥 자라는 나만의 글 모음집');
  const [authorNote, setAuthorNote] = useState<string>('글을 한 편씩 쓰고 고쳐쓰며 나의 생각과 감정이 더 깊어졌습니다. 읽어주셔서 감사합니다.');
  const [selectedTheme, setSelectedTheme] = useState<string>('theme-warm');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>(() =>
    submittedRecords.map(r => r.recordId)
  );
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleSelectRecord = (id: string) => {
    if (selectedRecordIds.includes(id)) {
      setSelectedRecordIds(selectedRecordIds.filter(item => item !== id));
    } else {
      setSelectedRecordIds([...selectedRecordIds, id]);
    }
  };

  const handleSaveBook = async () => {
    if (!bookTitle.trim()) {
      alert('책 제목을 입력해주세요.');
      return;
    }
    if (selectedRecordIds.length === 0) {
      alert('책에 실을 글을 최소 1편 이상 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const bookId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newBook: StudentBook = {
        id: bookId,
        studentKey: student.studentKey,
        studentName: student.name,
        bookTitle: bookTitle.trim(),
        subtitle: subtitle.trim(),
        coverTheme: selectedTheme,
        authorNote: authorNote.trim(),
        selectedRecordIds,
        createdAt: Date.now()
      };

      const docRef = doc(db, COLLECTIONS.STUDENT_BOOKS, bookId);
      await setDoc(docRef, newBook);

      triggerCelebration('submit');
      onBookCreated(newBook);
      setMode('preview');
    } catch (err: any) {
      alert(`책 저장 중 오류: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedRecords = submittedRecords.filter(r => selectedRecordIds.includes(r.recordId));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2D2A26]/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#EADDCA] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#5A8F7B] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Book className="w-5 h-5 text-white/90" />
            <h3 className="font-black text-lg tracking-tight">나만의 글쓰기 책 만들기</h3>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'preview' && (
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-white text-[#2D2A26] hover:bg-[#F5EFE6] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4 text-[#5A8F7B]" />
                <span>인쇄 / PDF 저장</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#FDFBF7]">
          {mode === 'edit' ? (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">책 제목</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#EADDCA] rounded-xl text-sm font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">부제 (소제목)</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#EADDCA] rounded-xl text-sm font-semibold text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                  />
                </div>
              </div>

              {/* Cover Theme Picker */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-2">표지 색상 테마</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {COVER_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`p-3.5 rounded-2xl border-2 text-center text-xs font-bold transition-all ${
                        selectedTheme === theme.id
                          ? 'border-[#5A8F7B] shadow-xs scale-105'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      } ${theme.bgClass}`}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Author Note */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1">작가의 말 (머리말)</label>
                <textarea
                  rows={3}
                  value={authorNote}
                  onChange={(e) => setAuthorNote(e.target.value)}
                  className="w-full p-3 bg-white border border-[#EADDCA] rounded-xl text-xs font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                />
              </div>

              {/* Select Writings */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-2">
                  책에 실을 완성된 작품 선택 ({selectedRecordIds.length}편 선택됨)
                </label>
                {submittedRecords.length === 0 ? (
                  <div className="p-6 bg-white border border-dashed border-[#EADDCA] rounded-2xl text-center text-xs text-[#8C8379]">
                    아직 제출을 완료한 작품이 없습니다. 9단계까지 글을 완성한 뒤 책으로 엮어보세요!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {submittedRecords.map((rec) => {
                      const isSelected = selectedRecordIds.includes(rec.recordId);
                      return (
                        <div
                          key={rec.recordId}
                          onClick={() => toggleSelectRecord(rec.recordId)}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'border-[#5A8F7B] bg-[#F0F7F4]'
                              : 'border-[#EADDCA] bg-white hover:border-[#D1E9DE]'
                          }`}
                        >
                          <div>
                            <h4 className="font-extrabold text-xs text-[#2D2A26]">
                              {rec.planning?.title || rec.topicTitle}
                            </h4>
                            <span className="text-[11px] text-[#8C8379]">
                              {rec.planning?.genre} • {(rec.finalWriting || rec.draft).length}자
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#5A8F7B] text-white' : 'border border-[#EADDCA]'}`}>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-[#EADDCA] bg-white rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={saving || submittedRecords.length === 0}
                  onClick={handleSaveBook}
                  className="px-6 py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{saving ? '책 엮는 중...' : '책 완성 및 미리보기'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Printable Preview Mode */
            <div className="space-y-8 print:space-y-0" id="printable-book-section">
              <div className="flex justify-between items-center pb-3 border-b border-[#EADDCA] print:hidden">
                <button
                  onClick={() => setMode('edit')}
                  className="text-xs font-bold text-[#5A8F7B] hover:text-[#4D7D6B]"
                >
                  ← 설정 수정하기
                </button>
                <span className="text-xs text-[#8C8379]">
                  아래와 같이 멋지게 책으로 완성되었습니다! 인쇄하거나 PDF로 소장하세요.
                </span>
              </div>

              {/* Book Cover */}
              <div className={`p-10 rounded-3xl border-2 text-center max-w-lg mx-auto shadow-xs space-y-4 print:border-none print:shadow-none ${
                COVER_THEMES.find(t => t.id === selectedTheme)?.bgClass || 'bg-[#F5EFE6] text-[#4A443F] border-[#EADDCA]'
              }`}>
                <div className="py-8 space-y-3">
                  <span className="text-4xl">📖</span>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{bookTitle}</h1>
                  <p className="text-sm font-semibold opacity-90">{subtitle}</p>
                </div>
                <div className="pt-8 border-t border-black/10">
                  <p className="text-xs font-bold">지은이: {student.grade}학년 {student.classNum}반 {student.name} 작가</p>
                  <p className="text-[10px] opacity-75 mt-1">{new Date().toLocaleDateString('ko-KR')} 발행</p>
                </div>
              </div>

              {/* Author Note Page */}
              <div className="max-w-xl mx-auto p-8 bg-white border border-[#EADDCA] rounded-3xl shadow-xs space-y-3 print:border-none print:shadow-none">
                <h3 className="text-base font-extrabold text-[#2D2A26] border-b border-[#EADDCA] pb-2">작가의 말</h3>
                <p className="text-xs text-[#4A443F] leading-relaxed whitespace-pre-wrap">{authorNote}</p>
              </div>

              {/* Selected Stories */}
              <div className="space-y-8">
                {selectedRecords.map((rec, idx) => (
                  <div
                    key={rec.recordId}
                    className="max-w-xl mx-auto p-8 bg-white border border-[#EADDCA] rounded-3xl shadow-xs space-y-4 print:border-none print:shadow-none print:break-before-page"
                  >
                    <div className="border-b border-[#EADDCA] pb-3">
                      <span className="text-[11px] font-bold text-[#A67C52]">제 {idx + 1} 편</span>
                      <h2 className="text-xl font-extrabold text-[#2D2A26] mt-1">
                        {rec.planning?.title || rec.topicTitle}
                      </h2>
                    </div>

                    <div className="text-sm text-[#4A443F] leading-loose whitespace-pre-wrap font-['Pretendard']">
                      {rec.finalWriting || rec.afterProofreading || rec.revisedWriting || rec.draft}
                    </div>

                    <div className="pt-4 border-t border-[#EADDCA] flex justify-between text-[11px] text-[#8C8379]">
                      <span>{rec.planning?.genre}</span>
                      <span>작성일: {new Date(rec.updatedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

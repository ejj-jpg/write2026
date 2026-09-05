import React, { useState } from 'react';
import {
  Sparkles,
  PenTool,
  Clock,
  GitCompare,
  ChevronRight,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react';
import { Student, StudentGrowth, WritingRecord, StudentBook } from '../types';
import { formatStudentName } from '../lib/crypto';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';

interface StudentHomeProps {
  student: Student;
  growth: StudentGrowth;
  records: WritingRecord[];
  books: StudentBook[];
  nameDisplayMode: 'full' | 'masked' | 'numOnly';
  onStartNewWriting: () => void;
  onResumeWriting: (record: WritingRecord) => void;
  onViewProcess: (record: WritingRecord) => void;
  onOpenBookMaker: () => void;
  onGrowthUpdate: (growth: StudentGrowth) => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({
  student,
  growth,
  records,
  books,
  nameDisplayMode,
  onStartNewWriting,
  onResumeWriting,
  onViewProcess,
  onOpenBookMaker,
  onGrowthUpdate
}) => {
  // In-progress drafting records (anything not yet submitted)
  const inProgressRecords = records.filter(r => r.status !== 'submitted');
  const submittedRecords = records.filter(r => r.status === 'submitted');

  // Deletion modal state
  const [recordToDelete, setRecordToDelete] = useState<WritingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, COLLECTIONS.WRITING_RECORDS, recordToDelete.recordId));
      setRecordToDelete(null);
    } catch (err: any) {
      console.error('글 삭제 실패:', err);
      alert(`글을 삭제하지 못했습니다: ${err.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-8 animate-in fade-in">
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-[#5A8F7B] rounded-3xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-bold text-[#FDFBF7]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{student.year}학년도 {student.grade}학년 {student.classNum}반</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              안녕하세요, <span className="underline decoration-[#EADDCA] underline-offset-4">{formatStudentName(student.name, student.studentNum, nameDisplayMode)} 작가님</span>! 🌱
            </h1>
            <p className="text-xs sm:text-sm text-white/90 max-w-xl leading-relaxed">
              오늘도 나의 솔직한 생각과 풍부한 상상력을 글로 펼쳐볼까요?
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Fast Action Cards (새 그림책 쓰기 & 이어 쓰기) */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* 새 그림책 쓰기 */}
        <div
          id="btn-start-new-writing"
          onClick={onStartNewWriting}
          className="bg-white p-6 rounded-3xl border-2 border-[#5A8F7B]/30 hover:border-[#5A8F7B] shadow-sm hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-[#5A8F7B] flex items-center justify-center group-hover:scale-105 transition-transform">
                <PenTool className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#E2F0EA] text-[#5A8F7B] text-xs font-extrabold border border-[#D1E9DE]">
                그림책 만들기
              </span>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#2D2A26]">새 그림책 쓰기</h3>
              <p className="text-xs sm:text-sm text-[#8C8379] leading-relaxed mt-1">
                첫 문장과 6가지 이야기 요소(주인공, 목표, 방해, 도움, 해결, 결말)로 그림책(동화책)을 시작해요.
              </p>
            </div>
          </div>
          <div className="pt-5 flex items-center gap-1.5 text-sm font-extrabold text-[#5A8F7B]">
            <span>이야기 짓기 시작</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* 이어 쓰기 */}
        <div
          id="btn-resume-writing"
          onClick={() => inProgressRecords.length > 0 && onResumeWriting(inProgressRecords[0])}
          className={`p-6 rounded-3xl border-2 transition-all flex flex-col justify-between ${
            inProgressRecords.length > 0
              ? 'bg-white border-[#EADDCA] hover:border-[#A67C52] shadow-sm hover:shadow-md cursor-pointer group'
              : 'bg-[#FDFBF7] border-[#F2EDE4] opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#F5EFE6] text-[#A67C52] flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              {inProgressRecords.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-[#F5EFE6] text-[#A67C52] border border-[#EADDCA] text-xs font-extrabold">
                  {inProgressRecords.length}편 작성 중
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-[#2D2A26]">이어 쓰기</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#8C8379] leading-relaxed mt-1">
                {inProgressRecords.length > 0
                  ? `'${inProgressRecords[0].planning?.title || inProgressRecords[0].topicTitle || inProgressRecords[0].planning?.storyFramework?.firstSentence || '작성 중인 글'}' 이어서 작성하기 (${inProgressRecords[0].currentStep || 1}단계)`
                  : '현재 작성 중인 글이 없습니다.'}
              </p>
            </div>
          </div>
          <div className="pt-5 flex items-center gap-1.5 text-sm font-extrabold text-[#A67C52]">
            <span>{inProgressRecords.length > 0 ? '이어서 쓰기' : '작성 중인 글 없음'}</span>
            {inProgressRecords.length > 0 && <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* 3. Section: 작성 중인 글 & 완성한 글 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#2D2A26] tracking-tight">나의 글 모음</h2>
            <p className="text-xs text-[#8C8379]">
              작품을 클릭하여 전체 글쓰기 과정과 초고 대비 완성본 비교를 확인하세요.
            </p>
          </div>
          <span className="text-xs font-bold text-[#8C8379]">
            총 {records.length}편 (완성 {submittedRecords.length}편)
          </span>
        </div>

        {records.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-dashed border-[#EADDCA] text-center space-y-3">
            <PenTool className="w-10 h-10 text-[#A67C52] mx-auto" />
            <h4 className="font-extrabold text-sm text-[#2D2A26]">아직 작성한 글이 없습니다.</h4>
            <p className="text-xs text-[#8C8379]">
              상단의 [새 글 쓰기] 버튼을 눌러 첫 번째 이야기를 시작해보세요!
            </p>
            <button
              onClick={onStartNewWriting}
              className="px-4 py-2 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-bold shadow-xs"
            >
              첫 글 쓰러 가기
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((rec) => {
              const isSubmitted = rec.status === 'submitted';

              return (
                <div
                  key={rec.recordId}
                  className="bg-white p-5 rounded-3xl border border-[#EADDCA] hover:border-[#5A8F7B] shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        isSubmitted ? 'bg-[#F0F7F4] text-[#5A8F7B] border border-[#D1E9DE]' : 'bg-[#FFF4E5] text-[#D48806] border border-[#FFE7BA]'
                      }`}>
                        {isSubmitted ? '제출 완료' : `${rec.currentStep}단계 작성 중`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#8C8379] font-medium">
                          {new Date(rec.updatedAt).toLocaleDateString('ko-KR')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecordToDelete(rec);
                          }}
                          className="p-1 text-[#8C8379] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="글 삭제하기"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-sm text-[#2D2A26] line-clamp-1">
                      {rec.planning?.title || rec.topicTitle || '제목 없는 글'}
                    </h3>

                    <p className="text-xs text-[#4A443F] line-clamp-2 leading-relaxed">
                      {rec.finalWriting || rec.revisedWriting || rec.draft || '아직 글 내용이 작성되지 않았습니다.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#F2EDE4] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#8C8379]">
                      <span>{rec.planning?.genre}</span>
                      <span>{(rec.finalWriting || rec.draft).length}자</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onViewProcess(rec)}
                        className="py-1.5 px-2 bg-[#F5EFE6] hover:bg-[#EADDCA] text-[#4A443F] rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                      >
                        <GitCompare className="w-3 h-3 text-[#A67C52]" />
                        <span>과정 보기</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onResumeWriting(rec)}
                        className="py-1.5 px-2 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                      >
                        <PenTool className="w-3 h-3" />
                        <span>{isSubmitted ? '다시 보기' : '이어 쓰기'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecordToDelete(rec);
                        }}
                        className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        title="글 삭제하기"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 글 삭제 확인 모달 */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2A26]/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-[#EADDCA] p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-[#2D2A26]">
                글을 삭제하시겠습니까?
              </h3>
              <p className="text-xs text-[#8C8379] leading-relaxed">
                <span className="font-bold text-[#2D2A26]">
                  '{recordToDelete.planning?.title || recordToDelete.topicTitle || '제목 없는 글'}'
                </span>
                <br />
                삭제된 글은 다시 복구할 수 없습니다.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2.5 bg-[#F5EFE6] hover:bg-[#EADDCA] text-[#4A443F] rounded-xl text-xs font-extrabold transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>삭제 중...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제하기</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Section: 내가 만든 책장 */}
      {books.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#EADDCA]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#2D2A26] tracking-tight">나의 책장</h2>
              <p className="text-xs text-[#8C8379]">내가 직접 엮고 출판한 소중한 이야기책들</p>
            </div>
            <button
              onClick={onOpenBookMaker}
              className="text-xs font-bold text-[#5A8F7B] hover:text-[#4D7D6B] flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 책 만들기</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((b) => (
              <div
                key={b.id}
                onClick={onOpenBookMaker}
                className="p-5 rounded-3xl border border-[#EADDCA] bg-[#FDFBF7] hover:bg-white hover:border-[#5A8F7B] shadow-sm hover:shadow-md cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📖</span>
                  <span className="text-[10px] text-[#8C8379]">{new Date(b.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                <h3 className="font-black text-sm text-[#2D2A26]">{b.bookTitle}</h3>
                {b.subtitle && <p className="text-xs text-[#8C8379] line-clamp-1">{b.subtitle}</p>}
                <div className="pt-2 text-[11px] font-bold text-[#5A8F7B]">
                  수록 작품: {b.selectedRecordIds.length}편
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { X, BookOpen, GitCompare, Sparkles, CheckCircle2, Star, Calendar, User } from 'lucide-react';
import { WritingRecord } from '../types';

interface WritingProcessViewerModalProps {
  record: WritingRecord;
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export const WritingProcessViewerModal: React.FC<WritingProcessViewerModalProps> = ({
  record,
  isOpen,
  onClose,
  studentName
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'compare'>('timeline');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2D2A26]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] rounded-3xl shadow-2xl border border-[#EADDCA] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#5A8F7B] p-5 sm:p-6 text-white flex items-center justify-between shrink-0 border-b border-[#4D7D6B]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs">
                {record.status === 'submitted' ? '제출 완료' : '작성 중'}
              </span>
              {studentName && (
                <span className="text-xs font-semibold text-[#E2F0EA] flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {studentName} 작가
                </span>
              )}
            </div>
            <h3 className="text-xl font-black tracking-tight">{record.planning?.title || record.topicTitle}</h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex bg-black/15 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'timeline' ? 'bg-white text-[#2D2A26] shadow-xs' : 'text-white/80 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>글쓰기 전체 과정</span>
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'compare' ? 'bg-white text-[#2D2A26] shadow-xs' : 'text-white/80 hover:text-white'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>초고 vs 최종 글 비교</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'timeline' ? (
            <div className="space-y-6">
              {/* Step 1: 주제 */}
              <div className="border-l-4 border-[#A67C52] pl-4 space-y-1">
                <span className="text-xs font-black text-[#A67C52] tracking-wider">STEP 1. 글쓰기 주제</span>
                <h4 className="text-base font-extrabold text-[#2D2A26]">{record.topicTitle}</h4>
              </div>

              {/* Step 2: 계획 */}
              <div className="border-l-4 border-[#5A8F7B] pl-4 space-y-2">
                <span className="text-xs font-black text-[#5A8F7B] tracking-wider">STEP 2. 글쓰기 계획</span>
                <div className="bg-[#F0F7F4] p-4 rounded-2xl border border-[#D1E9DE] text-xs space-y-2">
                  <div className="flex flex-wrap gap-4 text-[#4A443F] font-medium">
                    <span><strong className="text-[#2D2A26]">제목:</strong> {record.planning?.title || '미정'}</span>
                    <span><strong className="text-[#2D2A26]">종류:</strong> {record.planning?.genre || '생활문'}</span>
                    <span><strong className="text-[#2D2A26]">목적:</strong> {record.planning?.purpose}</span>
                    <span><strong className="text-[#2D2A26]">예상 독자:</strong> {record.planning?.audience}</span>
                  </div>
                  {record.planning?.ideas?.length > 0 && (
                    <div className="pt-1">
                      <strong className="text-[#2D2A26]">아이디어 키워드: </strong>
                      <span className="text-[#4A443F]">{record.planning.ideas.join(', ')}</span>
                    </div>
                  )}
                  {record.planning?.outline && (
                    <div className="pt-2">
                      {record.planning.outline.exposition || record.planning.outline.development || record.planning.outline.climax || record.planning.outline.resolution ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#A67C52] block mb-1">1. 발단</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.exposition || record.planning.outline.beginning || '-'}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#5A8F7B] block mb-1">2. 전개</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.development || '-'}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#C05621] block mb-1">3. 절정</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.climax || record.planning.outline.middle || '-'}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#2B6CB0] block mb-1">4. 결말</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.resolution || record.planning.outline.ending || '-'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-3 gap-2">
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#5A8F7B] block mb-1">처음</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.beginning || '-'}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#5A8F7B] block mb-1">가운데</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.middle || '-'}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#EADDCA]">
                            <strong className="text-[#5A8F7B] block mb-1">끝</strong>
                            <p className="text-[#4A443F] whitespace-pre-wrap">{record.planning.outline.ending || '-'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: 초고 */}
              <div className="border-l-4 border-[#8C8379] pl-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#4A443F] tracking-wider">STEP 3. 작성한 초고</span>
                  <span className="text-xs text-[#8C8379]">({record.draft?.length || 0}자)</span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-[#EADDCA] text-sm text-[#4A443F] leading-relaxed whitespace-pre-wrap">
                  {record.draft || '작성된 초고가 없습니다.'}
                </div>
              </div>

              {/* Step 4: AI 피드백 */}
              {record.aiFeedback && (
                <div className="border-l-4 border-[#A67C52] pl-4 space-y-2">
                  <span className="text-xs font-black text-[#A67C52] tracking-wider">STEP 4. AI 맞춤 피드백</span>
                  <div className="p-4 bg-[#F5EFE6] rounded-2xl border border-[#EADDCA] space-y-3 text-xs">
                    {record.aiFeedback.topPriority && (
                      <div className="p-2.5 bg-white rounded-xl text-[#A67C52] font-bold border border-[#EADDCA]">
                        🎯 우선 과제: {record.aiFeedback.topPriority}
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <strong className="text-[#5A8F7B] block mb-1">잘된 점:</strong>
                        <ul className="list-disc list-inside space-y-1 text-[#4A443F]">
                          {record.aiFeedback.strengths?.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong className="text-[#A67C52] block mb-1">보완할 점:</strong>
                        <ul className="list-disc list-inside space-y-1 text-[#4A443F]">
                          {record.aiFeedback.improvements?.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {record.aiFeedback.reasoning && (
                      <p className="text-[#8C8379] pt-1 border-t border-[#EADDCA]">
                        {record.aiFeedback.reasoning}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5 & 6: 수정 목표 & 고쳐쓰기 */}
              <div className="border-l-4 border-[#5A8F7B] pl-4 space-y-2">
                <span className="text-xs font-black text-[#5A8F7B] tracking-wider">STEP 5 & 6. 수정 목표 및 고쳐쓴 글</span>
                {record.revisionGoal && (
                  <div className="p-3 bg-[#F0F7F4] rounded-xl border border-[#D1E9DE] text-xs text-[#5A8F7B] font-medium">
                    🎯 학생의 수정 목표: {record.revisionGoal}
                  </div>
                )}
                <div className="p-4 bg-white rounded-2xl border border-[#EADDCA] text-sm text-[#4A443F] leading-relaxed whitespace-pre-wrap">
                  {record.revisedWriting || '고쳐쓴 글이 없습니다.'}
                </div>
              </div>

              {/* Step 7: 자기평가 */}
              {record.selfAssessment && (
                <div className="border-l-4 border-[#A67C52] pl-4 space-y-2">
                  <span className="text-xs font-black text-[#A67C52] tracking-wider">STEP 7. 자기평가</span>
                  <div className="p-4 bg-[#F5EFE6] rounded-2xl border border-[#EADDCA] text-xs space-y-2">
                    <div className="flex flex-wrap gap-4 text-[#4A443F] font-semibold">
                      <span>내용 생생함: ⭐ {record.selfAssessment.rubric1Score}점</span>
                      <span>문장 흐름: ⭐ {record.selfAssessment.rubric2Score}점</span>
                      <span>목표 달성도: ⭐ {record.selfAssessment.rubric3Score}점</span>
                    </div>
                    {record.selfAssessment.selfThoughts && (
                      <p className="text-[#8C8379] pt-1 border-t border-[#EADDCA]">
                        "{record.selfAssessment.selfThoughts}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 8 & 9: 최종 완성 글 */}
              <div className="border-l-4 border-[#5A8F7B] pl-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#5A8F7B] tracking-wider">STEP 8 & 9. 최종 완성본</span>
                  <span className="text-xs text-[#5A8F7B] font-bold">
                    ({(record.finalWriting || record.draft).length}자)
                  </span>
                </div>
                <div className="p-5 bg-white rounded-3xl border-2 border-[#5A8F7B] text-sm text-[#2D2A26] leading-relaxed whitespace-pre-wrap font-['Pretendard']">
                  {record.finalWriting || record.afterProofreading || record.revisedWriting || record.draft}
                </div>
              </div>
            </div>
          ) : (
            /* Tab: Compare Draft vs Final */
            <div className="space-y-6">
              <div className="bg-[#F0F7F4] border border-[#D1E9DE] p-4 rounded-2xl text-xs text-[#5A8F7B] leading-relaxed flex items-center justify-between">
                <div>
                  <strong className="text-[#2D2A26]">초고에서 최종 완성본까지의 변화</strong>:
                  초고({record.draft?.length || 0}자) ➔ 최종 완성본({(record.finalWriting || record.draft).length}자)
                </div>
                {record.revisionGoal && (
                  <span className="bg-white px-2.5 py-1 rounded-lg text-[#5A8F7B] font-bold border border-[#D1E9DE]">
                    반영 목표: {record.revisionGoal.slice(0, 25)}...
                  </span>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Draft Side */}
                <div className="border border-[#EADDCA] rounded-3xl p-5 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-[#EADDCA] pb-2">
                    <span className="text-xs font-black text-[#8C8379]">처음 작성한 초고 (Draft)</span>
                    <span className="text-[11px] text-[#8C8379] font-bold">{record.draft?.length || 0}자</span>
                  </div>
                  <div className="text-sm text-[#4A443F] leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto">
                    {record.draft || '초고가 없습니다.'}
                  </div>
                </div>

                {/* Final Side */}
                <div className="border-2 border-[#5A8F7B] rounded-3xl p-5 bg-[#F0F7F4]/30 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#D1E9DE] pb-2">
                    <span className="text-xs font-black text-[#5A8F7B]">다듬어진 최종 완성본 (Final)</span>
                    <span className="text-[11px] text-[#5A8F7B] font-bold">
                      {(record.finalWriting || record.draft).length}자
                    </span>
                  </div>
                  <div className="text-sm text-[#2D2A26] leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto font-medium">
                    {record.finalWriting || record.afterProofreading || record.revisedWriting || record.draft}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

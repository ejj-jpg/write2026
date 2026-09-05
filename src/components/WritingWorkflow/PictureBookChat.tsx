import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Wand2,
  RefreshCw,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  User,
  Heart,
  AlertTriangle,
  HelpCircle,
  Award,
  ChevronRight,
  Edit2
} from 'lucide-react';
import { StoryFramework, StoryIdeaSuggestion, Student } from '../../types';
import { requestStoryIdeas } from '../../lib/aiService';

interface PictureBookChatProps {
  student: Student;
  topicTitle?: string;
  initialFramework?: StoryFramework;
  onFrameworkUpdate: (framework: StoryFramework) => void;
  onProceedToNextStep: () => void;
}

type StageKey = 'firstSentence' | 'character' | 'goal' | 'obstacle' | 'helper' | 'resolution' | 'ending';

interface StageMeta {
  key: StageKey;
  stepNum: string;
  title: string;
  badge: string;
  botPrompt: string;
  placeholder: string;
  icon: string;
  color: string;
}

const STAGES: StageMeta[] = [
  {
    key: 'firstSentence',
    stepNum: '첫 문장',
    title: '이야기를 여는 첫 문장',
    badge: '첫 문장',
    botPrompt: '반가워요, 작가님! 📖\n세상에 하나뿐인 멋진 그림책(동화책)을 만들기 위해 이야기 씨앗을 심어볼까요?\n먼저 책을 펼쳤을 때 독자의 호기심을 사로잡을 **첫 문장**을 적어보세요!',
    placeholder: '예: 비가 쏟아지던 화요일 오후, 낡은 서랍 속에서 이상한 소리가 났다.',
    icon: '✨',
    color: '#5A8F7B'
  },
  {
    key: 'character',
    stepNum: '1단계',
    title: '주인공',
    badge: '1. 주인공',
    botPrompt: '정말 흥미진진한 시작이에요! ✨\n그렇다면 이 이야기의 중심에 설 **1. 주인공**은 누구인가요? 이름이나 생김새, 특별한 성격을 소개해 주세요.',
    placeholder: '예: 밤하늘 별빛을 모으는 호기심 많은 아기 다람쥐 "도토리"',
    icon: '🐿️',
    color: '#A67C52'
  },
  {
    key: 'goal',
    stepNum: '2단계',
    title: '하고 싶은 일 (목표)',
    badge: '2. 하고 싶은 일',
    botPrompt: '주인공이 정말 매력적이에요! 🎯\n우리 주인공이 이번 모험에서 꼭 **2. 하고 싶은 일(간절한 소망이나 목표)**은 무엇인가요?',
    placeholder: '예: 떨어진 은하수 조각을 찾아 밤하늘을 다시 반짝이게 되돌려놓고 싶어요.',
    icon: '🌟',
    color: '#D48806'
  },
  {
    key: 'obstacle',
    stepNum: '3단계',
    title: '주인공을 방해하는 것 (시련/갈등)',
    badge: '3. 주인공을 방해하는 것',
    botPrompt: '이야기에 긴장감이 더해지려면 시련이 필요해요! 🌪️\n주인공의 앞을 가로막거나 **3. 주인공을 방해하는 것(장애물, 악당, 무서운 자연환경 등)**은 무엇인가요?',
    placeholder: '예: 길을 꽁꽁 얼리고 소용돌이바람을 일으키는 심술쟁이 먹구름 괴물',
    icon: '⚡',
    color: '#C05621'
  },
  {
    key: 'helper',
    stepNum: '4단계',
    title: '주인공을 돕는 것 (조력자/도구)',
    badge: '4. 주인공을 돕는 것',
    botPrompt: '어려움에 빠진 주인공에게 구원투수가 등장할 차례예요! 🤝\n주인공에게 용기를 주거나 **4. 주인공을 돕는 것(친구, 힌트, 신비한 마법 도구, 지혜)**은 무엇인가요?',
    placeholder: '예: 어두운 밤길을 따스하게 비춰주는 길잡이 반딧불이 친구 "루미"',
    icon: '🪄',
    color: '#4D7D6B'
  },
  {
    key: 'resolution',
    stepNum: '5단계',
    title: '해결과정 (위기 극복)',
    badge: '5. 해결과정',
    botPrompt: '가장 손에 땀을 쥐게 하는 클라이맥스예요! 🔥\n주인공이 지혜와 용기를 모아 어려움을 어떻게 극복하나요? **5. 해결과정**을 들려주세요.',
    placeholder: '예: 친구와 손을 맞잡고 마음속 용기의 빛을 쏘아 먹구름을 따뜻하게 녹였어요.',
    icon: '🌈',
    color: '#2B6CB0'
  },
  {
    key: 'ending',
    stepNum: '6단계',
    title: '결말 (마무리와 감동)',
    badge: '6. 결말',
    botPrompt: '드디어 그림책의 마지막 장이에요! 🏆\n모든 모험이 끝나고 어떤 따뜻하거나 놀라운 **6. 결말**을 맞이하나요? 주인공은 어떤 마음이 되었나요?',
    placeholder: '예: 온 마을에 다시 별빛이 쏟아지고, 주인공의 가슴속에 커다란 용기가 자라났어요.',
    icon: '🎉',
    color: '#5A8F7B'
  }
];

export const PictureBookChat: React.FC<PictureBookChatProps> = ({
  student,
  topicTitle,
  initialFramework,
  onFrameworkUpdate,
  onProceedToNextStep
}) => {
  const [framework, setFramework] = useState<StoryFramework>(() => {
    return (
      initialFramework || {
        firstSentence: '',
        character: '',
        goal: '',
        obstacle: '',
        helper: '',
        resolution: '',
        ending: ''
      }
    );
  });

  // Calculate current active stage based on what is filled
  const determineInitialStage = (): number => {
    if (!initialFramework?.firstSentence) return 0;
    if (!initialFramework?.character) return 1;
    if (!initialFramework?.goal) return 2;
    if (!initialFramework?.obstacle) return 3;
    if (!initialFramework?.helper) return 4;
    if (!initialFramework?.resolution) return 5;
    if (!initialFramework?.ending) return 6;
    return 6; // all completed
  };

  const [currentStageIdx, setCurrentStageIdx] = useState<number>(determineInitialStage);
  const [inputText, setInputText] = useState<string>('');

  // AI Idea state
  const [ideas, setIdeas] = useState<StoryIdeaSuggestion[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState<boolean>(false);
  const [showIdeaPicker, setShowIdeaPicker] = useState<boolean>(false);

  const currentStage = STAGES[currentStageIdx];
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with input field when switching stages
  useEffect(() => {
    const existingVal = framework[currentStage.key] || '';
    setInputText(existingVal);
    setShowIdeaPicker(false);
    setIdeas([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStageIdx]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentStageIdx, showIdeaPicker, ideas]);

  // Stage switcher that commits any ongoing input
  const handleStageSelect = (targetIdx: number) => {
    if (targetIdx === currentStageIdx) return;
    if (inputText.trim()) {
      const updated: StoryFramework = {
        ...framework,
        [currentStage.key]: inputText.trim()
      };
      setFramework(updated);
      onFrameworkUpdate(updated);
    }
    setCurrentStageIdx(targetIdx);
  };

  // Request 3 AI Ideas for the current stage (anchored strongly to student's first sentence)
  const handleRequestIdeas = async () => {
    setLoadingIdeas(true);
    setShowIdeaPicker(true);
    try {
      // Merge current input to guarantee the newest content (especially firstSentence) is passed
      const currentContext: StoryFramework = {
        ...framework,
        ...(inputText.trim() ? { [currentStage.key]: inputText.trim() } : {})
      };

      // Also ensure internal framework state has the latest firstSentence if currently at firstSentence stage
      if (currentStage.key === 'firstSentence' && inputText.trim()) {
        setFramework(currentContext);
        onFrameworkUpdate(currentContext);
      }

      const generated = await requestStoryIdeas(currentStage.key, currentContext, student.grade, topicTitle);
      setIdeas(generated);
    } catch (err) {
      console.warn('AI idea error:', err);
    } finally {
      setLoadingIdeas(false);
    }
  };

  // When a student selects an idea suggestion
  const handleSelectIdea = (idea: StoryIdeaSuggestion) => {
    setInputText(idea.preview);
    setShowIdeaPicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Submit current stage answer
  const handleSubmitAnswer = (textToSave?: string) => {
    const content = (textToSave !== undefined ? textToSave : inputText).trim();
    if (!content) return;

    const updatedFramework: StoryFramework = {
      ...framework,
      [currentStage.key]: content,
      completedAt: currentStageIdx === 6 ? Date.now() : framework.completedAt
    };

    setFramework(updatedFramework);
    onFrameworkUpdate(updatedFramework);

    // Proceed to next stage if available
    if (currentStageIdx < STAGES.length - 1) {
      setCurrentStageIdx(currentStageIdx + 1);
    }
  };

  // Check how many items are filled
  const filledCount = STAGES.filter((s) => !!framework[s.key]?.trim()).length;
  const isAllCompleted = filledCount === STAGES.length;

  return (
    <div className="space-y-6">
      {/* Top Banner: Picture book introduction */}
      <div className="bg-[#F0F7F4] border border-[#D1E9DE] rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#5A8F7B] text-white text-[11px] font-bold">
              그림책 이야기 만들기
            </span>
            <span className="text-xs font-semibold text-[#5A8F7B]">
              {filledCount} / {STAGES.length} 단계 완성
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#2D2A26]">
            첫 문장과 6가지 핵심 요소로 그림책(동화책) 뼈대 잡기
          </h3>
          <p className="text-xs text-[#4A443F] leading-relaxed">
            나만의 첫 문장을 쓰고, 질문에 답하며 주인공, 목표, 시련, 도움, 해결, 결말을 완성해보세요.
            아이디어가 떠오르지 않을 땐 언제든 <strong>제미나이 3가지 추천</strong>을 받을 수 있어요!
          </p>
        </div>

        {isAllCompleted && (
          <button
            onClick={onProceedToNextStep}
            className="shrink-0 px-5 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>다음 단계(계획/초고)로 이동</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stage Stepper Tabs */}
      <div className="overflow-x-auto scrollbar-none pb-1">
        <div className="flex items-center gap-1.5 min-w-[700px]">
          {STAGES.map((s, idx) => {
            const isDone = !!framework[s.key]?.trim();
            const isCurrent = currentStageIdx === idx;

            return (
              <button
                key={s.key}
                onClick={() => handleStageSelect(idx)}
                className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  isCurrent
                    ? 'bg-[#5A8F7B] text-white border-[#5A8F7B] shadow-xs'
                    : isDone
                    ? 'bg-white text-[#5A8F7B] border-[#D1E9DE] hover:bg-[#F0F7F4]'
                    : 'bg-[#FDFBF7] text-[#8C8379] border-[#EADDCA] hover:bg-white'
                }`}
              >
                <span>{s.icon}</span>
                <span className="whitespace-nowrap">{s.badge}</span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-inherit shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Interactive Chat Window + Live Story Blueprint */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Conversational Chat Interface (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#EADDCA] shadow-sm flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="bg-[#FAF7F2] px-5 py-4 border-b border-[#EADDCA] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#5A8F7B] text-white flex items-center justify-center text-base shadow-xs">
                📖
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#2D2A26] flex items-center gap-1.5">
                  <span>그림책 이야기 요정</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#E2F0EA] text-[#5A8F7B] text-[10px] font-bold">
                    실시간 대화 가이드
                  </span>
                </h4>
                <p className="text-[11px] text-[#8C8379]">현재: {currentStage.badge} - {currentStage.title}</p>
              </div>
            </div>

            <button
              onClick={handleRequestIdeas}
              disabled={loadingIdeas}
              className="px-3 py-1.5 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#A67C52] border border-[#EADDCA] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D48806]" />
              <span>{loadingIdeas ? '생각 중...' : '💡 제미나이 3가지 아이디어'}</span>
            </button>
          </div>

          {/* Chat History Flow */}
          <div className="p-5 space-y-5 max-h-[480px] overflow-y-auto bg-[#FDFBF7]">
            {/* Completed Stages Summaries in Chat */}
            {STAGES.slice(0, currentStageIdx).map((stage, idx) => {
              const answer = framework[stage.key];
              if (!answer) return null;

              return (
                <div key={stage.key} className="space-y-2 animate-in fade-in">
                  {/* Bot prompt snippet */}
                  <div className="flex items-start gap-2.5 max-w-[85%]">
                    <div className="w-7 h-7 rounded-full bg-[#5A8F7B] text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                      📖
                    </div>
                    <div className="bg-white p-3 rounded-2xl rounded-tl-xs border border-[#EADDCA] text-xs text-[#4A443F] shadow-2xs">
                      <span className="font-extrabold text-[#5A8F7B] block mb-0.5">
                        {stage.badge}
                      </span>
                      {stage.title}를 어떻게 정했나요?
                    </div>
                  </div>

                  {/* Student Answer */}
                  <div className="flex items-start gap-2.5 max-w-[85%] ml-auto justify-end">
                    <div className="bg-[#5A8F7B] text-white p-3 rounded-2xl rounded-tr-xs text-xs font-medium shadow-2xs leading-relaxed group relative">
                      <div className="flex items-center justify-between gap-2 mb-1 border-b border-white/20 pb-1">
                        <span className="text-[10px] font-bold text-white/80">{student.name} 작가</span>
                        <button
                          onClick={() => handleStageSelect(idx)}
                          className="text-[10px] text-white/80 hover:text-white underline flex items-center gap-0.5"
                          title="이 단계 수정하기"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                          <span>수정</span>
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap">{answer}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#2D2A26] text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                      ✏️
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Current Active Bot Prompt */}
            <div className="flex items-start gap-2.5 max-w-[90%] animate-in fade-in">
              <div className="w-8 h-8 rounded-2xl bg-[#5A8F7B] text-white flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-2xs">
                📖
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-xs border-2 border-[#5A8F7B]/40 text-xs text-[#2D2A26] shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#F0F7F4] text-[#5A8F7B] font-extrabold text-[11px] border border-[#D1E9DE]">
                    {currentStage.badge}
                  </span>
                  <span className="font-bold text-[#A67C52]">{currentStage.title}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap font-medium">
                  {currentStage.botPrompt}
                </p>
              </div>
            </div>

            {/* Gemini 3-Idea Suggestions Box (When opened) */}
            {showIdeaPicker && (
              <div className="p-4 bg-[#FFF9F2] rounded-2xl border-2 border-[#A67C52]/40 space-y-3 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#A67C52] text-white flex items-center justify-center text-xs">
                      ✨
                    </span>
                    <span className="text-xs font-extrabold text-[#2D2A26]">
                      제미나이가 추천하는 [{currentStage.badge}] 아이디어 3가지
                    </span>
                  </div>
                  <button
                    onClick={handleRequestIdeas}
                    disabled={loadingIdeas}
                    className="text-[11px] font-bold text-[#A67C52] hover:text-[#2D2A26] flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingIdeas ? 'animate-spin' : ''}`} />
                    <span>다시 추천받기</span>
                  </button>
                </div>

                {/* Show active first-sentence reflection when in subsequent stages */}
                {currentStage.key !== 'firstSentence' && (
                  framework.firstSentence?.trim() ? (
                    <div className="px-3.5 py-2.5 bg-[#E2F0EA] border border-[#C2E4D5] rounded-xl flex items-center gap-2 text-xs text-[#2D2A26]">
                      <span className="font-extrabold text-[#5A8F7B] shrink-0">🎯 내 첫 문장 중심 맞춤:</span>
                      <span className="truncate italic font-medium text-[#4A443F]">
                        "{framework.firstSentence}"
                      </span>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2.5 bg-[#FFF4E6] border border-[#FED7AA] rounded-xl flex items-center justify-between text-xs text-[#2D2A26] gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[#C05621] shrink-0">💡 팁:</span>
                        <span className="text-[#7C2D12] font-medium text-[11px]">
                          첫 문장을 먼저 쓰면, 그 첫 문장의 세계관과 인물에 꼭 맞춘 아이디어가 추천돼요!
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStageSelect(0)}
                        className="px-2.5 py-1 bg-[#C05621] hover:bg-[#9C4215] text-white text-[10px] font-bold rounded-lg shrink-0 transition-colors"
                      >
                        첫 문장 쓰러 가기
                      </button>
                    </div>
                  )
                )}

                {loadingIdeas ? (
                  <div className="py-6 text-center text-xs text-[#8C8379] space-y-2">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5A8F7B]" />
                    <p>학생의 첫 문장과 이야기 흐름에 꼭 맞춘 독창적인 아이디어를 고민 중이에요...</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    {ideas.map((idea, i) => (
                      <div
                        key={idea.id || i}
                        onClick={() => handleSelectIdea(idea)}
                        className="bg-white p-3.5 rounded-2xl border-2 border-[#EADDCA] hover:border-[#5A8F7B] hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group text-left"
                      >
                        <div className="space-y-1.5 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-[#5A8F7B]">
                              아이디어 {i + 1}
                            </span>
                            <span className="text-[10px] font-bold text-[#A67C52] bg-[#FDF8F3] px-2 py-0.5 rounded-md border border-[#F2EDE4]">
                              {idea.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B635B] leading-relaxed line-clamp-2">
                            {idea.description}
                          </p>
                          {idea.preview && (
                            <div className="p-2 bg-[#F8F5F0] rounded-xl border border-[#EADDCA] text-[11px] text-[#2D2A26] font-medium leading-relaxed italic">
                              "{idea.preview}"
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-[#F2EDE4] flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#A67C52] group-hover:text-[#5A8F7B] transition-colors">
                            이 아이디어 선택
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#8C8379] group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-white border-t border-[#EADDCA] space-y-3">
            {/* Quick helper buttons */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8C8379] font-medium">
                💡 생각이 잘 안 나면 제미나이의 예시를 참고해보세요.
              </span>
              <button
                type="button"
                onClick={handleRequestIdeas}
                disabled={loadingIdeas}
                className="text-[11px] font-bold text-[#5A8F7B] hover:underline flex items-center gap-1"
              >
                <Wand2 className="w-3 h-3" />
                <span>아이디어 3개 추천받기</span>
              </button>
            </div>

            {/* Input Form */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={currentStage.placeholder}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
                className="flex-1 px-4 py-3 border-2 border-[#EADDCA] focus:border-[#5A8F7B] rounded-2xl text-xs sm:text-sm font-semibold text-[#2D2A26] placeholder:text-[#B5ACA1] focus:outline-none bg-[#FDFBF7]"
              />
              <button
                type="button"
                disabled={!inputText.trim()}
                onClick={() => handleSubmitAnswer()}
                className="px-5 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] disabled:opacity-40 text-white rounded-2xl font-extrabold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>{currentStageIdx === STAGES.length - 1 ? '완성하기' : '다음으로'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Picture Book Story Blueprint Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EADDCA] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#5A8F7B]" />
                <h4 className="font-extrabold text-sm text-[#2D2A26]">
                  나의 그림책 이야기 설계도
                </h4>
              </div>
              <span className="text-xs font-bold text-[#A67C52]">
                {filledCount} / {STAGES.length}
              </span>
            </div>

            {/* Blueprint Items */}
            <div className="space-y-3 text-xs">
              {STAGES.map((s, idx) => {
                const value = framework[s.key];
                const isSelected = currentStageIdx === idx;

                return (
                  <div
                    key={s.key}
                    onClick={() => handleStageSelect(idx)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#5A8F7B] bg-[#F0F7F4] shadow-xs'
                        : value
                        ? 'border-[#EADDCA] bg-white hover:border-[#5A8F7B]'
                        : 'border-[#F2EDE4] bg-[#FDFBF7] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span>{s.icon}</span>
                        <span className="font-extrabold text-[#2D2A26]">{s.badge}</span>
                      </div>
                      {value ? (
                        <span className="text-[10px] font-bold text-[#5A8F7B] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          작성됨
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8C8379]">미작성</span>
                      )}
                    </div>
                    <p className={`text-[11px] leading-relaxed ${value ? 'text-[#4A443F] font-medium' : 'text-[#8C8379] italic'}`}>
                      {value || s.placeholder}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Bottom Proceed Action */}
            {isAllCompleted && (
              <div className="pt-2 border-t border-[#F2EDE4] space-y-2 animate-in fade-in">
                <div className="p-3 bg-[#F0F7F4] rounded-xl border border-[#D1E9DE] text-xs text-[#5A8F7B] font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#5A8F7B] shrink-0" />
                  <span>축하합니다! 7가지 이야기 뼈대가 모두 완성되었어요! 🎉</span>
                </div>
                <button
                  onClick={onProceedToNextStep}
                  className="w-full py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <span>이 뼈대로 2단계 계획서 확인하기</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

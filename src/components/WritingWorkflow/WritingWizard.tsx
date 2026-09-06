import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Wand2,
  HelpCircle,
  Star,
  CheckCheck,
  Award,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import {
  Student,
  WritingRecord,
  DailyTopic,
  StudentGrowth,
  ProofreadSuggestion,
  StoryFramework
} from '../../types';
import { PictureBookChat } from './PictureBookChat';
import {
  requestAITopics,
  requestDraftFeedback,
  requestProofreading,
  requestOutlineExamples,
  PRESET_TOPICS
} from '../../lib/aiService';
import { saveDraftToLocal } from '../../lib/storageFallback';
import {
  calculateLevel,
  checkNewBadges,
  triggerCelebration
} from '../../lib/gamification';

interface WritingWizardProps {
  student: Student;
  studentGrowth?: StudentGrowth | null;
  initialRecord?: WritingRecord | null;
  existingRecord?: WritingRecord | null;
  onClose: () => void;
  onGrowthUpdate?: (newGrowth: StudentGrowth) => void;
  onCompleteSubmission?: (record: WritingRecord) => void;
}

const STEPS = [
  { step: 1, title: '첫 문장 & 이야기 씨앗', icon: '📖' },
  { step: 2, title: '그림책 계획하기', icon: '📋' },
  { step: 3, title: '초고 쓰기', icon: '✏️' },
  { step: 4, title: 'AI 피드백', icon: '🤖' },
  { step: 5, title: '수정 목표', icon: '🎯' },
  { step: 6, title: '고쳐쓰기', icon: '🪄' },
  { step: 7, title: '자기평가', icon: '⭐' },
  { step: 8, title: '맞춤법 점검', icon: '🔍' },
  { step: 9, title: '최종 제출', icon: '🏆' }
];

export const WritingWizard: React.FC<WritingWizardProps> = ({
  student,
  studentGrowth,
  initialRecord,
  existingRecord,
  onClose,
  onGrowthUpdate,
  onCompleteSubmission
}) => {
  const activeInitial = initialRecord || existingRecord;

  // Record State
  const [record, setRecord] = useState<WritingRecord>(() => {
    if (activeInitial) {
      return {
        ...activeInitial,
        currentStep: activeInitial.currentStep ? Math.min(9, Math.max(1, activeInitial.currentStep)) : 1,
        planning: {
          title: activeInitial.planning?.title || '',
          genre: activeInitial.planning?.genre || '이야기/동화',
          purpose: activeInitial.planning?.purpose || '상상과 교훈 나누기',
          audience: activeInitial.planning?.audience || '친구들과 어린이',
          ideas: activeInitial.planning?.ideas || [],
          storyFramework: activeInitial.planning?.storyFramework || {
            firstSentence: '',
            character: '',
            goal: '',
            obstacle: '',
            helper: '',
            resolution: '',
            ending: ''
          },
          outline: {
            beginning: activeInitial.planning?.outline?.beginning || '',
            middle: activeInitial.planning?.outline?.middle || '',
            ending: activeInitial.planning?.outline?.ending || '',
            exposition: activeInitial.planning?.outline?.exposition || '',
            development: activeInitial.planning?.outline?.development || '',
            climax: activeInitial.planning?.outline?.climax || '',
            resolution: activeInitial.planning?.outline?.resolution || ''
          }
        }
      };
    }
    const newId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      recordId: newId,
      studentKey: student.studentKey,
      classId: student.classId,
      topicId: '',
      topicTitle: '',
      planning: {
        title: '',
        genre: '생활문',
        purpose: '경험과 생각 나누기',
        audience: '친구들과 선생님',
        ideas: [],
        outline: {
          beginning: '',
          middle: '',
          ending: '',
          exposition: '',
          development: '',
          climax: '',
          resolution: ''
        }
      },
      draft: '',
      aiFeedback: null,
      revisionGoal: '',
      revisedWriting: '',
      selfAssessment: null,
      beforeProofreading: '',
      afterProofreading: '',
      proofreadSuggestions: [],
      finalWriting: '',
      currentStep: 1,
      status: 'drafting',
      favorite: false,
      xpGranted: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      submittedAt: null
    };
  });

  // Keep record in sync if activeInitial changes
  useEffect(() => {
    if (activeInitial && activeInitial.recordId !== record.recordId) {
      setRecord(activeInitial);
    }
  }, [activeInitial, record.recordId]);

  // Save status state
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const autoSaveTimeoutRef = useRef<any>(null);

  // Topics state (Step 1)
  const [availableTopics, setAvailableTopics] = useState<DailyTopic[]>(PRESET_TOPICS);
  const [loadingTopics, setLoadingTopics] = useState<boolean>(false);
  const [customTopicInput, setCustomTopicInput] = useState<string>('');
  const [ideaInput, setIdeaInput] = useState<string>('');

  // AI states
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>('');

  // 2단계 발단·전개·절정·결말 1문장 예시 힌트 state
  const [outlineExamples, setOutlineExamples] = useState<{
    exposition?: string;
    development?: string;
    climax?: string;
    resolution?: string;
  }>({});
  const [loadingOutlineExamples, setLoadingOutlineExamples] = useState<boolean>(false);
  // 3단계에서 2단계 계획 참고 패널 펼침 여부
  const [showPlanReference, setShowPlanReference] = useState<boolean>(false);

  // Auto-save logic
  const persistRecord = useCallback(async (currentRec: WritingRecord) => {
    setSaveStatus('saving');
    // Local storage backup first
    saveDraftToLocal(currentRec);

    try {
      const recRef = doc(db, COLLECTIONS.WRITING_RECORDS, currentRec.recordId);
      const dataToSave = {
        ...currentRec,
        updatedAt: Date.now()
      };
      await setDoc(recRef, dataToSave, { merge: true });
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('Firestore auto-save error:', err);
      setSaveStatus('error');
    }
  }, []);

  const triggerDebouncedAutoSave = useCallback((updated: WritingRecord) => {
    setRecord(updated);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      persistRecord(updated);
    }, 1500);
  }, [persistRecord]);

  // Save immediately on step change or unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Helper to construct draft from Step 2 outline or Step 1 storyFramework
  const getOutlineDraftText = useCallback((rec: WritingRecord): string => {
    const exp = (rec.planning.outline.exposition || rec.planning.outline.beginning || '').trim();
    const dev = (rec.planning.outline.development || '').trim();
    const clx = (rec.planning.outline.climax || rec.planning.outline.middle || '').trim();
    const res = (rec.planning.outline.resolution || rec.planning.outline.ending || '').trim();
    const sf = rec.planning.storyFramework;

    // 1. If Step 2 outline fields exist
    if (exp || dev || clx || res) {
      const parts: string[] = [];
      if (exp) parts.push(exp.startsWith('[발단]') ? exp : `[발단]\n${exp}`);
      if (dev) parts.push(dev.startsWith('[전개]') ? dev : `[전개]\n${dev}`);
      if (clx) parts.push(clx.startsWith('[절정]') ? clx : `[절정]\n${clx}`);
      if (res) parts.push(res.startsWith('[결말]') ? res : `[결말]\n${res}`);
      return parts.join('\n\n');
    }

    // 2. If Step 1 storyFramework exists
    if (sf && (sf.firstSentence || sf.character || sf.goal || sf.obstacle || sf.helper || sf.resolution || sf.ending)) {
      const parts: string[] = [];

      // [발단] 첫 문장과 주인공
      const expLines: string[] = [];
      if (sf.firstSentence) expLines.push(sf.firstSentence);
      if (sf.character) expLines.push(`이 이야기의 주인공은 ${sf.character}입니다.`);
      if (expLines.length > 0) {
        parts.push(`[발단]\n${expLines.join('\n')}`);
      }

      // [전개] 하고 싶은 일(목표)과 도움
      const devLines: string[] = [];
      if (sf.goal) devLines.push(`주인공은 '${sf.goal}'라는 목표를 꼭 이루고 싶었습니다.`);
      if (sf.helper) devLines.push(`어려울 때마다 ${sf.helper} 큰 힘과 지혜가 되어 주었습니다.`);
      if (devLines.length > 0) {
        parts.push(`[전개]\n${devLines.join('\n')}`);
      }

      // [절정] 시련과 방해, 해결과정
      const clxLines: string[] = [];
      if (sf.obstacle) clxLines.push(`하지만 큰 시련이 찾아왔습니다. ${sf.obstacle}`);
      if (sf.resolution) clxLines.push(`그때 주인공은 포기하지 않고 ${sf.resolution} 마침내 위기를 극복하기 시작했습니다.`);
      if (clxLines.length > 0) {
        parts.push(`[절정]\n${clxLines.join('\n')}`);
      }

      // [결말] 결말과 변화된 모습
      if (sf.ending) {
        parts.push(`[결말]\n모든 모험이 끝나고, ${sf.ending}`);
      }

      return parts.join('\n\n');
    }

    return '';
  }, []);

  const handleStepChange = async (nextStep: number) => {
    if (nextStep < 1 || nextStep > 9) return;
    let nextDraft = record.draft;
    // 초고쓰기(Step 3)로 이동 시 계획하기 내용이 저장되어 그대로 들어와 있도록 처리
    if (nextStep === 3 && !record.draft.trim()) {
      const skeleton = getOutlineDraftText(record);
      if (skeleton) {
        nextDraft = skeleton;
      }
    }
    const updated: WritingRecord = {
      ...record,
      draft: nextDraft,
      currentStep: nextStep,
      updatedAt: Date.now()
    };
    setRecord(updated);
    await persistRecord(updated);
  };

  // 3단계 초고 쓰기 진입 시 초고가 비어있으면 앞 부분 계획하기 내용을 즉시 채우고 영구 저장
  useEffect(() => {
    if (record.currentStep === 3 && !record.draft.trim()) {
      const skeleton = getOutlineDraftText(record);
      if (skeleton) {
        const updated: WritingRecord = {
          ...record,
          draft: skeleton,
          updatedAt: Date.now()
        };
        setRecord(updated);
        persistRecord(updated);
      }
    }
  }, [record.currentStep, record.draft, getOutlineDraftText, persistRecord]);

  // Step 1: Topics logic
  const handleSelectTopic = (topic: DailyTopic) => {
    const updated: WritingRecord = {
      ...record,
      topicId: topic.id,
      topicTitle: topic.title,
      planning: {
        ...record.planning,
        title: record.planning.title || topic.title
      }
    };
    triggerDebouncedAutoSave(updated);
  };

  const handleGenerateAITopics = async () => {
    setLoadingTopics(true);
    try {
      const topics = await requestAITopics(student.grade, '자유 글쓰기', customTopicInput);
      setAvailableTopics(topics);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingTopics(false);
    }
  };

  // Picture Book Story Framework Update
  const handleFrameworkUpdate = (newFramework: StoryFramework) => {
    const defaultTitle = newFramework.character
      ? `${newFramework.character}의 특별한 이야기`
      : newFramework.firstSentence
      ? (newFramework.firstSentence.length > 25 ? `${newFramework.firstSentence.slice(0, 25)}...` : newFramework.firstSentence)
      : record.topicTitle || '나의 그림책 이야기';

    const expText = [
      newFramework.firstSentence ? `[첫 문장] ${newFramework.firstSentence}` : '',
      newFramework.character ? `[주인공] ${newFramework.character}` : ''
    ].filter(Boolean).join('\n');

    const devText = [
      newFramework.goal ? `[하고 싶은 일] ${newFramework.goal}` : '',
      newFramework.helper ? `[돕는 것] ${newFramework.helper}` : ''
    ].filter(Boolean).join('\n');

    const clxText = [
      newFramework.obstacle ? `[시련과 방해] ${newFramework.obstacle}` : '',
      newFramework.resolution ? `[해결과정] ${newFramework.resolution}` : ''
    ].filter(Boolean).join('\n');

    const resText = newFramework.ending ? `[결말] ${newFramework.ending}` : '';

    // Always update outline with the complete updated framework fields
    const updatedOutline = {
      exposition: expText || record.planning.outline.exposition || '',
      development: devText || record.planning.outline.development || '',
      climax: clxText || record.planning.outline.climax || '',
      resolution: resText || record.planning.outline.resolution || '',
      beginning: expText || record.planning.outline.beginning || '',
      middle: [devText, clxText].filter(Boolean).join('\n') || record.planning.outline.middle || '',
      ending: resText || record.planning.outline.ending || ''
    };

    const updated: WritingRecord = {
      ...record,
      topicId: record.topicId || `story_${Date.now()}`,
      topicTitle: record.topicTitle || defaultTitle,
      planning: {
        ...record.planning,
        title: record.planning.title || defaultTitle,
        genre: '이야기/동화',
        storyFramework: newFramework,
        outline: updatedOutline
      }
    };
    triggerDebouncedAutoSave(updated);
  };

  // Step 2: Gemini 1-sentence outline examples handler
  const handleFetchOutlineExamples = async () => {
    setLoadingOutlineExamples(true);
    try {
      const sf = record.planning.storyFramework || {
        firstSentence: '',
        character: '',
        goal: '',
        obstacle: '',
        helper: '',
        resolution: '',
        ending: ''
      };
      const examples = await requestOutlineExamples(sf, student.grade);
      setOutlineExamples(examples);
    } catch (err) {
      console.warn('Outline examples error:', err);
    } finally {
      setLoadingOutlineExamples(false);
    }
  };

  const handleInsertOutlineExample = (
    key: 'exposition' | 'development' | 'climax' | 'resolution',
    exampleText?: string
  ) => {
    if (!exampleText) return;
    const currentVal = (record.planning.outline[key] ||
      (key === 'exposition' ? record.planning.outline.beginning : key === 'climax' ? record.planning.outline.middle : key === 'resolution' ? record.planning.outline.ending : '') || '').trim();

    const newVal = currentVal ? `${currentVal}\n${exampleText}` : exampleText;

    const updated: WritingRecord = {
      ...record,
      planning: {
        ...record.planning,
        outline: {
          ...record.planning.outline,
          [key]: newVal,
          ...(key === 'exposition' ? { beginning: newVal } : {}),
          ...(key === 'climax' ? { middle: newVal } : {}),
          ...(key === 'resolution' ? { ending: newVal } : {})
        }
      }
    };
    triggerDebouncedAutoSave(updated);
  };

  const handleApplyStoryToDraft = async (replace = false) => {
    const skeleton = getOutlineDraftText(record);
    if (!skeleton) return;

    const newDraft = (replace || !record.draft.trim()) ? skeleton : `${record.draft}\n\n${skeleton}`;
    const updated: WritingRecord = {
      ...record,
      draft: newDraft,
      updatedAt: Date.now()
    };
    setRecord(updated);
    await persistRecord(updated);
  };

  // Step 2: Planning helpers
  const handleAddIdea = () => {
    if (!ideaInput.trim()) return;
    const newIdeas = [...record.planning.ideas, ideaInput.trim()];
    const updated: WritingRecord = {
      ...record,
      planning: {
        ...record.planning,
        ideas: newIdeas
      }
    };
    setIdeaInput('');
    triggerDebouncedAutoSave(updated);
  };

  const handleRemoveIdea = (index: number) => {
    const newIdeas = record.planning.ideas.filter((_, i) => i !== index);
    const updated: WritingRecord = {
      ...record,
      planning: {
        ...record.planning,
        ideas: newIdeas
      }
    };
    triggerDebouncedAutoSave(updated);
  };

  // Step 4: AI Feedback Request
  const handleRequestAiFeedback = async () => {
    let draftText = (record.draft || '').trim();
    if (!draftText) {
      const skeleton = getOutlineDraftText(record);
      if (skeleton) {
        draftText = skeleton;
      }
    }
    if (!draftText) {
      setAiError('초고 내용이 없습니다. 2단계 이야기 흐름을 계획하거나 3단계에서 초고를 작성해주세요.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const feedback = await requestDraftFeedback(
        record.topicTitle || '자유 주제',
        draftText,
        record.planning || {
          title: record.topicTitle || '나의 글',
          genre: '생활문',
          purpose: '생각 나누기',
          audience: '선생님과 친구들',
          ideas: [],
          outline: { beginning: '', middle: '', ending: '' }
        },
        student.grade || 4
      );
      const updated: WritingRecord = {
        ...record,
        draft: record.draft || draftText,
        aiFeedback: feedback,
        revisedWriting: record.revisedWriting || draftText, // init revision with draft
        updatedAt: Date.now()
      };
      setRecord(updated);
      await persistRecord(updated);
    } catch (err: any) {
      console.error('handleRequestAiFeedback error:', err);
      const rawMsg = typeof err === 'string'
        ? err
        : (typeof err?.message === 'string'
            ? err.message
            : (typeof err?.error === 'string'
                ? err.error
                : ''));
      const cleanMsg = (!rawMsg || rawMsg === '[object Object]')
        ? 'AI 피드백을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.'
        : rawMsg;
      setAiError(cleanMsg);
    } finally {
      setAiLoading(false);
    }
  };

  // Step 8: Proofreading Request
  const handleRequestProofreading = async () => {
    const textToCheck = (record.revisedWriting || record.draft || '').trim();
    if (!textToCheck) {
      setAiError('점검할 글 내용이 없습니다.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const result = await requestProofreading(textToCheck, student.grade || 4);
      const updated: WritingRecord = {
        ...record,
        beforeProofreading: result.beforeProofreading,
        afterProofreading: result.afterProofreading,
        proofreadSuggestions: result.suggestions,
        finalWriting: record.finalWriting || result.afterProofreading,
        updatedAt: Date.now()
      };
      setRecord(updated);
      await persistRecord(updated);
    } catch (err: any) {
      console.error('handleRequestProofreading error:', err);
      const rawMsg = typeof err === 'string'
        ? err
        : (typeof err?.message === 'string'
            ? err.message
            : (typeof err?.error === 'string'
                ? err.error
                : ''));
      const cleanMsg = (!rawMsg || rawMsg === '[object Object]')
        ? '맞춤법 점검 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : rawMsg;
      setAiError(cleanMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySingleSuggestion = (index: number) => {
    const suggestion = record.proofreadSuggestions[index];
    if (!suggestion || suggestion.applied) return;

    // Apply replacement in finalWriting
    let text = record.finalWriting || record.afterProofreading;
    if (text.includes(suggestion.original)) {
      text = text.replace(suggestion.original, suggestion.corrected);
    }

    const newSuggestions = [...record.proofreadSuggestions];
    newSuggestions[index] = { ...suggestion, applied: true };

    const updated: WritingRecord = {
      ...record,
      finalWriting: text,
      proofreadSuggestions: newSuggestions
    };
    triggerDebouncedAutoSave(updated);
  };

  const handleApplyAllSuggestions = () => {
    const newSuggestions = record.proofreadSuggestions.map(s => ({ ...s, applied: true }));
    const updated: WritingRecord = {
      ...record,
      finalWriting: record.afterProofreading,
      proofreadSuggestions: newSuggestions
    };
    triggerDebouncedAutoSave(updated);
  };

  // Step 9: Final Submission & XP Award
  const handleSubmitFinal = async () => {
    const finalContent = record.finalWriting || record.afterProofreading || record.revisedWriting || record.draft;
    if (!finalContent.trim()) {
      alert('완성된 글이 비어 있습니다.');
      return;
    }

    setSaveStatus('saving');
    try {
      const isFirstSubmission = record.status !== 'submitted';
      const xpToAdd = isFirstSubmission ? 120 : 20;

      const finalRecord: WritingRecord = {
        ...record,
        finalWriting: finalContent,
        status: 'submitted',
        submittedAt: Date.now(),
        xpGranted: (record.xpGranted || 0) + xpToAdd,
        updatedAt: Date.now()
      };

      // 1. Save Writing Record to Firestore
      const recRef = doc(db, COLLECTIONS.WRITING_RECORDS, finalRecord.recordId);
      await setDoc(recRef, finalRecord, { merge: true });

      // 2. Update Student Growth (XP, Level, Badges)
      const effectiveGrowth: StudentGrowth = studentGrowth || {
        studentKey: student.studentKey,
        studentName: student.name,
        level: 1,
        xp: 0,
        completedCount: 0,
        badges: [],
        equippedAvatar: 'bear',
        updatedAt: Date.now()
      };

      const newXp = effectiveGrowth.xp + xpToAdd;
      const newLevelInfo = calculateLevel(newXp);
      const newCompletedCount = effectiveGrowth.completedCount + (isFirstSubmission ? 1 : 0);

      const growthRef = doc(db, COLLECTIONS.STUDENT_GROWTH, student.studentKey);
      const updatedGrowth: StudentGrowth = {
        ...effectiveGrowth,
        xp: newXp,
        level: newLevelInfo.level,
        levelTitle: newLevelInfo.title,
        completedCount: newCompletedCount,
        updatedAt: Date.now()
      };

      // Check badges
      const newBadges = checkNewBadges([finalRecord], updatedGrowth);
      if (newBadges.length > 0) {
        updatedGrowth.badges = [...updatedGrowth.badges, ...newBadges];
        triggerCelebration('badge');
      }

      if (newLevelInfo.level > effectiveGrowth.level) {
        triggerCelebration('level_up');
      } else {
        triggerCelebration('submit');
      }

      await setDoc(growthRef, updatedGrowth, { merge: true });
      if (onGrowthUpdate) onGrowthUpdate(updatedGrowth);

      setRecord(finalRecord);
      setSaveStatus('saved');
      if (onCompleteSubmission) {
        onCompleteSubmission(finalRecord);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('Final submit err:', err);
      setSaveStatus('error');
      alert(`제출 중 오류: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* Top Workflow Bar */}
      <div className="bg-white border-b border-[#EADDCA] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                persistRecord(record);
                onClose();
              }}
              className="p-2 hover:bg-[#F5EFE6] rounded-xl text-[#8C8379] hover:text-[#2D2A26] transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>나가기</span>
            </button>
            <div className="h-4 w-[1px] bg-[#EADDCA]" />
            <div>
              <h2 className="font-extrabold text-sm text-[#2D2A26] flex items-center gap-2">
                <span>{record.topicTitle || '새 글쓰기'}</span>
                {record.status === 'submitted' && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F0F7F4] text-[#5A8F7B] border border-[#D1E9DE]">
                    제출 완료
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Auto-save status indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[#A67C52]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>저장 중...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-[#5A8F7B]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>저장 완료 {lastSavedTime && `(${lastSavedTime})`}</span>
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>저장 오류 (임시 보관됨)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={record.currentStep <= 1}
                onClick={() => handleStepChange(record.currentStep - 1)}
                className="px-3 py-1.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                이전 단계
              </button>
              <button
                disabled={record.currentStep >= 9}
                onClick={() => handleStepChange(record.currentStep + 1)}
                className="px-3.5 py-1.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors"
              >
                <span>다음 단계</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 9-Step Interactive Stepper */}
        <div className="max-w-7xl mx-auto px-4 pb-2 pt-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 min-w-[760px]">
            {STEPS.map((s) => {
              const isCurrent = record.currentStep === s.step;
              const isCompleted = record.currentStep > s.step;

              return (
                <button
                  key={s.step}
                  onClick={() => handleStepChange(s.step)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-[#5A8F7B] text-white shadow-xs'
                      : isCompleted
                      ? 'bg-[#F0F7F4] text-[#5A8F7B] hover:bg-[#E2F0EA] border border-[#D1E9DE]'
                      : 'bg-[#F5EFE6] text-[#8C8379] hover:bg-[#EADDCA]'
                  }`}
                >
                  <span className="text-xs">{s.icon}</span>
                  <span className="whitespace-nowrap">{s.step}. {s.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Step Canvas */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* STEP 1: 첫 문장 & 이야기 씨앗 (그림책 이야기 만들기 채팅창) */}
        {record.currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <PictureBookChat
              student={student}
              topicTitle={record.topicTitle || record.planning.title}
              initialFramework={record.planning.storyFramework}
              onFrameworkUpdate={handleFrameworkUpdate}
              onProceedToNextStep={() => handleStepChange(2)}
            />
          </div>
        )}

        {/* STEP 2: 계획하기 (제목과 발단, 전개, 절정, 결말의 4부분만 깔끔하게 구성) */}
        {record.currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#EADDCA] shadow-sm space-y-6">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#2D2A26]">2단계: 글쓰기 계획 세우기</h3>
                <p className="text-xs sm:text-sm text-[#8C8379] mt-1">
                  제목과 발단, 전개, 절정, 결말의 4부분을 간단하게 적어보세요.
                </p>
              </div>

              {/* 글의 제목 */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                  글의 제목
                </label>
                <input
                  type="text"
                  placeholder="호기심을 끄는 멋진 제목을 지어보세요"
                  value={record.planning.title}
                  onChange={(e) => {
                    const updated = {
                      ...record,
                      planning: { ...record.planning, title: e.target.value }
                    };
                    triggerDebouncedAutoSave(updated);
                  }}
                  className="w-full px-4 py-3 border border-[#EADDCA] rounded-2xl text-sm sm:text-base font-bold text-[#2D2A26] placeholder:font-normal placeholder:text-[#8C8379] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-[#FDFBF7]"
                />
              </div>

              {/* 이야기 4부분 (발단 • 전개 • 절정 • 결말) - 1x4 세로 순서 배치 */}
              <div className="space-y-4">
                {/* 3. 제미나이 1문장 예시 힌트 배너 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#FFF9F2] rounded-2xl border border-[#F0DDC8]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#D48806]" />
                      <span className="text-xs font-black text-[#2D2A26]">
                        글쓰기가 힘든 작가님을 위한 제미나이 1문장 예시 힌트
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C8379] leading-relaxed">
                      1단계 씨앗을 바탕으로 발단·전개·절정·결말 <strong>각 1문장 예시</strong>를 확인하고, 이를 참고해 살을 붙여 길게 써보세요!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchOutlineExamples}
                    disabled={loadingOutlineExamples}
                    className="shrink-0 px-4 py-2.5 bg-[#A67C52] hover:bg-[#8C6541] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${loadingOutlineExamples ? 'animate-spin' : ''}`} />
                    <span>
                      {loadingOutlineExamples
                        ? '1문장 예시 만드는 중...'
                        : Object.keys(outlineExamples).length > 0
                        ? '1문장 예시 다시 받기'
                        : '제미나이 1문장 예시 보기'}
                    </span>
                  </button>
                </div>

                <label className="block text-xs font-extrabold text-[#2D2A26]">
                  이야기 흐름 (발단 • 전개 • 절정 • 결말)
                </label>
                <div className="grid grid-cols-1 gap-4">
                  {/* 1. 발단 */}
                  <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#A67C52] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#F5EFE6] text-[#A67C52] flex items-center justify-center text-[11px] font-bold">1</span>
                        <span>발단</span>
                      </span>
                      <span className="text-[11px] text-[#8C8379]">배경과 인물 소개</span>
                    </div>

                    {outlineExamples.exposition && (
                      <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#F5E6D3] text-xs flex items-start justify-between gap-3 animate-in fade-in">
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-black text-[#A67C52] flex items-center gap-1">
                            <span>💡</span> 제미나이 발단 1문장 예시 (참고하여 살을 붙여보세요)
                          </span>
                          <p className="font-medium text-[#2D2A26] leading-relaxed">
                            "{outlineExamples.exposition}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInsertOutlineExample('exposition', outlineExamples.exposition)}
                          className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-[#FDFBF7] border border-[#EADDCA] rounded-lg text-[11px] font-bold text-[#A67C52] hover:text-[#5A8F7B] transition-colors shadow-2xs"
                          title="이 1문장을 입력창에 넣고 살을 붙여보세요"
                        >
                          내 글에 넣기
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={4}
                      placeholder="이야기가 시작되는 시간과 장소, 주인공의 모습을 간단히 적어보세요."
                      value={record.planning.outline.exposition ?? record.planning.outline.beginning ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = {
                          ...record,
                          planning: {
                            ...record.planning,
                            outline: {
                              ...record.planning.outline,
                              exposition: val,
                              beginning: val
                            }
                          }
                        };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="w-full p-3 text-xs sm:text-sm leading-relaxed border border-[#EADDCA] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    />
                  </div>

                  {/* 2. 전개 */}
                  <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#5A8F7B] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#E2F0EA] text-[#5A8F7B] flex items-center justify-center text-[11px] font-bold">2</span>
                        <span>전개</span>
                      </span>
                      <span className="text-[11px] text-[#8C8379]">사건의 시작과 진행</span>
                    </div>

                    {outlineExamples.development && (
                      <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#F5E6D3] text-xs flex items-start justify-between gap-3 animate-in fade-in">
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-black text-[#5A8F7B] flex items-center gap-1">
                            <span>💡</span> 제미나이 전개 1문장 예시 (참고하여 살을 붙여보세요)
                          </span>
                          <p className="font-medium text-[#2D2A26] leading-relaxed">
                            "{outlineExamples.development}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInsertOutlineExample('development', outlineExamples.development)}
                          className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-[#FDFBF7] border border-[#EADDCA] rounded-lg text-[11px] font-bold text-[#5A8F7B] hover:text-[#4D7D6B] transition-colors shadow-2xs"
                          title="이 1문장을 입력창에 넣고 살을 붙여보세요"
                        >
                          내 글에 넣기
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={4}
                      placeholder="주인공이 하고 싶은 일이나 모험을 시작하며 겪게 되는 일을 간단하게 적어보세요."
                      value={record.planning.outline.development ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = {
                          ...record,
                          planning: {
                            ...record.planning,
                            outline: {
                              ...record.planning.outline,
                              development: val
                            }
                          }
                        };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="w-full p-3 text-xs sm:text-sm leading-relaxed border border-[#EADDCA] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    />
                  </div>

                  {/* 3. 절정 */}
                  <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#C05621] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-50 text-[#C05621] flex items-center justify-center text-[11px] font-bold">3</span>
                        <span>절정</span>
                      </span>
                      <span className="text-[11px] text-[#8C8379]">가장 큰 위기와 시련</span>
                    </div>

                    {outlineExamples.climax && (
                      <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#F5E6D3] text-xs flex items-start justify-between gap-3 animate-in fade-in">
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-black text-[#C05621] flex items-center gap-1">
                            <span>💡</span> 제미나이 절정 1문장 예시 (참고하여 살을 붙여보세요)
                          </span>
                          <p className="font-medium text-[#2D2A26] leading-relaxed">
                            "{outlineExamples.climax}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInsertOutlineExample('climax', outlineExamples.climax)}
                          className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-[#FDFBF7] border border-[#EADDCA] rounded-lg text-[11px] font-bold text-[#C05621] hover:text-[#9C4221] transition-colors shadow-2xs"
                          title="이 1문장을 입력창에 넣고 살을 붙여보세요"
                        >
                          내 글에 넣기
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={4}
                      placeholder="가장 긴장되는 순간이나 맞닥뜨린 큰 시련, 위기를 극복하려는 장면을 적어보세요."
                      value={record.planning.outline.climax ?? record.planning.outline.middle ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = {
                          ...record,
                          planning: {
                            ...record.planning,
                            outline: {
                              ...record.planning.outline,
                              climax: val,
                              middle: val
                            }
                          }
                        };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="w-full p-3 text-xs sm:text-sm leading-relaxed border border-[#EADDCA] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    />
                  </div>

                  {/* 4. 결말 */}
                  <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#2B6CB0] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-50 text-[#2B6CB0] flex items-center justify-center text-[11px] font-bold">4</span>
                        <span>결말</span>
                      </span>
                      <span className="text-[11px] text-[#8C8379]">사건의 해결과 마무리</span>
                    </div>

                    {outlineExamples.resolution && (
                      <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#F5E6D3] text-xs flex items-start justify-between gap-3 animate-in fade-in">
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-black text-[#2B6CB0] flex items-center gap-1">
                            <span>💡</span> 제미나이 결말 1문장 예시 (참고하여 살을 붙여보세요)
                          </span>
                          <p className="font-medium text-[#2D2A26] leading-relaxed">
                            "{outlineExamples.resolution}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInsertOutlineExample('resolution', outlineExamples.resolution)}
                          className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-[#FDFBF7] border border-[#EADDCA] rounded-lg text-[11px] font-bold text-[#2B6CB0] hover:text-[#2A4365] transition-colors shadow-2xs"
                          title="이 1문장을 입력창에 넣고 살을 붙여보세요"
                        >
                          내 글에 넣기
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={4}
                      placeholder="문제가 해결되고 난 뒤의 감동이나 변화된 주인공의 모습, 마무리를 적어보세요."
                      value={record.planning.outline.resolution ?? record.planning.outline.ending ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = {
                          ...record,
                          planning: {
                            ...record.planning,
                            outline: {
                              ...record.planning.outline,
                              resolution: val,
                              ending: val
                            }
                          }
                        };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="w-full p-3 text-xs sm:text-sm leading-relaxed border border-[#EADDCA] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#5A8F7B]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(1)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (1단계 대화)
              </button>
              <button
                onClick={async () => {
                  const skeleton = getOutlineDraftText(record);
                  let nextDraft = record.draft;
                  // 초고가 비어있으면 2단계 계획 내용으로 즉시 채우기
                  if (!record.draft.trim() && skeleton) {
                    nextDraft = skeleton;
                  }
                  const updated = {
                    ...record,
                    draft: nextDraft,
                    currentStep: 3,
                    updatedAt: Date.now()
                  };
                  setRecord(updated);
                  await persistRecord(updated);
                }}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <span>초고 작성하러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 초고 쓰기 */}
        {record.currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#2D2A26]">3단계: 거침없이 초고 쓰기</h3>
                  <p className="text-xs text-[#8C8379]">
                    틀릴까 봐 걱정하지 말고, 계획한 생각을 솔직하고 자유롭게 쭉 써내려가 보세요.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#8C8379]">
                    글자 수: <strong className="text-[#5A8F7B] text-sm">{record.draft.length}</strong>자
                  </span>
                </div>
              </div>

              {/* Planning Reference Pill Bar */}
              {record.planning.title && (
                <div className="p-3 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] flex flex-wrap items-center gap-3 text-xs text-[#4A443F]">
                  <span><strong>제목:</strong> {record.planning.title}</span>
                  <span>•</span>
                  <span><strong>종류:</strong> {record.planning.genre}</span>
                  {record.planning.ideas.length > 0 && (
                    <>
                      <span>•</span>
                      <span><strong>키워드:</strong> {record.planning.ideas.slice(0, 4).join(', ')}</span>
                    </>
                  )}
                </div>
              )}

              {/* 앞 단계 발단, 전개, 절정, 결말 자동 연동 안내 및 제어 도구 모음 */}
              <div className="p-4 bg-[#F0F7F4] rounded-2xl border border-[#D1E9DE] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-[#5A8F7B] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#5A8F7B] shrink-0" />
                      <span>2단계(발단·전개·절정·결말) 계획 내용이 초고에 저장되어 그대로 들어와 있습니다!</span>
                    </span>
                    <p className="text-[11px] text-[#4A443F] leading-relaxed">
                      앞서 계획한 발단, 전개, 절정, 결말 뼈대를 바탕으로, 문장과 대화를 덧붙여 나만의 그림책 이야기를 완성해 보세요.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPlanReference(!showPlanReference)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 ${
                        showPlanReference
                          ? 'bg-[#5A8F7B] text-white'
                          : 'bg-white hover:bg-[#FDFBF7] text-[#5A8F7B] border border-[#D1E9DE]'
                      }`}
                      title="2단계에서 계획한 발단, 전개, 절정, 결말 카드 내용을 펼쳐봅니다"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{showPlanReference ? '내 계획 닫기' : '📌 내 계획 보기'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyStoryToDraft(true)}
                      className="px-3 py-1.5 bg-white hover:bg-[#E2F0EA] text-[#5A8F7B] border border-[#D1E9DE] rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                      title="2단계 계획 내용을 다시 불러와 초고에 덮어씁니다"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>계획 내용 다시 불러오기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyStoryToDraft(false)}
                      className="px-3 py-1.5 bg-white hover:bg-[#FDFBF7] text-[#A67C52] border border-[#EADDCA] rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                      title="현재 쓴 글 아래에 2단계 계획 내용을 이어붙입니다"
                    >
                      <span>+ 계획 내용 이어붙이기</span>
                    </button>
                  </div>
                </div>

                {/* 펼쳐볼 수 있는 [2단계 계획 카드 4단계] 참조 패널 */}
                {showPlanReference && (
                  <div className="pt-3 border-t border-[#D1E9DE] animate-in fade-in space-y-2">
                    <span className="text-[11px] font-black text-[#5A8F7B]">
                      작성 중인 글과 비교해 볼 수 있는 나의 4단계 글쓰기 계획:
                    </span>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* 발단 카드 */}
                      <div className="p-3 bg-white rounded-xl border border-[#EADDCA] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#A67C52]">1. 발단</span>
                          <button
                            type="button"
                            onClick={() => {
                              const t = record.planning.outline.exposition || record.planning.outline.beginning || '';
                              if (t) {
                                const newDraft = record.draft ? `${record.draft}\n\n${t}` : t;
                                const updated = { ...record, draft: newDraft };
                                setRecord(updated);
                                persistRecord(updated);
                              }
                            }}
                            className="text-[10px] text-[#A67C52] hover:underline font-bold"
                          >
                            초고에 추가
                          </button>
                        </div>
                        <p className="text-[11px] text-[#2D2A26] leading-relaxed max-h-28 overflow-y-auto whitespace-pre-line">
                          {record.planning.outline.exposition || record.planning.outline.beginning || '(미작성)'}
                        </p>
                      </div>

                      {/* 전개 카드 */}
                      <div className="p-3 bg-white rounded-xl border border-[#EADDCA] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#5A8F7B]">2. 전개</span>
                          <button
                            type="button"
                            onClick={() => {
                              const t = record.planning.outline.development || '';
                              if (t) {
                                const newDraft = record.draft ? `${record.draft}\n\n${t}` : t;
                                const updated = { ...record, draft: newDraft };
                                setRecord(updated);
                                persistRecord(updated);
                              }
                            }}
                            className="text-[10px] text-[#5A8F7B] hover:underline font-bold"
                          >
                            초고에 추가
                          </button>
                        </div>
                        <p className="text-[11px] text-[#2D2A26] leading-relaxed max-h-28 overflow-y-auto whitespace-pre-line">
                          {record.planning.outline.development || '(미작성)'}
                        </p>
                      </div>

                      {/* 절정 카드 */}
                      <div className="p-3 bg-white rounded-xl border border-[#EADDCA] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#C05621]">3. 절정</span>
                          <button
                            type="button"
                            onClick={() => {
                              const t = record.planning.outline.climax || record.planning.outline.middle || '';
                              if (t) {
                                const newDraft = record.draft ? `${record.draft}\n\n${t}` : t;
                                const updated = { ...record, draft: newDraft };
                                setRecord(updated);
                                persistRecord(updated);
                              }
                            }}
                            className="text-[10px] text-[#C05621] hover:underline font-bold"
                          >
                            초고에 추가
                          </button>
                        </div>
                        <p className="text-[11px] text-[#2D2A26] leading-relaxed max-h-28 overflow-y-auto whitespace-pre-line">
                          {record.planning.outline.climax || record.planning.outline.middle || '(미작성)'}
                        </p>
                      </div>

                      {/* 결말 카드 */}
                      <div className="p-3 bg-white rounded-xl border border-[#EADDCA] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#2B6CB0]">4. 결말</span>
                          <button
                            type="button"
                            onClick={() => {
                              const t = record.planning.outline.resolution || record.planning.outline.ending || '';
                              if (t) {
                                const newDraft = record.draft ? `${record.draft}\n\n${t}` : t;
                                const updated = { ...record, draft: newDraft };
                                setRecord(updated);
                                persistRecord(updated);
                              }
                            }}
                            className="text-[10px] text-[#2B6CB0] hover:underline font-bold"
                          >
                            초고에 추가
                          </button>
                        </div>
                        <p className="text-[11px] text-[#2D2A26] leading-relaxed max-h-28 overflow-y-auto whitespace-pre-line">
                          {record.planning.outline.resolution || record.planning.outline.ending || '(미작성)'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Draft Canvas */}
              <div className="relative">
                <textarea
                  rows={14}
                  placeholder="여기에 자유롭게 글을 써보세요. 

예시:
그날 아침, 교실 문을 열었을 때 이상하게도 공기가 달랐다..."
                  value={record.draft}
                  onChange={(e) => {
                    const updated = {
                      ...record,
                      draft: e.target.value
                    };
                    triggerDebouncedAutoSave(updated);
                  }}
                  className="w-full p-4 sm:p-5 border border-[#EADDCA] rounded-2xl text-base font-normal text-[#2D2A26] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-[#FDFBF7]"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(2)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (계획 보기)
              </button>
              <button
                disabled={!record.draft.trim()}
                onClick={() => handleStepChange(4)}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <span>AI 피드백 받으러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: AI 피드백 */}
        {record.currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#5A8F7B]" />
                    <span>4단계: AI 글쓰기 선생님의 맞춤 피드백</span>
                  </h3>
                  <p className="text-xs text-[#8C8379]">
                    선생님 AI가 내 초고를 꼼꼼히 읽고 잘된 점과 더 멋지게 고칠 수 있는 힌트를 알려줘요.
                  </p>
                </div>
                <button
                  onClick={handleRequestAiFeedback}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold shadow-sm disabled:opacity-50 transition-colors"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>{aiLoading ? '피드백 분석 중...' : record.aiFeedback ? '피드백 다시 받기' : 'AI 피드백 요청하기'}</span>
                </button>
              </div>

              {aiError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-2 font-medium">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{typeof aiError === 'string' && aiError !== '[object Object]' ? aiError : 'AI 피드백 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiError('')}
                    className="text-rose-400 hover:text-rose-600 px-1 font-bold"
                    aria-label="오류 알림 닫기"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Display Feedback */}
              {record.aiFeedback ? (
                <div className="space-y-4">
                  {/* Top Priority Banner */}
                  <div className="p-4 bg-[#FDFBF7] border-2 border-[#EADDCA] rounded-2xl">
                    <span className="text-xs font-extrabold text-[#A67C52] flex items-center gap-1 mb-1">
                      🎯 가장 먼저 고쳐볼 부분!
                    </span>
                    <p className="text-sm font-bold text-[#2D2A26] leading-relaxed">
                      {record.aiFeedback.topPriority}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="p-4 bg-[#F0F7F4] border border-[#D1E9DE] rounded-2xl space-y-2">
                      <span className="text-xs font-extrabold text-[#5A8F7B] flex items-center gap-1">
                        🌟 참 잘된 점
                      </span>
                      <ul className="space-y-1.5">
                        {record.aiFeedback.strengths?.map((st, i) => (
                          <li key={i} className="text-xs text-[#4A443F] leading-relaxed flex items-start gap-1.5">
                            <span className="text-[#5A8F7B] font-bold mt-0.5">✔</span>
                            <span>{st}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Improvements */}
                    <div className="p-4 bg-[#FFF9F0] border border-[#FFE7BA] rounded-2xl space-y-2">
                      <span className="text-xs font-extrabold text-[#A67C52] flex items-center gap-1">
                        💡 이렇게 더 채워보면 좋아요
                      </span>
                      <ul className="space-y-1.5">
                        {record.aiFeedback.improvements?.map((im, i) => (
                          <li key={i} className="text-xs text-[#4A443F] leading-relaxed flex items-start gap-1.5">
                            <span className="text-[#A67C52] font-bold mt-0.5">✦</span>
                            <span>{im}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Reasoning */}
                  {record.aiFeedback.reasoning && (
                    <div className="p-4 bg-[#FDFBF7] border border-[#EADDCA] rounded-2xl text-xs text-[#4A443F] leading-relaxed">
                      <span className="font-extrabold text-[#2D2A26] block mb-1">선생님의 따뜻한 한마디:</span>
                      <p>{record.aiFeedback.reasoning}</p>
                    </div>
                  )}

                  {/* Self Reflect Questions */}
                  {record.aiFeedback.selfReflectQuestions?.length > 0 && (
                    <div className="p-4 bg-[#F5EFE6] border border-[#EADDCA] rounded-2xl space-y-2">
                      <span className="text-xs font-extrabold text-[#A67C52] flex items-center gap-1">
                        🤔 스스로 생각해볼 질문:
                      </span>
                      <div className="space-y-1">
                        {record.aiFeedback.selfReflectQuestions.map((q, idx) => (
                          <p key={idx} className="text-xs text-[#2D2A26] font-medium">
                            • {q}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center bg-[#FDFBF7] rounded-2xl border border-dashed border-[#EADDCA] space-y-3">
                  <Wand2 className="w-10 h-10 text-[#5A8F7B] mx-auto opacity-70" />
                  <p className="text-sm font-bold text-[#2D2A26]">아직 피드백을 요청하지 않았습니다.</p>
                  <p className="text-xs text-[#8C8379]">
                    우측 상단의 [AI 피드백 요청하기] 버튼을 누르면 초고를 분석해드립니다.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(3)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (초고 확인)
              </button>
              <button
                onClick={() => handleStepChange(5)}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <span>수정 목표 세우러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: 수정 목표 세우기 */}
        {record.currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#2D2A26]">5단계: 나의 수정 목표 세우기</h3>
                <p className="text-xs text-[#8C8379]">
                  AI 피드백과 내 생각을 바탕으로, 이번 고쳐쓰기에서 꼭 바꾸고 싶은 나만의 목표를 정하세요.
                </p>
              </div>

              {/* Feedback Recall Box */}
              {record.aiFeedback?.topPriority && (
                <div className="p-3.5 bg-[#FDFBF7] border border-[#EADDCA] rounded-2xl text-xs text-[#4A443F] leading-relaxed">
                  <strong className="text-[#A67C52]">💡 추천된 우선 과제:</strong> {record.aiFeedback.topPriority}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                  🎯 내가 이번에 꼭 고쳐 쓰고 싶은 점:
                </label>
                <textarea
                  rows={4}
                  placeholder="예: 가운데 부분에서 친구와 다퉜을 때 내 마음이 얼마나 속상했는지 더 자세히 적고, 마지막에 화해한 뒤의 기분을 구체적인 행동으로 표현하겠다."
                  value={record.revisionGoal}
                  onChange={(e) => {
                    const updated = {
                      ...record,
                      revisionGoal: e.target.value
                    };
                    triggerDebouncedAutoSave(updated);
                  }}
                  className="w-full p-4 border border-[#EADDCA] rounded-2xl text-sm font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-[#FDFBF7]"
                />
              </div>

              {/* Quick Goal Helper Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#8C8379] block">선택하기 쉬운 수정 목표 예시:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    '그때의 표정과 몸짓을 흉내 내는 말을 넣어 생생하게 쓰기',
                    '처음과 끝이 자연스럽게 이어지도록 다듬기',
                    '상대방과 나눈 대화를 실감나게 큰따옴표로 넣기',
                    '내 생각이나 솔직한 느낌을 2문장 이상 더 보태기'
                  ].map((tip, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const newGoal = record.revisionGoal ? `${record.revisionGoal} ${tip}` : tip;
                        const updated = { ...record, revisionGoal: newGoal };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="text-xs px-3 py-1.5 bg-[#F5EFE6] hover:bg-[#EADDCA] text-[#4A443F] rounded-xl transition-colors text-left border border-[#EADDCA]"
                    >
                      + {tip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(4)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (피드백 확인)
              </button>
              <button
                disabled={!record.revisionGoal.trim()}
                onClick={() => handleStepChange(6)}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <span>고쳐쓰기 하러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: 고쳐쓰기 (Side-by-side or Tabbed) */}
        {record.currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#2D2A26]">6단계: 정성껏 고쳐쓰기</h3>
                  <p className="text-xs text-[#8C8379]">
                    정해둔 수정 목표를 떠올리며 글을 더 알차고 생생하게 다듬어 보세요.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#8C8379]">
                  고쳐쓴 글: <strong className="text-[#5A8F7B] text-sm">{record.revisedWriting?.length || 0}</strong>자
                </span>
              </div>

              {/* Revision Goal Reminder Banner */}
              {record.revisionGoal && (
                <div className="p-3 bg-[#FDFBF7] border border-[#EADDCA] rounded-xl text-xs text-[#A67C52] flex items-center gap-2 font-medium">
                  <span className="font-extrabold shrink-0">🎯 내 목표:</span>
                  <span className="text-[#4A443F]">{record.revisionGoal}</span>
                </div>
              )}

              {/* Split Editor */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Left: Original Draft (Read-only reference) */}
                <div className="flex flex-col border border-[#EADDCA] rounded-2xl p-4 bg-[#FDFBF7]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-[#8C8379]">내 처음 초고 (참고용)</span>
                    <button
                      onClick={() => {
                        const updated = { ...record, revisedWriting: record.draft };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="text-[11px] font-bold text-[#5A8F7B] hover:text-[#4D7D6B]"
                    >
                      초고 내용 가져오기
                    </button>
                  </div>
                  <div className="flex-1 p-3 bg-white rounded-xl border border-[#EADDCA] text-xs text-[#4A443F] leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[350px]">
                    {record.draft || '초고가 없습니다.'}
                  </div>
                </div>

                {/* Right: Revised Canvas */}
                <div className="flex flex-col border border-[#5A8F7B] rounded-2xl p-4 bg-[#F0F7F4]/30">
                  <span className="text-xs font-extrabold text-[#5A8F7B] mb-2">
                    🪄 새롭게 고쳐쓴 글
                  </span>
                  <textarea
                    rows={13}
                    placeholder="초고를 바탕으로 보완할 점을 채워가며 고쳐써보세요."
                    value={record.revisedWriting}
                    onChange={(e) => {
                      const updated = {
                        ...record,
                        revisedWriting: e.target.value
                      };
                      triggerDebouncedAutoSave(updated);
                    }}
                    className="w-full flex-1 p-3 border border-[#EADDCA] rounded-xl text-sm font-medium text-[#2D2A26] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(5)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (목표 확인)
              </button>
              <button
                disabled={!record.revisedWriting?.trim()}
                onClick={() => handleStepChange(7)}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <span>자기평가 하러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: 자기평가 */}
        {record.currentStep === 7 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-sm space-y-5">
              <div>
                <h3 className="text-lg font-extrabold text-[#2D2A26]">7단계: 나의 글 자기평가</h3>
                <p className="text-xs text-[#8C8379]">
                  내가 쓴 글을 독자의 눈으로 바라보고 정직하고 뿌듯하게 점검해보세요.
                </p>
              </div>

              {/* Rubrics */}
              <div className="space-y-4">
                {[
                  {
                    key: 'rubric1Score',
                    title: '1. 내용의 생생함과 독창성',
                    desc: '내가 겪은 일이나 상상이 읽는 사람에게 생생하게 전해지나요?'
                  },
                  {
                    key: 'rubric2Score',
                    title: '2. 문장의 자연스러운 흐름',
                    desc: '문장과 문장이 매끄럽게 이어지고 읽기 편한가요?'
                  },
                  {
                    key: 'rubric3Score',
                    title: '3. 고쳐쓰기 목표 달성도',
                    desc: '내가 세웠던 수정 목표를 충실하게 반영하여 발전시켰나요?'
                  }
                ].map((rub) => {
                  const currentVal = (record.selfAssessment as any)?.[rub.key] || 0;

                  return (
                    <div key={rub.key} className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EADDCA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-extrabold text-[#2D2A26]">{rub.title}</h4>
                        <p className="text-[11px] text-[#8C8379]">{rub.desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => {
                              const existing = record.selfAssessment || {
                                rubric1Score: 4,
                                rubric2Score: 4,
                                rubric3Score: 4,
                                selfThoughts: ''
                              };
                              const updatedAssessment = {
                                ...existing,
                                [rub.key]: val
                              };
                              const updated = {
                                ...record,
                                selfAssessment: updatedAssessment
                              };
                              triggerDebouncedAutoSave(updated);
                            }}
                            className={`p-1.5 rounded-lg transition-transform ${
                              val <= currentVal ? 'text-[#A67C52] scale-110' : 'text-[#EADDCA] hover:text-[#CBB59D]'
                            }`}
                          >
                            <Star className="w-5 h-5 fill-current" />
                          </button>
                        ))}
                        <span className="text-xs font-bold text-[#A67C52] ml-1 min-w-[28px]">
                          {currentVal ? `${currentVal}점` : '선택'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Self Reflection Notes */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                  💬 내가 생각하는 내 글의 가장 마음에 드는 점과 아쉬운 점:
                </label>
                <textarea
                  rows={4}
                  placeholder="예: 초고보다 감정을 더 솔직하게 써서 뿌듯하지만, 마지막 마무리를 더 멋지게 맺지 못한 점은 조금 아쉽다."
                  value={record.selfAssessment?.selfThoughts || ''}
                  onChange={(e) => {
                    const existing = record.selfAssessment || {
                      rubric1Score: 4,
                      rubric2Score: 4,
                      rubric3Score: 4,
                      selfThoughts: ''
                    };
                    const updated = {
                      ...record,
                      selfAssessment: {
                        ...existing,
                        selfThoughts: e.target.value
                      }
                    };
                    triggerDebouncedAutoSave(updated);
                  }}
                  className="w-full p-4 border border-[#EADDCA] rounded-2xl text-sm font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-[#FDFBF7]"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(6)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (고쳐쓰기)
              </button>
              <button
                onClick={() => handleStepChange(8)}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <span>맞춤법 점검하러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: 맞춤법·띄어쓰기 점검 */}
        {record.currentStep === 8 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl border border-[#EADDCA] shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#2D2A26] flex items-center gap-2">
                    <span>8단계: 맞춤법과 띄어쓰기 탐정</span>
                  </h3>
                  <p className="text-xs text-[#8C8379]">
                    생각과 내용은 그대로 두고, 맞춤법과 띄어쓰기, 문장 부호만 바르게 다듬어요.
                  </p>
                </div>
                <button
                  onClick={handleRequestProofreading}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold shadow-sm disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>{aiLoading ? '점검 진행 중...' : '맞춤법 점검하기'}</span>
                </button>
              </div>

              {aiError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-2 font-medium">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{typeof aiError === 'string' && aiError !== '[object Object]' ? aiError : '맞춤법 점검 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiError('')}
                    className="text-rose-400 hover:text-rose-600 px-1 font-bold"
                    aria-label="오류 알림 닫기"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Suggestions List */}
              {record.proofreadSuggestions?.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#F0F7F4] p-3 rounded-xl border border-[#D1E9DE] text-xs text-[#5A8F7B]">
                    <span>
                      총 <strong>{record.proofreadSuggestions.length}</strong>개의 수정 제안이 발견되었습니다.
                    </span>
                    <button
                      onClick={handleApplyAllSuggestions}
                      className="px-3 py-1.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-lg font-extrabold flex items-center gap-1 text-xs"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>모두 한 번에 적용하기</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                    {record.proofreadSuggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                          sug.applied ? 'bg-[#F0F7F4]/50 border-[#D1E9DE]' : 'bg-white border-[#EADDCA]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F5EFE6] text-[#A67C52] border border-[#EADDCA]">
                              {sug.type}
                            </span>
                            <span className="text-xs line-through text-rose-500 font-semibold">{sug.original}</span>
                            <span className="text-xs text-[#8C8379]">➔</span>
                            <span className="text-xs text-[#5A8F7B] font-extrabold">{sug.corrected}</span>
                          </div>
                          <p className="text-[11px] text-[#8C8379]">{sug.reason}</p>
                        </div>
                        <div>
                          {sug.applied ? (
                            <span className="text-xs font-bold text-[#5A8F7B] flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>적용됨</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApplySingleSuggestion(idx)}
                              className="px-3 py-1.5 border border-[#EADDCA] text-[#4A443F] hover:bg-[#F5EFE6] rounded-lg text-xs font-bold"
                            >
                              적용
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Final Polished Preview */}
                  <div>
                    <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                      최종 교정본 미리보기 (수정 가능):
                    </label>
                    <textarea
                      rows={8}
                      value={record.finalWriting || record.afterProofreading}
                      onChange={(e) => {
                        const updated = {
                          ...record,
                          finalWriting: e.target.value
                        };
                        triggerDebouncedAutoSave(updated);
                      }}
                      className="w-full p-4 border border-[#EADDCA] rounded-2xl text-sm font-medium text-[#2D2A26] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5A8F7B] bg-[#FDFBF7]"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center bg-[#FDFBF7] rounded-2xl border border-dashed border-[#EADDCA] space-y-2">
                  <p className="text-xs font-bold text-[#4A443F]">
                    우측 상단의 [맞춤법 점검하기] 버튼을 누르면 AI가 글을 바르게 살펴봅니다.
                  </p>
                  <p className="text-[11px] text-[#8C8379]">
                    점검하지 않고도 다음 최종 제출 단계로 바로 갈 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleStepChange(7)}
                className="px-4 py-2.5 border border-[#EADDCA] rounded-xl text-xs font-bold text-[#4A443F] hover:bg-[#F5EFE6]"
              >
                이전 (자기평가)
              </button>
              <button
                onClick={() => {
                  if (!record.finalWriting) {
                    const fallback = record.afterProofreading || record.revisedWriting || record.draft;
                    const updated = { ...record, finalWriting: fallback };
                    setRecord(updated);
                    persistRecord(updated);
                  }
                  handleStepChange(9);
                }}
                className="px-6 py-3 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <span>최종 제출 단계로 가기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 9: 최종 제출 및 나의 책 만들기 */}
        {record.currentStep === 9 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EADDCA] shadow-sm space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-2">
                <span className="text-3xl">🎉</span>
                <h3 className="text-2xl font-black text-[#2D2A26] tracking-tight font-['Pretendard']">
                  드디어 완성된 나의 소중한 글!
                </h3>
                <p className="text-xs text-[#8C8379]">
                  주제부터 계획, 초고, AI 피드백, 고쳐쓰기, 자기평가, 맞춤법까지 온 정성을 다해 완성했습니다.
                </p>
              </div>

              {/* Book Page Preview */}
              <div className="bg-[#FDFBF7] p-6 sm:p-8 rounded-3xl border-2 border-[#EADDCA] max-w-2xl mx-auto shadow-xs space-y-4">
                <div className="text-center border-b border-[#EADDCA] pb-4">
                  <h4 className="text-xl font-extrabold text-[#2D2A26] mb-1">
                    {record.planning.title || record.topicTitle}
                  </h4>
                  <p className="text-xs text-[#A67C52] font-semibold">
                    지은이: {student.grade}학년 {student.classNum}반 {student.name} 작가
                  </p>
                </div>

                <div className="text-sm font-normal text-[#2D2A26] leading-loose whitespace-pre-wrap py-2 font-['Pretendard']">
                  {record.finalWriting || record.afterProofreading || record.revisedWriting || record.draft}
                </div>

                <div className="pt-4 border-t border-[#EADDCA] flex justify-between items-center text-[11px] text-[#8C8379]">
                  <span>작성 완료일: {new Date(record.updatedAt).toLocaleDateString('ko-KR')}</span>
                  <span>총 { (record.finalWriting || record.draft).length }자</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="max-w-md mx-auto space-y-3 pt-2">
                <button
                  onClick={handleSubmitFinal}
                  className="w-full py-4 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-2xl font-extrabold text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                >
                  <Award className="w-5 h-5" />
                  <span>{record.status === 'submitted' ? '최종 완성본 다시 저장' : '🏆 최종 작품 제출하기 (+120 XP)'}</span>
                </button>

                <p className="text-center text-[11px] text-[#8C8379]">
                  제출한 글은 선생님 대시보드로 전달되며, 나의 책장에서 책으로 엮을 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
